import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSlackStatus, disconnectSlack } from '../api/slack';
import toast from 'react-hot-toast';

export function useSlackStatus() {
  return useQuery({
    queryKey: ['slack', 'status'],
    queryFn: getSlackStatus,
    retry: 1,
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack', 'status'] });
      toast.success('Slack disconnected successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to disconnect Slack');
    },
  });
}
