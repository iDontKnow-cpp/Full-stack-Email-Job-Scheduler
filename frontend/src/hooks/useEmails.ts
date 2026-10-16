import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getScheduledEmails,
  getSentEmails,
  getEmailStats,
  scheduleEmails,
} from '../api/emails';
import { ScheduleEmailPayload } from '../types';

export function useScheduledEmails(page: number = 1, limit: number = 20, search?: string) {
  return useQuery({
    queryKey: ['emails', 'scheduled', { page, limit, search }],
    queryFn: () => getScheduledEmails(page, limit, search),
    refetchInterval: 10000, // Refresh every 10 seconds to catch status transitions
  });
}

export function useSentEmails(page: number = 1, limit: number = 20, search?: string) {
  return useQuery({
    queryKey: ['emails', 'sent', { page, limit, search }],
    queryFn: () => getSentEmails(page, limit, search),
    refetchInterval: 10000,
  });
}

export function useEmailStats() {
  return useQuery({
    queryKey: ['emails', 'stats'],
    queryFn: getEmailStats,
    refetchInterval: 10000,
  });
}

export function useScheduleEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduleEmailPayload) => scheduleEmails(data),
    onSuccess: () => {
      // Invalidate queries so lists and stats update immediately
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'stats'] });
    },
  });
}
