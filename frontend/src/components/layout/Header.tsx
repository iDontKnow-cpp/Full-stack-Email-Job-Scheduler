import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  LogOut,
  ChevronDown,
  Hash,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSlackStatus, useDisconnectSlack } from '../../hooks/useSlack';
import { SLACK_CONNECT_URL } from '../../api/slack';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const { data: slackStatus, isLoading: isSlackLoading } = useSlackStatus();
  const disconnectSlack = useDisconnectSlack();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSlackConnect = () => {
    window.location.href = SLACK_CONNECT_URL;
  };

  const handleSlackDisconnect = () => {
    disconnectSlack.mutate();
    setDropdownOpen(false);
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
                Email Scheduler
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-primary-50 text-primary-700 rounded-full border border-primary-200">
                ReachInbox
              </span>
            </div>
          </div>

          {/* Right Header Navigation & Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Quick Slack Status Badge */}
            <div className="hidden md:flex items-center">
              {isSlackLoading ? (
                <div className="h-7 w-28 bg-gray-100 rounded-full animate-pulse" />
              ) : slackStatus?.connected ? (
                <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">Slack:</span>
                  <span className="truncate max-w-[120px]">{slackStatus.teamName || 'Connected'}</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSlackConnect}
                  leftIcon={<Hash className="w-3.5 h-3.5 text-gray-500" />}
                  className="text-xs"
                >
                  Connect Slack
                </Button>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                aria-expanded={dropdownOpen}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User avatar'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-semibold text-xs flex items-center justify-center ring-2 ring-primary-100">
                    {getUserInitials(user?.name)}
                  </div>
                )}
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-medium text-gray-900 leading-tight">
                    {user?.name || 'Authorized User'}
                  </div>
                  <div className="text-gray-500 truncate max-w-[140px] leading-tight">
                    {user?.email || ''}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User info banner inside dropdown */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {user?.email || ''}
                    </p>
                  </div>

                  {/* Slack Connection inside dropdown */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Integrations
                      </span>
                      {slackStatus?.connected && (
                        <span className="flex items-center text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Connected
                        </span>
                      )}
                    </div>
                    {slackStatus?.connected ? (
                      <div>
                        <p className="text-xs text-gray-600 mb-2 truncate">
                          Team: <strong className="text-gray-800">{slackStatus.teamName || 'Workspace'}</strong>
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSlackDisconnect}
                          isLoading={disconnectSlack.isPending}
                          className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 justify-start"
                        >
                          Disconnect Slack
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSlackConnect}
                        leftIcon={<Hash className="w-4 h-4 text-[#4A154B]" />}
                        rightIcon={<ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />}
                        className="w-full text-xs justify-start"
                      >
                        Connect Slack
                      </Button>
                    )}
                  </div>

                  {/* Logout Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => logout()}
                      disabled={isLoggingOut}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50/75 flex items-center space-x-2 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
