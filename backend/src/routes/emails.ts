import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { scheduleEmailJob } from '../lib/bullmq';
import { indexEmail, searchEmails } from '../lib/elasticsearch';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { env } from '../config/env';

const router = Router();

// Apply auth to all email routes
router.use(requireAuth);

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient is required'),
  senderEmail: z.string().email('Invalid sender email'),
  startTime: z.string().datetime({ offset: true }).or(z.string().datetime()),
  delaySeconds: z.coerce.number().min(0).default(2),
  hourlyLimit: z.coerce.number().min(1).default(200),
});

/**
 * POST /api/emails/schedule
 * Schedules a new email campaign
 */
router.post(
  '/schedule',
  validate(scheduleSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        subject,
        body,
        recipients,
        senderEmail,
        startTime,
        delaySeconds,
        hourlyLimit,
      } = req.body;

      const userId = req.user!.id;
      const baseStartTime = new Date(startTime);
      const now = new Date();

      // Ensure base start time is not excessively in the past
      const effectiveStartTime =
        baseStartTime.getTime() < now.getTime() ? now : baseStartTime;

      // Deduplicate recipients
      const uniqueRecipients = Array.from(
        new Set(recipients.map((r: string) => r.trim().toLowerCase()))
      );

      // 1. Create Campaign
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          subject,
          body,
          senderEmail,
          totalEmails: uniqueRecipients.length,
          sentCount: 0,
          failedCount: 0,
          delaySeconds,
          hourlyLimit,
          startTime: effectiveStartTime,
          status: 'SCHEDULED',
        },
      });

      // 2. Compute schedules with hourly limit and delaySeconds
      // If index exceeds hourlyLimit in a 1-hour window, push to next hour window
      const jobDataList: {
        to: string;
        scheduledAt: Date;
        idempotencyKey: string;
      }[] = [];

      for (let i = 0; i < uniqueRecipients.length; i++) {
        const to = uniqueRecipients[i];
        const batchHour = Math.floor(i / hourlyLimit);
        const indexInHour = i % hourlyLimit;

        const scheduledTime = new Date(
          effectiveStartTime.getTime() +
            batchHour * 3600000 +
            indexInHour * delaySeconds * 1000
        );

        jobDataList.push({
          to,
          scheduledAt: scheduledTime,
          idempotencyKey: `${campaign.id}:${to}`,
        });
      }

      // 3. Create EmailJob records in DB in chunks to handle large recipient lists
      const chunkSize = 50;
      const createdJobs: any[] = [];

      for (let i = 0; i < jobDataList.length; i += chunkSize) {
        const chunk = jobDataList.slice(i, i + chunkSize);
        const batchResults = await prisma.$transaction(
          chunk.map((item) =>
            prisma.emailJob.create({
              data: {
                campaignId: campaign.id,
                userId,
                to: item.to,
                subject,
                body,
                senderEmail,
                status: 'SCHEDULED',
                scheduledAt: item.scheduledAt,
                idempotencyKey: item.idempotencyKey,
              },
            })
          )
        );
        createdJobs.push(...batchResults);
      }

      // 4. Schedule jobs in BullMQ and index in Elasticsearch
      for (const emailJob of createdJobs) {
        const delayMs = Math.max(
          0,
          new Date(emailJob.scheduledAt).getTime() - Date.now()
        );

        const bullJob = await scheduleEmailJob(
          {
            emailJobId: emailJob.id,
            userId,
            campaignId: campaign.id,
            to: emailJob.to,
            subject: emailJob.subject,
            body: emailJob.body,
            senderEmail: emailJob.senderEmail,
            idempotencyKey: emailJob.idempotencyKey,
            hourlyLimit,
          },
          delayMs
        );

        // Update with bullJobId
        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { bullJobId: bullJob.id },
        });

        // Index in Elasticsearch
        indexEmail({
          id: emailJob.id,
          userId,
          campaignId: campaign.id,
          to: emailJob.to,
          subject: emailJob.subject,
          body: emailJob.body,
          senderEmail: emailJob.senderEmail,
          status: 'SCHEDULED',
          scheduledAt: emailJob.scheduledAt,
        }).catch((err) =>
          console.warn(`Failed to index scheduled email ${emailJob.id}:`, err.message)
        );
      }

      res.status(201).json({
        success: true,
        campaignId: campaign.id,
        totalScheduled: createdJobs.length,
        campaign,
      });
    } catch (err: any) {
      console.error('Error scheduling campaign:', err);
      res.status(500).json({ error: err.message || 'Failed to schedule campaign' });
    }
  }
);

/**
 * GET /api/emails/scheduled
 * List scheduled emails for current user with pagination and optional search
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const q = (req.query.q as string)?.trim();
    const skip = (page - 1) * limit;

    const scheduledStatuses = ['SCHEDULED', 'QUEUED', 'RATE_LIMITED', 'SENDING'] as const;

    if (q) {
      // Use Elasticsearch for search
      const esResult = await searchEmails(q, userId, page, limit, [...scheduledStatuses]);
      if (esResult.hits.length > 0) {
        return res.json({
          emails: esResult.hits,
          total: esResult.total,
          page,
          limit,
          totalPages: Math.ceil(esResult.total / limit),
        });
      }
    }

    // Database query
    const whereClause: any = {
      userId,
      status: { in: scheduledStatuses },
    };

    if (q) {
      whereClause.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { to: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    res.json({
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * List sent/failed emails for current user with pagination and optional search
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const q = (req.query.q as string)?.trim();
    const skip = (page - 1) * limit;

    const sentStatuses = ['SENT', 'FAILED'] as const;

    if (q) {
      // Use Elasticsearch for search
      const esResult = await searchEmails(q, userId, page, limit, [...sentStatuses]);
      if (esResult.hits.length > 0) {
        return res.json({
          emails: esResult.hits,
          total: esResult.total,
          page,
          limit,
          totalPages: Math.ceil(esResult.total / limit),
        });
      }
    }

    const whereClause: any = {
      userId,
      status: { in: sentStatuses },
    };

    if (q) {
      whereClause.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { to: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    res.json({
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/search
 * Search emails using Elasticsearch with fallback to DB
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const q = (req.query.q as string)?.trim() || '';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Try Elasticsearch
    const esResult = await searchEmails(q, userId, page, limit);

    if (esResult.hits.length > 0) {
      return res.json({
        source: 'elasticsearch',
        results: esResult.hits,
        total: esResult.total,
        page,
        limit,
        totalPages: Math.ceil(esResult.total / limit),
      });
    }

    // Fallback to database
    const skip = (page - 1) * limit;
    const whereClause: any = { userId };
    if (q) {
      whereClause.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { to: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    res.json({
      source: 'database',
      results: emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

/**
 * GET /api/emails/stats
 * Return counts of scheduled, sent, and failed emails for current user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [totalScheduled, totalSent, totalFailed, totalEmails] = await Promise.all([
      prisma.emailJob.count({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED', 'SENDING'] },
        },
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: 'SENT',
        },
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: 'FAILED',
        },
      }),
      prisma.emailJob.count({
        where: { userId },
      }),
    ]);

    res.json({
      totalScheduled,
      totalSent,
      totalFailed,
      totalEmails,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch email stats' });
  }
});

export default router;
