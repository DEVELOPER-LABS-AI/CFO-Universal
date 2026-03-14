/**
 * Mercury Sync History Table Component
 *
 * Displays sync history with expandable error details.
 * Shows last 50 syncs by default with pagination.
 */

'use client';

import React, { useState } from 'react';
import type { MercurySyncLog } from '@prisma/client';

interface SyncHistoryTableProps {
  syncHistory: Array<{
    id: string;
    sync_type: string;
    sync_status: string;
    started_at: string;
    completed_at: string | null;
    records_processed: number | null;
    records_created: number | null;
    records_failed: number | null;
    error_message: string | null;
  }>;
  onRetry?: (syncLogId: string) => void;
}

export function SyncHistoryTable({ syncHistory, onRetry }: SyncHistoryTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      SUCCESS: { color: 'bg-green-100 text-green-800', label: 'Success' },
      PARTIAL_SUCCESS: { color: 'bg-yellow-100 text-yellow-800', label: 'Partial Success' },
      FAILED: { color: 'bg-red-100 text-red-800', label: 'Failed' },
      IN_PROGRESS: { color: 'bg-blue-100 text-blue-800', label: 'Running' },
    };

    const { color, label } = config[status as keyof typeof config] || {
      color: 'bg-gray-100 text-gray-800',
      label: status,
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${color}`}>
        {label}
      </span>
    );
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return 'Running...';

    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const durationMs = end - start;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (syncHistory.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No sync history yet. Trigger your first sync to see results here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date/Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Processed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Failed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {syncHistory.map((sync) => (
            <React.Fragment key={sync.id}>
              <tr
                className={`hover:bg-gray-50 cursor-pointer ${
                  expandedRow === sync.id ? 'bg-gray-50' : ''
                }`}
                onClick={() => toggleRow(sync.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(sync.started_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {sync.sync_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(sync.sync_status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sync.records_processed || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                  {sync.records_created || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                  {sync.records_failed || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDuration(sync.started_at, sync.completed_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {sync.sync_status === 'FAILED' && onRetry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(sync.id);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>

              {/* Expanded Row - Error Details */}
              {expandedRow === sync.id && sync.error_message && (
                <tr>
                  <td colSpan={8} className="px-6 py-4 bg-red-50 border-l-4 border-red-400">
                    <div className="text-sm">
                      <p className="font-semibold text-red-900 mb-2">Error Details:</p>
                      <pre className="text-red-800 whitespace-pre-wrap font-mono text-xs bg-red-100 p-3 rounded">
                        {sync.error_message}
                      </pre>
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
