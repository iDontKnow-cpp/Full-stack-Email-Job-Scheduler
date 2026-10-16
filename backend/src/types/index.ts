import { Request } from 'express';
import { EmailStatus, CampaignStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatar?: string | null;
  slackAccessToken?: string | null;
  slackChannel?: string | null;
  slackTeamName?: string | null;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface EmailJobData {
  emailJobId: string;
  userId: string;
  campaignId?: string | null;
  to: string;
  subject: string;
  body: string;
  senderEmail: string;
  idempotencyKey: string;
  hourlyLimit: number;
}

export interface EmailDocument {
  id: string;
  userId: string;
  campaignId?: string | null;
  to: string;
  subject: string;
  body: string;
  senderEmail: string;
  status: EmailStatus | string;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  etherealUrl?: string | null;
  error?: string | null;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  currentCount: number;
  resetAt: Date;
}

export interface EmailStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalEmails: number;
}
