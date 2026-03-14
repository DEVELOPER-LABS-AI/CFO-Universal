/**
 * Manual Sync Button Component
 *
 * Triggers a manual full sync (invoices + expenses).
 */

'use client';

import React, { useState } from 'react';

interface ManualSyncButtonProps {
  onSyncComplete?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ManualSyncButton({
  onSyncComplete,
  disabled = false,
  className = '',
}: ManualSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);

      const response = await fetch('/api/xero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_type: 'FULL',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start sync');
      }

      const data = await response.json();

      // Call onSyncComplete callback
      if (onSyncComplete) {
        onSyncComplete();
      }

      console.log('Sync started:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
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
              className="animate-spin h-4 w-4"
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
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

      {error && (
        <p className="text-sm text-red-600">
          Error: {error}
        </p>
      )}
    </div>
  );
}
