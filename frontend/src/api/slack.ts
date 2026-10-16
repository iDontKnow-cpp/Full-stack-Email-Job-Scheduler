import { apiGet, apiPost } from './client';
import { SlackStatus } from '../types';

export const SLACK_CONNECT_URL = '/api/slack/connect';

export async function getSlackStatus(): Promise<SlackStatus> {
  return apiGet<SlackStatus>('/api/slack/status');
}

export async function disconnectSlack(): Promise<void> {
  await apiPost('/api/slack/disconnect');
}
