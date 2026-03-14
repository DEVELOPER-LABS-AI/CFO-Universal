/**
 * Mercury Sync History Section (Client Component)
 *
 * Wraps SyncHistoryTable with retry logic.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SyncHistoryTable } from './SyncHistoryTable';
import { getErrorMessage } from '@/lib/utils/error';

interface SyncHistorySectionProps {
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
  organizationId: string;
}

export function SyncHistorySection({ syncHistory, organizationId }: SyncHistorySectionProps) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async (syncLogId: string) => {
    try {
      setRetrying(syncLogId);
      setRetryError(null);

      const response = await fetch('/api/mercury/sync/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncLogId,
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry sync');
      }

      // Refresh the page to show new sync
      router.refresh();
    } catch (err: unknown) {
      console.error('Error retrying sync:', err);
      setRetryError(getErrorMessage(err) || 'Failed to retry sync');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-4">
      {retryError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{retryError}</p>
        </div>
      )}

      <SyncHistoryTable
        syncHistory={syncHistory}
        onRetry={handleRetry}
      />

      {retrying && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <div className="flex items-center gap-3">
              <svg
                className="animate-spin h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-gray-900 font-medium">Retrying sync...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
