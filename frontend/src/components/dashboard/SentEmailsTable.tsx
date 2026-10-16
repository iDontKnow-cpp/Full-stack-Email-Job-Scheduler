import React, { useState } from 'react';
import { Calendar, RefreshCw, Mail, ExternalLink } from 'lucide-react';
import { useSentEmails } from '../../hooks/useEmails';
import { EmailJob } from '../../types';
import { Table, Column } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/Button';

export const SentEmailsTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 10;

  const { data, isLoading, isFetching, refetch } = useSentEmails(page, limit, search);

  const handleSearchChange = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const columns: Column<EmailJob>[] = [
    {
      key: 'to',
      header: 'Recipient',
      width: '25%',
      render: (job) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="font-medium text-gray-900 truncate">{job.to}</div>
            <div className="text-xs text-gray-400 truncate">From: {job.senderEmail}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject & Body',
      width: '35%',
      render: (job) => (
        <div className="max-w-md">
          <div className="font-medium text-gray-900 truncate">{job.subject}</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{job.body}</div>
        </div>
      ),
    },
    {
      key: 'sentAt',
      header: 'Sent Time',
      width: '20%',
      render: (job) => (
        <div className="text-sm text-gray-600 flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{formatDate(job.sentAt || job.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (job) => (
        <div>
          <Badge status={job.status} />
          {job.error && (
            <p className="text-xs text-rose-500 truncate max-w-[140px] mt-1" title={job.error}>
              {job.error}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Preview',
      width: '8%',
      render: (job) => {
        if (!job.etherealUrl) {
          return <span className="text-gray-300 text-xs">N/A</span>;
        }
        return (
          <a
            href={job.etherealUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs text-primary-600 hover:text-primary-800 font-medium py-1 px-2 rounded-md hover:bg-primary-50 transition-colors"
            title="Open in Ethereal Mail"
          >
            <span>View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Table Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search sent emails..."
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching && !isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            className="text-gray-500 hover:text-gray-900"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        page={data?.page || page}
        limit={data?.limit || limit}
        total={data?.total || 0}
        totalPages={data?.totalPages || 1}
        onPageChange={(newPage) => setPage(newPage)}
        rowKey={(job) => job.id}
        emptyTitle="No sent emails found"
        emptyDescription={
          search
            ? `No sent emails match your search query "${search}". Try a different keyword.`
            : 'Sent emails will appear here once the scheduler delivers them.'
        }
      />
    </div>
  );
};
