/**
 * Retry Button Component
 *
 * Allows admins to retry failed or partial syncs.
 * Triggers POST /api/xero/sync/retry with sync_log_id.
 */

'use client';

import { useState } from 'react';

export interface RetryButtonProps {
  syncLogId: string;
  onRetryComplete?: () => void;
  disabled?: boolean;
}

export function RetryButton({ syncLogId, onRetryComplete, disabled }: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (disabled || isRetrying) return;

    setIsRetrying(true);
    setError(null);

    try {
      const response = await fetch('/api/xero/sync/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_log_id: syncLogId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Retry failed');
      }

      const result = await response.json();
      console.log('Retry initiated:', result);

      // Notify parent component
      if (onRetryComplete) {
        onRetryComplete();
      }
    } catch (err) {
      console.error('Retry error:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry sync');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleRetry}
        disabled={disabled || isRetrying}
        className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        title="Retry this sync"
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
      {error && (
        <span className="mt-1 text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
