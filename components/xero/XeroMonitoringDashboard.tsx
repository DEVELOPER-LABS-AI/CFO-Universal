/**
 * Xero Monitoring Dashboard Component
 *
 * Integrates all monitoring components:
 * - Sync history table with expandable errors
 * - Manual sync button
 * - Unmapped contacts count
 * - Uncategorized expenses count
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { SyncHistoryTable } from './SyncHistoryTable';
import { ManualSyncButton } from './ManualSyncButton';
import { UnmappedContactsCount } from './UnmappedContactsCount';
import { UncategorizedExpensesCount } from './UncategorizedExpensesCount';

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

export function XeroMonitoringDashboard() {
  const [syncs, setSyncs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSyncHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/xero/sync/status');

      if (!response.ok) {
        throw new Error('Failed to fetch sync history');
      }

      const data = await response.json();
      setSyncs(data.recent_syncs || []);
    } catch (err) {
      console.error('Failed to load sync history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSyncHistory();
  }, [loadSyncHistory, refreshKey]);

  const handleSyncComplete = () => {
    // Refresh sync history when manual sync completes
    setRefreshKey((prev) => prev + 1);
  };

  const handleRetryComplete = () => {
    // Refresh sync history when retry completes
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Action Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UnmappedContactsCount />
        <UncategorizedExpensesCount />
        <div className="p-4 border rounded-lg bg-blue-50 border-blue-200 flex items-center justify-center">
          <ManualSyncButton onSyncComplete={handleSyncComplete} />
        </div>
      </div>

      {/* Sync History Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
          {!loading && syncs.length > 0 && (
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        ) : syncs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm font-medium">No sync history yet</p>
            <p className="text-xs text-gray-400 mt-2">
              Click "Sync Now" to start your first sync
            </p>
          </div>
        ) : (
          <SyncHistoryTable syncs={syncs} onRetry={handleRetryComplete} />
        )}
      </div>
    </div>
  );
}
