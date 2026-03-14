/**
 * Manual Sync Button Component
 *
 * Triggers manual Mercury sync with progress indicator.
 * Shows sync results in a toast or modal.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils/error';

interface ManualSyncButtonProps {
  organizationId: string;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
}

export function ManualSyncButton({
  organizationId,
  disabled = false,
  onSuccess,
  className = '',
}: ManualSyncButtonProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/mercury/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          syncType: 'both', // transactions + balances
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Mercury data');
      }

      setResult(data.results);

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Error syncing Mercury:', err);
      setError(getErrorMessage(err) || 'Failed to sync Mercury data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={disabled || isSyncing}
        className={`
          inline-flex items-center gap-2 px-4 py-2
          bg-blue-600 hover:bg-blue-700
          text-white font-medium rounded-lg
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isSyncing ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
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
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Sync Now</span>
          </>
        )}
      </button>

      {/* Success Result */}
      {result && !error && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Sync completed successfully!</p>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                {result.transactions && (
                  <p>
                    Transactions: {result.transactions.created} created, {result.transactions.skipped} skipped,{' '}
                    {result.transactions.failed} failed
                  </p>
                )}
                {result.balances && (
                  <p>
                    Balances: {result.balances.created} accounts synced
                  </p>
                )}
                <p className="text-xs text-green-600">
                  Duration: {result.transactions?.duration_ms || 0}ms
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Sync failed</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
