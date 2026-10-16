export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export type EmailStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'RATE_LIMITED';

export interface EmailJob {
  id: string;
  campaignId?: string;
  to: string;
  subject: string;
  body: string;
  senderEmail: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string;
  error?: string;
  etherealUrl?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  senderEmail: string;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  status: string;
  startTime: string;
  createdAt: string;
}

export interface EmailStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
}

export interface PaginatedResponse<T> {
  emails: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}
