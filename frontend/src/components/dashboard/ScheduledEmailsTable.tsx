import React, { useState } from 'react';
import { Calendar, RefreshCw, Mail } from 'lucide-react';
import { useScheduledEmails } from '../../hooks/useEmails';
import { EmailJob } from '../../types';
import { Table, Column } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/Button';

interface ScheduledEmailsTableProps {
  onComposeClick?: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  onComposeClick,
}) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 10;

  const { data, isLoading, isFetching, refetch } = useScheduledEmails(page, limit, search);

  const handleSearchChange = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
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
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
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
      width: '40%',
      render: (job) => (
        <div className="max-w-md">
          <div className="font-medium text-gray-900 truncate">{job.subject}</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{job.body}</div>
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled Time',
      width: '20%',
      render: (job) => (
        <div className="text-sm text-gray-600 flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{formatDate(job.scheduledAt)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '15%',
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
  ];

  return (
    <div className="space-y-4">
      {/* Search and Table Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search scheduled emails..."
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
          {onComposeClick && (
            <Button size="sm" onClick={onComposeClick}>
              Schedule New
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={data?.emails || []}
        isLoading={isLoading}
        page={data?.page || page}
        limit={data?.limit || limit}
        total={data?.total || 0}
        totalPages={data?.totalPages || 1}
        onPageChange={(newPage) => setPage(newPage)}
        rowKey={(job) => job.id}
        emptyTitle="No scheduled emails found"
        emptyDescription={
          search
            ? `No emails match your search query "${search}". Try a different keyword.`
            : 'You have no emails currently scheduled in the queue.'
        }
        emptyAction={
          onComposeClick && !search ? (
            <Button size="sm" onClick={onComposeClick}>
              Compose First Email
            </Button>
          ) : undefined
        }
      />
    </div>
  );
};
