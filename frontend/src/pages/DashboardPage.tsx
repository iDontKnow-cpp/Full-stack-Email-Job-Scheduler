import React, { useState } from 'react';
import { Plus, MailPlus } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatsCards } from '../components/dashboard/StatsCards';
import { EmailTabs, EmailTabType } from '../components/dashboard/EmailTabs';
import { ScheduledEmailsTable } from '../components/dashboard/ScheduledEmailsTable';
import { SentEmailsTable } from '../components/dashboard/SentEmailsTable';
import { ComposeModal } from '../components/dashboard/ComposeModal';
import { Button } from '../components/ui/Button';
import { useEmailStats } from '../hooks/useEmails';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EmailTabType>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const { data: stats } = useEmailStats();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header / Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Email Scheduler Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your queued jobs, rate limits, and asynchronous SMTP deliveries.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setIsComposeOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              size="md"
              className="shadow-sm shadow-primary-500/20"
            >
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <section aria-label="Job Statistics">
          <StatsCards />
        </section>

        {/* Tabs and Job Tables Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
          <EmailTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            scheduledCount={stats?.totalScheduled}
            sentCount={stats?.totalSent}
          />

          <div className="pt-2">
            {activeTab === 'scheduled' ? (
              <ScheduledEmailsTable onComposeClick={() => setIsComposeOpen(true)} />
            ) : (
              <SentEmailsTable />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-2">
          <span>&copy; {new Date().getFullYear()} Email Job Scheduler. All rights reserved.</span>
          <span>Powered by BullMQ & Redis</span>
        </div>
      </footer>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
};
