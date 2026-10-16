import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMe, logout as apiLogout } from '../api/auth';
import { User } from '../types';

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await getMe();
      } catch (err: any) {
        if (err?.status === 401) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      navigate('/login');
    },
    onError: () => {
      // Even if network error occurs on logout, clear local query cache and redirect
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      navigate('/login');
    },
  });

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user && !isError,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };
}
