import { Queue, Job } from 'bullmq';
import { redis } from './redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24h
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
      count: 5000,
    },
  },
});

export async function scheduleEmailJob(
  emailJob: EmailJobData,
  delayMs: number
): Promise<Job<EmailJobData>> {
  const safeDelay = Math.max(0, Math.round(delayMs));

  // Use emailJob.emailJobId as unique BullMQ jobId to guarantee queue-level deduplication
  const job = await emailQueue.add('send-email', emailJob, {
    delay: safeDelay,
    jobId: emailJob.emailJobId,
  });

  return job;
}
