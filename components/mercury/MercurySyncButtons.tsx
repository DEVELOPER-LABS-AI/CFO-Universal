/**
 * Mercury Sync Buttons Component
 *
 * Three sync modes:
 * 1. Test Sync - Syncs only 1 transaction (for testing)
 * 2. First Time Sync - Fetches ALL historical transactions
 * 3. Regular Sync - Fetches only new transactions since last sync
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/utils/error';

interface MercurySyncButtonsProps {
  organizationId: string;
  hasExistingTransactions?: boolean;
  lastSyncAt?: Date | null;
  disabled?: boolean;
}

type SyncMode = 'test' | 'first-time' | 'incremental';

export function MercurySyncButtons({
  organizationId,
  hasExistingTransactions = false,
  lastSyncAt,
  disabled = false,
}: MercurySyncButtonsProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSyncMode, setActiveSyncMode] = useState<SyncMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [batchProgress, setBatchProgress] = useState<{
    totalProcessed: number;
    totalCreated: number;
    totalSkipped: number;
    totalFailed: number;
    batchNumber: number;
  } | null>(null);

  /**
   * Execute a single sync API call and return parsed response.
   */
  const callSyncApi = async (
    mode: SyncMode,
    cursor?: string
  ): Promise<any> => {
    const response = await fetch('/api/mercury/sync/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        syncType: 'both',
        syncMode: mode,
        cursor: cursor || undefined,
      }),
    });

    const responseClone = response.clone();
    let data;
    try {
      data = await response.json();
    } catch {
      const text = await responseClone.text();
      throw new Error(
        response.status === 504
          ? 'Sync timed out. Try reducing batch size or contact support.'
          : `Server error: ${text.substring(0, 100)}`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to sync Mercury data');
    }

    return data;
  };

  const handleSync = async (mode: SyncMode) => {
    try {
      setIsSyncing(true);
      setActiveSyncMode(mode);
      setError(null);
      setResult(null);
      setBatchProgress(null);

      let cursor: string | undefined;
      let batchNumber = 0;
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let lastData: any;

      // Loop: process batches until no more data
      do {
        batchNumber++;
        const data = await callSyncApi(mode, cursor);
        lastData = data;

        // Accumulate totals from transaction results
        if (data.results?.transactions) {
          totalProcessed += data.results.transactions.processed || 0;
          totalCreated += data.results.transactions.created || 0;
          totalSkipped += data.results.transactions.skipped || 0;
          totalFailed += data.results.transactions.failed || 0;
        }

        setBatchProgress({ totalProcessed, totalCreated, totalSkipped, totalFailed, batchNumber });

        // Check if there are more batches
        if (data.hasMore && data.nextCursor) {
          cursor = data.nextCursor;
        } else {
          cursor = undefined;
        }
      } while (cursor);

      // Set final result with accumulated totals
      setResult({
        transactions: {
          ...(lastData.results?.transactions || {}),
          processed: totalProcessed,
          created: totalCreated,
          skipped: totalSkipped,
          failed: totalFailed,
        },
        balances: lastData.results?.balances,
      });
      setBatchProgress(null);
      router.refresh();
    } catch (err: unknown) {
      console.error('Error syncing Mercury:', err);
      setError(getErrorMessage(err) || 'Failed to sync Mercury data');
    } finally {
      setIsSyncing(false);
      setActiveSyncMode(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sync Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Test Sync Button */}
        <button
          onClick={() => handleSync('test')}
          disabled={disabled || isSyncing}
          className={`
            inline-flex flex-col items-center gap-2 px-4 py-3
            bg-gray-100 hover:bg-gray-200
            text-gray-900 font-medium rounded-lg border border-gray-300
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSyncing && activeSyncMode === 'test' ? (
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
              <span className="text-sm">Testing...</span>
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <div className="text-center">
                <div className="font-semibold">Test Sync</div>
                <div className="text-xs text-gray-600">1 transaction</div>
              </div>
            </>
          )}
        </button>

        {/* First Time Sync Button */}
        <button
          onClick={() => handleSync('first-time')}
          disabled={disabled || isSyncing}
          className={`
            inline-flex flex-col items-center gap-2 px-4 py-3
            bg-purple-600 hover:bg-purple-700
            text-white font-medium rounded-lg
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSyncing && activeSyncMode === 'first-time' ? (
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
              <span className="text-sm">Syncing all...</span>
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              <div className="text-center">
                <div className="font-semibold">First Time Sync</div>
                <div className="text-xs opacity-90">All history</div>
              </div>
            </>
          )}
        </button>

        {/* Regular Incremental Sync Button */}
        <button
          onClick={() => handleSync('incremental')}
          disabled={disabled || isSyncing}
          className={`
            inline-flex flex-col items-center gap-2 px-4 py-3
            bg-blue-600 hover:bg-blue-700
            text-white font-medium rounded-lg
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSyncing && activeSyncMode === 'incremental' ? (
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
              <span className="text-sm">Syncing...</span>
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
              <div className="text-center">
                <div className="font-semibold">Sync Now</div>
                <div className="text-xs opacity-90">New transactions</div>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Info Text */}
      <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="space-y-1">
          <p><strong>Test Sync:</strong> Fetches 1 transaction to verify connection</p>
          <p><strong>First Time Sync:</strong> Imports all historical transactions (use for initial setup)</p>
          <p><strong>Sync Now:</strong> Imports only new transactions since {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'last sync'}</p>
        </div>
      </div>

      {/* Batch Progress Indicator */}
      {batchProgress && isSyncing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Syncing in progress... (batch {batchProgress.batchNumber})
              </p>
              <div className="mt-1 text-sm text-blue-700">
                <p>{batchProgress.totalProcessed} transactions processed ({batchProgress.totalCreated} created, {batchProgress.totalSkipped} skipped)</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
