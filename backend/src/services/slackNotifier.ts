import { WebClient } from '@slack/web-api';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { getHourWindow } from './rateLimiter';

export async function notifyRateLimit(
  userId: string,
  senderEmail: string,
  hourlyLimit: number
): Promise<void> {
  try {
    const hourWindow = getHourWindow();
    const dedupKey = `slack:ratelimit_notified:${userId}:${senderEmail}:${hourWindow}`;

    // Ensure we only send one Slack notification per sender per hour window
    const acquired = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
    if (!acquired) {
      // Already notified during this hour window
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        slackAccessToken: true,
        slackChannel: true,
      },
    });

    if (!user || !user.slackAccessToken || !user.slackChannel) {
      // Slack not connected for this user, silently skip
      return;
    }

    const slack = new WebClient(user.slackAccessToken);

    const message = `⚠️ Rate limit reached for sender ${senderEmail}. ${hourlyLimit} emails/hour limit hit. Jobs are being rescheduled to the next hour window.`;

    await slack.chat.postMessage({
      channel: user.slackChannel,
      text: message,
    });

    console.log(`📢 Slack notification sent for user ${userId} and sender ${senderEmail}`);
  } catch (error: any) {
    console.error(`⚠️ Failed to send Slack notification for user ${userId}:`, error.message);
  }
}
