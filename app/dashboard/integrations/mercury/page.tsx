/**
 * Mercury Integration Dashboard Page
 *
 * Displays:
 * - Mercury connection status (ACTIVE/DISCONNECTED/API_ERROR)
 * - Connect/Disconnect buttons
 * - Sync history table (placeholder for Phase 5)
 * - Manual sync button (placeholder for Phase 4)
 */

import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { ConnectionStatus } from '@/components/mercury/ConnectionStatus';
import { ConnectMercuryButton } from '@/components/mercury/ConnectMercuryButton';
import { DisconnectMercuryButton } from '@/components/mercury/DisconnectMercuryButton';
import { SyncHistorySection } from '@/components/mercury/SyncHistorySection';
import { MercurySyncButtons } from '@/components/mercury/MercurySyncButtons';
import { SyncStatsDashboard } from '@/components/mercury/SyncStatsDashboard';
import { AwsLogsSection } from '@/components/mercury/AwsLogsSection';
import { MercuryAccordionSection } from '@/components/mercury/MercuryAccordionSection';

async function getConnectionStatus() {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();

  // Get Mercury connection if exists
  const connection = await prisma.mercuryConnection.findUnique({
    where: { organization_id: organizationId },
  });

  let syncHistory: any[] = [];
  let syncStats: any = null;
  let expenseStats: any = null;
  let unmappedCount = 0;
  let uncategorizedCount = 0;

  if (connection) {
    // Get sync history (last 30)
    syncHistory = await prisma.mercurySyncLog.findMany({
      where: { connection_id: connection.id },
      orderBy: { started_at: 'desc' },
      take: 30,
      select: {
        id: true,
        sync_type: true,
        status: true,
        started_at: true,
        completed_at: true,
        duration_ms: true,
        transactions_processed: true,
        transactions_failed: true,
        balances_updated: true,
        errors: true,
        triggered_by: true,
      },
    });

    // Get sync stats (last 90 days)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const logs = await prisma.mercurySyncLog.findMany({
      where: {
        connection_id: connection.id,
        started_at: { gte: since },
      },
      select: {
        status: true,
        transactions_processed: true,
        transactions_failed: true,
        balances_updated: true,
        started_at: true,
        completed_at: true,
        duration_ms: true,
      },
    });

    const total = logs.length;
    const successful = logs.filter((l) => l.status === 'SUCCESS').length;
    const partial = logs.filter((l) => l.status === 'PARTIAL').length;
    const failed = logs.filter((l) => l.status === 'FAILED').length;
    const totalProcessed = logs.reduce((sum, l) => sum + (l.transactions_processed || 0), 0);
    const totalFailed = logs.reduce((sum, l) => sum + (l.transactions_failed || 0), 0);
    const totalCreated = totalProcessed - totalFailed; // Successfully created records

    const durations = logs
      .filter((l) => l.duration_ms)
      .map((l) => l.duration_ms!);
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    syncStats = {
      period_days: 90,
      total_syncs: total,
      successful_syncs: successful,
      partial_success_syncs: partial,
      failed_syncs: failed,
      success_rate: total > 0 ? successful / total : 0,
      total_records_processed: totalProcessed,
      total_records_created: totalCreated,
      total_records_failed: totalFailed,
      error_rate: totalProcessed > 0 ? totalFailed / totalProcessed : 0,
      avg_duration_ms: Math.round(avgDuration),
    };

    // Get expense stats
    const totalExpenses = await prisma.expenseRecord.count({
      where: {
        organization_id: organizationId,
        mercury_transaction_id: { not: null },
      },
    });

    const byCategory = await prisma.expenseRecord.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        mercury_transaction_id: { not: null },
      },
      _count: true,
    });

    expenseStats = {
      totals: { expenses: totalExpenses },
      breakdown: { by_category: byCategory },
    };

    // Get unmapped merchants count
    unmappedCount = await prisma.merchantMappingCache.count({
      where: {
        connection_id: connection.id,
        contractor_id: null,
      },
    });

    // Get uncategorized expenses count (category = OTHER)
    uncategorizedCount = await prisma.expenseRecord.count({
      where: {
        organization_id: organizationId,
        mercury_transaction_id: { not: null },
        category: 'OTHER',
      },
    });
  }

  return {
    connection,
    organizationId,
    userRole: user.role,
    syncHistory: syncHistory.map((log) => ({
      ...log,
      started_at: log.started_at.toISOString(),
      completed_at: log.completed_at?.toISOString() || null,
    })),
    syncStats,
    expenseStats,
    unmappedCount,
    uncategorizedCount,
  };
}

