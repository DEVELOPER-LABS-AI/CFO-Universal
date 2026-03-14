/**
 * Sync History Table Component
 *
 * Displays recent Xero sync logs with expandable error details.
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RetryButton } from './RetryButton';

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  invoices_processed: number;
  invoices_failed: number;
  expenses_processed: number;
  expenses_failed: number;
  contacts_mapped: number;
  contacts_unmapped: number;
  errors: any[];
  triggered_by: string;
}

interface SyncHistoryTableProps {
  syncs: SyncLog[];
  onRetry?: (syncLogId: string) => void;
}

export function SyncHistoryTable({ syncs, onRetry }: SyncHistoryTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const statusColors = {
    SUCCESS: 'bg-green-100 text-green-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-gray-100 text-gray-800',
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (syncs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No sync history yet. Click "Sync Now" to start your first sync.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Invoices
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Expenses
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {syncs.map((sync) => (
            <React.Fragment key={sync.id}>
              <tr
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  setExpandedRow(expandedRow === sync.id ? null : sync.id)
                }
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDistanceToNow(new Date(sync.started_at), {
                    addSuffix: true,
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {sync.sync_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[sync.status as keyof typeof statusColors]
                    }`}
                  >
                    {sync.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDuration(sync.duration_ms)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="text-green-600">
                    {sync.invoices_processed - sync.invoices_failed}
                  </span>
                  {sync.invoices_failed > 0 && (
                    <span className="text-red-600 ml-1">
                      / {sync.invoices_failed} failed
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="text-green-600">
                    {sync.expenses_processed - sync.expenses_failed}
                  </span>
                  {sync.expenses_failed > 0 && (
                    <span className="text-red-600 ml-1">
                      / {sync.expenses_failed} failed
                    </span>
                  )}
                </td>
                <td
                  className="px-6 py-4 whitespace-nowrap text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(sync.status === 'FAILED' || sync.status === 'PARTIAL') &&
                    onRetry && (
                      <RetryButton
                        syncLogId={sync.id}
                        onRetryComplete={() => onRetry(sync.id)}
                      />
                    )}
                </td>
              </tr>
              {expandedRow === sync.id && sync.errors.length > 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 bg-gray-50">
                    <div className="text-sm">
                      <h4 className="font-medium text-gray-900 mb-2">
                        Errors ({sync.errors.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {sync.errors.map((error, index) => (
                          <div
                            key={index}
                            className="bg-white p-3 rounded border border-red-200"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-medium text-red-600">
                                {error.type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {error.timestamp
                                  ? new Date(error.timestamp).toLocaleString()
                                  : ''}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">
                              {error.message}
                            </p>
                            {error.context && (
                              <pre className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(error.context, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
