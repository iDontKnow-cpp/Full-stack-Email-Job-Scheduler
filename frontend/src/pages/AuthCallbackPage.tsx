import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getMe } from '../api/auth';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState('Completing authentication...');

  useEffect(() => {
    async function processAuth() {
      try {
        const error = searchParams.get('error');
        if (error) {
          toast.error(`Authentication error: ${error}`);
          navigate('/login', { replace: true });
          return;
        }

        const token = searchParams.get('token');
        if (token) {
          // If token was passed via URL parameter, store it if needed
          localStorage.setItem('auth_token', token);
        }

        setStatusMessage('Verifying account session...');
        // Verify current session with the backend
        const user = await getMe();

        if (user) {
          // Update TanStack Query cache directly
          queryClient.setQueryData(['auth', 'me'], user);
          toast.success(`Welcome back, ${user.name}!`);
          navigate('/dashboard', { replace: true });
        } else {
          toast.error('Session verification failed. Please sign in again.');
          navigate('/login', { replace: true });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to authenticate. Redirecting to login.');
        navigate('/login', { replace: true });
      }
    }

    processAuth();
  }, [navigate, searchParams, queryClient]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-sm w-full text-center">
        <LoadingSpinner size="lg" className="text-primary-600 mb-4" />
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Authenticating...
        </h3>
        <p className="text-xs text-gray-500">{statusMessage}</p>
      </div>
    </div>
  );
};
