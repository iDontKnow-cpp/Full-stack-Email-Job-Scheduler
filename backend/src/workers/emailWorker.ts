import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, emailQueue } from '../lib/bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { getTransporter, getPreviewUrl } from '../lib/ethereal';
import { updateEmailStatus } from '../lib/elasticsearch';
import { checkRateLimit } from '../services/rateLimiter';
import { notifyRateLimit } from '../services/slackNotifier';
import { EmailJobData } from '../types';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailJobId, userId, campaignId, to, subject, body, senderEmail, hourlyLimit } =
        job.data;

      console.log(`📨 Processing email job ${job.id} (DB ID: ${emailJobId}) for ${to}`);

      // 1. Fetch current status from DB
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { campaign: true },
      });

      if (!emailRecord) {
        console.warn(`⚠️ EmailJob record ${emailJobId} not found in database. Skipping.`);
        return;
      }

      // 2. Check idempotency — if already sent, skip
      if (emailRecord.status === 'SENT') {
        console.log(`ℹ️ EmailJob ${emailJobId} is already marked as SENT. Skipping duplicate send.`);
        return;
      }

      // 3. Check rate limiting (per-sender, per-hour)
      const effectiveHourlyLimit =
        emailRecord.campaign?.hourlyLimit ||
        hourlyLimit ||
        env.MAX_EMAILS_PER_HOUR_PER_SENDER;

      const rateCheck = await checkRateLimit(senderEmail, effectiveHourlyLimit);

      if (!rateCheck.allowed) {
        console.warn(
          `🛑 Rate limit hit for sender "${senderEmail}" (${rateCheck.currentCount}/${effectiveHourlyLimit} this hour).`
        );

        // 3a. Send Slack notification (debounced per sender/hour)
        await notifyRateLimit(userId, senderEmail, effectiveHourlyLimit);

        // 3b. Calculate delay until next hour window
        const delayMs = Math.max(1000, rateCheck.resetAt.getTime() - Date.now() + 1000);
        const nextScheduledDate = new Date(Date.now() + delayMs);

        // 3c. Re-schedule the job with delay to the next hour window
        const rescheduledJob = await emailQueue.add('send-email', job.data, {
          delay: delayMs,
          jobId: `${emailJobId}-retry-${Date.now()}`,
        });

        // 3d. Update DB and Elasticsearch status
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RATE_LIMITED',
            scheduledAt: nextScheduledDate,
            bullJobId: rescheduledJob.id,
          },
        });

        await updateEmailStatus(emailJobId, 'RATE_LIMITED');

        console.log(
          `⏱️ Rescheduled emailJob ${emailJobId} to run in ${Math.round(
            delayMs / 1000
          )}s (job ID: ${rescheduledJob.id})`
        );

        // Do not throw; job completes gracefully
        return;
      }

      // 4. Allowed to send: update status to SENDING
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'SENDING' },
      });
      await updateEmailStatus(emailJobId, 'SENDING');

      try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail({
          from: senderEmail,
          to,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br/>'),
        });

        const previewUrl = getPreviewUrl(info) || null;
        const sentAt = new Date();

        console.log(`✅ Email sent successfully to ${to}. Preview URL: ${previewUrl}`);

        // Update DB
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt,
            etherealUrl: previewUrl,
            error: null,
          },
        });

        // Update Elasticsearch
        await updateEmailStatus(emailJobId, 'SENT', sentAt, previewUrl, null);

        // Update campaign progress
        if (campaignId) {
          const campaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });

          if (campaign.sentCount + campaign.failedCount >= campaign.totalEmails) {
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { status: 'COMPLETED' },
            });
          } else if (campaign.status === 'SCHEDULED') {
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { status: 'IN_PROGRESS' },
            });
          }
        }
      } catch (sendError: any) {
        console.error(`❌ Failed to send email to ${to}:`, sendError.message);

        // Update DB to FAILED
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            error: sendError.message,
          },
        });

        // Update Elasticsearch
        await updateEmailStatus(emailJobId, 'FAILED', null, null, sendError.message);

        // Update campaign failed count
        if (campaignId) {
          const campaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });

          if (campaign.sentCount + campaign.failedCount >= campaign.totalEmails) {
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { status: campaign.sentCount > 0 ? 'COMPLETED' : 'FAILED' },
            });
          }
        }

        // Throw error so BullMQ can trigger configured backoff/retry if appropriate
        throw sendError;
      }
    },
    {
      connection: redis,
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      },
    }
  );

  worker.on('ready', () => {
    console.log(
      `🚀 BullMQ Email Worker started with concurrency: ${env.WORKER_CONCURRENCY}, min delay: ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`💥 BullMQ Job ${job?.id} failed with error:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('💥 BullMQ Worker internal error:', err.message);
  });

  return worker;
}
