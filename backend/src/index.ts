import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis, redisSubscriber } from './lib/redis';
import { emailQueue, scheduleEmailJob } from './lib/bullmq';
import { initElasticsearch } from './lib/elasticsearch';
import { getTransporter } from './lib/ethereal';
import { createEmailWorker } from './workers/emailWorker';

import authRouter from './routes/auth';
import emailRouter from './routes/emails';
import slackRouter from './routes/slack';

const app = express();

// 1. CORS Configuration
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// 2. Parsers and Session
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// 3. Set up Bull Board dashboard for queue monitoring at /admin/queues
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue as any) as any],
  serverAdapter: bullBoardAdapter,
});

app.use('/admin/queues', bullBoardAdapter.getRouter());

// 4. API Routes
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// 5. Recovery mechanism on startup (Safe across multi-replica horizontal scaling)
async function recoverPendingJobs() {
  try {
    // Acquire a 60-second distributed lock so only one replica performs recovery during pod scaling
    const lockAcquired = await redis.set('lock:startup_recovery', '1', 'EX', 60, 'NX');
    if (!lockAcquired) {
      console.log('ℹ️ Another replica is already running startup recovery scan. Skipping.');
      return;
    }

    const now = new Date();
    // Find scheduled/queued emails whose scheduled time has arrived or passed
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        scheduledAt: { lte: now },
      },
      include: { campaign: true },
      take: 500,
    });

    if (pendingJobs.length > 0) {
      console.log(`🔄 Recovery: Found ${pendingJobs.length} past-due email jobs to re-queue...`);

      for (const jobRecord of pendingJobs) {
        const bullJob = await scheduleEmailJob(
          {
            emailJobId: jobRecord.id,
            userId: jobRecord.userId,
            campaignId: jobRecord.campaignId,
            to: jobRecord.to,
            subject: jobRecord.subject,
            body: jobRecord.body,
            senderEmail: jobRecord.senderEmail,
            idempotencyKey: jobRecord.idempotencyKey,
            hourlyLimit:
              jobRecord.campaign?.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          },
          0 // execute immediately
        );

        await prisma.emailJob.update({
          where: { id: jobRecord.id },
          data: {
            bullJobId: bullJob.id,
            status: 'QUEUED',
          },
        });
      }

      console.log(`✅ Recovery: Successfully re-queued ${pendingJobs.length} past-due jobs.`);
    }

    // Also look for future scheduled emails without a bullJobId
    const unqueuedFutureJobs = await prisma.emailJob.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gt: now },
        bullJobId: null,
      },
      include: { campaign: true },
      take: 500,
    });

    if (unqueuedFutureJobs.length > 0) {
      console.log(`🔄 Recovery: Queuing ${unqueuedFutureJobs.length} unassigned future jobs...`);
      for (const jobRecord of unqueuedFutureJobs) {
        const delayMs = Math.max(0, jobRecord.scheduledAt.getTime() - Date.now());
        const bullJob = await scheduleEmailJob(
          {
            emailJobId: jobRecord.id,
            userId: jobRecord.userId,
            campaignId: jobRecord.campaignId,
            to: jobRecord.to,
            subject: jobRecord.subject,
            body: jobRecord.body,
            senderEmail: jobRecord.senderEmail,
            idempotencyKey: jobRecord.idempotencyKey,
            hourlyLimit:
              jobRecord.campaign?.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          },
          delayMs
        );

        await prisma.emailJob.update({
          where: { id: jobRecord.id },
          data: { bullJobId: bullJob.id },
        });
      }
    }
  } catch (recoveryErr: any) {
    console.warn('⚠️ Warning during startup recovery check:', recoveryErr.message);
  }
}

// 6. Bootstrap server
let emailWorker: ReturnType<typeof createEmailWorker> | null = null;

async function bootstrap() {
  try {
    // Test Prisma DB connection
    await prisma.$connect();
    console.log('📦 Connected to PostgreSQL database via Prisma');

    // Initialize Ethereal transporter
    await getTransporter();

    // Initialize Elasticsearch index
    await initElasticsearch();

    // Start BullMQ Worker in same process
    emailWorker = createEmailWorker();

    // Run recovery check for missed or pending jobs
    await recoverPendingJobs();

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Email Scheduler Backend is listening on port ${env.PORT}`);
      console.log(`📊 BullMQ Queue Dashboard: http://localhost:${env.PORT}/admin/queues`);
      console.log(`🔗 Frontend Allowed Origin: ${env.FRONTEND_URL}`);
      console.log(`======================================================\n`);
    });

    // 7. Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        console.log('🔒 HTTP server closed.');

        try {
          if (emailWorker) {
            await emailWorker.close();
            console.log('👷 BullMQ Worker closed.');
          }

          await emailQueue.close();
          console.log('📬 BullMQ Queue closed.');

          await redis.quit();
          await redisSubscriber.quit();
          console.log('🔌 Redis connections closed.');

          await prisma.$disconnect();
          console.log('📦 Database connection closed.');

          console.log('👋 Goodbye!');
          process.exit(0);
        } catch (err: any) {
          console.error('Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('⚠️ Forcefully terminating after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    console.error('💥 Failed to bootstrap backend server:', error);
    process.exit(1);
  }
}

bootstrap();

export default app;
