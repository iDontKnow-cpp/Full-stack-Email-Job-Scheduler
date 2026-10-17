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
    mutationFn: async () => {
      try {
        await apiLogout();
      } catch (err) {
        console.warn('API logout network call failed, continuing with client cleanup:', err);
      }
      localStorage.removeItem('auth_token');
      document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    },
    onSettled: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['auth'] });
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user && !isError,
    logout: () => logoutMutation.mutateAsync(),
    isLoggingOut: logoutMutation.isPending,
  };
}
