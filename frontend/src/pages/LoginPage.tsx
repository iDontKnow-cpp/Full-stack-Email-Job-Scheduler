import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Clock, ShieldCheck, Zap, ArrowRight, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_AUTH_URL } from '../api/auth';

export const LoginPage: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    window.location.href = GOOGLE_AUTH_URL;
  };

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch {
      // Ignore
    }
    window.location.href = GOOGLE_AUTH_URL;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* App Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-500 text-white shadow-xl shadow-primary-500/25 mb-4 transform hover:scale-105 transition-transform">
          <Mail className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Email Job Scheduler
        </h2>
        <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
          Production-grade asynchronous email delivery powered by BullMQ, Redis, and Ethereal SMTP.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-gray-200/50 sm:rounded-3xl border border-gray-100 sm:px-10">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-800 text-center">
                {isAuthenticated && user ? 'Account Session Active' : 'Welcome back'}
              </h3>
              <p className="text-xs text-gray-500 text-center mt-1">
                {isAuthenticated && user
                  ? 'You are currently signed in. You can continue to your dashboard, switch Google accounts, or sign out below.'
                  : 'Authenticate with your Google account to access your scheduler dashboard'}
              </p>
            </div>

            {/* Authenticated State Actions */}
            {!isLoading && isAuthenticated && user ? (
              <div className="space-y-4">
                <div className="p-4 bg-primary-50/70 border border-primary-100 rounded-2xl flex items-center space-x-3.5">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || 'User'}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-300"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      {(user.name || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name || 'Authenticated User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 mt-1">
                      ● Signed In
                    </span>
                  </div>
                </div>

                {/* Primary Action: Go to Dashboard */}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.99]"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Secondary Actions: Switch Account & Sign Out */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-primary-700 bg-primary-50/80 hover:bg-primary-100 rounded-xl transition-colors border border-primary-200/50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-red-600 bg-red-50/70 hover:bg-red-100/70 rounded-xl transition-colors border border-red-200/50 disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Google OAuth Button */
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl shadow-xs text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.99]"
              >
                {/* Official Google 'G' Logo SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}

            {/* Feature highlights */}
            <div className="pt-6 border-t border-gray-100 space-y-3">
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <Clock className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span>Custom delayed scheduling & minimum send delays</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Hourly rate limiting with Slack rate-limit alerts</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Persistent queue survives server restarts</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          ReachInbox Email Scheduler &bull; Built with React & TypeScript
        </p>
      </div>
    </div>
  );
};
