import React from 'react';
import { Clock, Send } from 'lucide-react';

export type EmailTabType = 'scheduled' | 'sent';

export interface EmailTabsProps {
  activeTab: EmailTabType;
  onChange: (tab: EmailTabType) => void;
  scheduledCount?: number;
  sentCount?: number;
}

export const EmailTabs: React.FC<EmailTabsProps> = ({
  activeTab,
  onChange,
  scheduledCount,
  sentCount,
}) => {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          type="button"
          onClick={() => onChange('scheduled')}
          className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all ${
            activeTab === 'scheduled'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Clock
            className={`-ml-0.5 mr-2 h-4 w-4 ${
              activeTab === 'scheduled'
                ? 'text-primary-600'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
          />
          <span>Scheduled Emails</span>
          {scheduledCount !== undefined && (
            <span
              className={`ml-2.5 py-0.5 px-2 rounded-full text-xs font-semibold ${
                activeTab === 'scheduled'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {scheduledCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onChange('sent')}
          className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all ${
            activeTab === 'sent'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Send
            className={`-ml-0.5 mr-2 h-4 w-4 ${
              activeTab === 'sent'
                ? 'text-primary-600'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
          />
          <span>Sent Emails</span>
          {sentCount !== undefined && (
            <span
              className={`ml-2.5 py-0.5 px-2 rounded-full text-xs font-semibold ${
                activeTab === 'sent'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {sentCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
