import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Demo User
  const user = await prisma.user.upsert({
    where: { email: 'demo@reachinbox.ai' },
    update: {},
    create: {
      googleId: 'google_demo_1001',
      email: 'demo@reachinbox.ai',
      name: 'Demo ReachInbox User',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      slackTeamName: 'ReachInbox Workspace',
      slackChannel: 'email-alerts',
    },
  });

  console.log(`👤 Demo user created/updated: ${user.email} (${user.id})`);

  // 2. Create Sample Campaign
  const now = new Date();
  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      subject: 'Welcome to ReachInbox Email Scheduler!',
      body: 'Hello,\n\nThank you for checking out our high-throughput email job scheduler built with BullMQ, Redis, PostgreSQL, and Elasticsearch.\n\nBest regards,\nThe ReachInbox Team',
      senderEmail: 'marketing@reachinbox.ai',
      totalEmails: 5,
      sentCount: 3,
      failedCount: 0,
      delaySeconds: 2,
      hourlyLimit: 200,
      startTime: new Date(now.getTime() - 10 * 60 * 1000), // started 10 minutes ago
      status: 'IN_PROGRESS',
    },
  });

  // 3. Create sample sent emails
  const sentRecipients = ['sarah.connor@example.com', 'john.doe@example.com', 'alice.smith@example.com'];
  for (let i = 0; i < sentRecipients.length; i++) {
    const to = sentRecipients[i];
    await prisma.emailJob.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        to,
        subject: campaign.subject,
        body: campaign.body,
        senderEmail: campaign.senderEmail,
        status: 'SENT',
        scheduledAt: new Date(now.getTime() - (8 - i * 2) * 60 * 1000),
        sentAt: new Date(now.getTime() - (8 - i * 2) * 60 * 1000 + 1500),
        etherealUrl: 'https://ethereal.email/message/demo-preview-message-id',
        idempotencyKey: `${campaign.id}:${to}`,
      },
    });
  }

  // 4. Create sample scheduled emails
  const futureRecipients = ['bob.builder@example.com', 'carol.danvers@example.com'];
  for (let i = 0; i < futureRecipients.length; i++) {
    const to = futureRecipients[i];
    await prisma.emailJob.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        to,
        subject: campaign.subject,
        body: campaign.body,
        senderEmail: campaign.senderEmail,
        status: 'SCHEDULED',
        scheduledAt: new Date(now.getTime() + (i + 1) * 5 * 60 * 1000), // in 5, 10 mins
        idempotencyKey: `${campaign.id}:${to}`,
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