export default async function MercuryIntegrationPage() {
  const { connection, organizationId, userRole, syncHistory, syncStats, expenseStats, unmappedCount, uncategorizedCount } = await getConnectionStatus();
  const isConnected = connection && connection.connection_status === 'ACTIVE' && !connection.deleted_at;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mercury Integration</h1>
      </div>

      {/* Connection Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Connection Status
        </h2>

        {connection && !connection.deleted_at ? (
          <div className="space-y-4">
            <ConnectionStatus
              status={connection.connection_status as any}
              lastSyncAt={connection.last_sync_at}
            />

            <div className="pt-4 border-t border-gray-200">
              {connection.connection_status === 'ACTIVE' ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <p className="mb-1">
                      Connected on {new Date(connection.created_at).toLocaleDateString()}
                    </p>
                    {connection.last_sync_at && (
                      <p>
                        Last sync: {new Date(connection.last_sync_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <DisconnectMercuryButton organizationId={organizationId} />
                </div>
              ) : connection.connection_status === 'API_ERROR' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      API error detected. Please reconnect your Mercury account.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <ConnectMercuryButton organizationId={organizationId} />
                    <DisconnectMercuryButton organizationId={organizationId} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <ConnectMercuryButton organizationId={organizationId} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connect your Mercury Bank account to automatically sync transactions and track expenses.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                What you'll get:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Automatic transaction import from Mercury</li>
                <li>Smart merchant-to-contractor mapping</li>
                <li>Intelligent expense categorization</li>
                <li>Real-time cash flow visibility</li>
                <li>Multi-account balance tracking</li>
              </ul>
            </div>

            <ConnectMercuryButton organizationId={organizationId} />
          </div>
        )}
      </div>

      {/* Sync Buttons */}
      {isConnected && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Sync Transactions
          </h2>
          <MercurySyncButtons
            organizationId={organizationId}
            hasExistingTransactions={syncStats?.total_records_created > 0}
            lastSyncAt={connection?.last_sync_at}
          />
        </div>
      )}

      {/* Sync Statistics Dashboard */}
      {isConnected && syncStats && (
        <div className="mb-6">
          <SyncStatsDashboard
            syncStats={syncStats}
            expenseStats={expenseStats}
            unmappedMerchantsCount={unmappedCount}
            uncategorizedExpensesCount={uncategorizedCount}
            organizationId={organizationId}
          />
        </div>
      )}

      {/* Merchants & Expenses Accordion */}
      {isConnected && (
        <div className="mb-6">
          <MercuryAccordionSection
            organizationId={organizationId}
            unmappedMerchantsCount={unmappedCount}
            uncategorizedExpensesCount={uncategorizedCount}
          />
        </div>
      )}

      {/* Sync History - Operation Logs */}
      {isConnected && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mercury Sync Operations
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            History of Mercury transaction sync operations and their results
          </p>
          <SyncHistorySection
            syncHistory={syncHistory}
            organizationId={organizationId}
          />
        </div>
      )}

      {/* AWS Lambda Logs - Separate from Operation Logs */}
      {isConnected && (
        <div className="mb-6">
          <AwsLogsSection organizationId={organizationId} />
        </div>
      )}
    </div>
  );
}
