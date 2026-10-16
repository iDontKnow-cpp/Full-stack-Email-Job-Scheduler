import { apiGet, apiPost } from './client';
import { EmailJob, EmailStats, PaginatedResponse, ScheduleEmailPayload } from '../types';

export async function getScheduledEmails(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<PaginatedResponse<EmailJob>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search && search.trim() !== '') {
    params.set('q', search.trim());
  }
  return apiGet<PaginatedResponse<EmailJob>>(`/api/emails/scheduled?${params.toString()}`);
}

export async function getSentEmails(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<PaginatedResponse<EmailJob>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search && search.trim() !== '') {
    params.set('q', search.trim());
  }
  return apiGet<PaginatedResponse<EmailJob>>(`/api/emails/sent?${params.toString()}`);
}

export async function scheduleEmails(
  data: ScheduleEmailPayload
): Promise<{ campaignId: string; jobCount: number }> {
  return apiPost<{ campaignId: string; jobCount: number }>('/api/emails/schedule', data);
}

export async function getEmailStats(): Promise<EmailStats> {
  return apiGet<EmailStats>('/api/emails/stats');
}

export async function searchEmails(query: string): Promise<EmailJob[]> {
  const params = new URLSearchParams({ q: query.trim() });
  return apiGet<EmailJob[]>(`/api/emails/search?${params.toString()}`);
}
