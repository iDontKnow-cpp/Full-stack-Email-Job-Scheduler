import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  page?: number;
  totalPages?: number;
  total?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  rowKey: (item: T, index: number) => string;
}

export function Table<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display at this moment.',
  emptyAction,
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 20,
  onPageChange,
  rowKey,
}: TableProps<T>) {
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/75">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width }}
                  className={`px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                    column.className || ''
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-cell-${colIndex}`} className="px-6 py-4 whitespace-nowrap">
                      <div
                        className="h-4 bg-gray-200 rounded"
                        style={{
                          width: `${Math.floor(Math.random() * (90 - 45 + 1) + 45)}%`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State Row
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    className="border-0 bg-transparent py-4"
                  />
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((item, index) => (
                <tr
                  key={rowKey(item, index)}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={`${rowKey(item, index)}-${column.key}`}
                      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-700 ${
                        column.className || ''
                      }`}
                    >
                      {column.render
                        ? column.render(item, index)
                        : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {!isLoading && total > 0 && onPageChange && (
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
            <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
            <span className="font-semibold text-gray-900">{total}</span> results
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <div className="text-sm text-gray-600 px-2 font-medium">
              Page {page} of {Math.max(1, totalPages)}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
