import { apiGet, apiPost } from './client';
import { User } from '../types';

export const GOOGLE_AUTH_URL = '/api/auth/google';

export async function getMe(): Promise<User> {
  return apiGet<User>('/api/auth/me');
}

export async function logout(): Promise<void> {
  await apiPost('/api/auth/logout');
}
