/**
 * Mercury Sync Logger
 *
 * Records sync operations to mercury_sync_logs table.
 * Tracks sync history, performance, and error details.
 */

import { prisma } from '@/lib/prisma';
import type { MercurySyncType, MercurySyncStatus } from '@prisma/client';
import type { TransactionSyncResult } from '@/types/mercury';
import { createRetryMetadata } from './retry';

/**
 * Start a new sync log entry
 *
 * @param connectionId - Mercury connection ID
 * @param syncType - Type of sync operation
 * @returns Sync log ID
 */
export async function startSyncLog(
  connectionId: string,
  syncType: MercurySyncType,
  triggeredBy: 'SYSTEM' | 'MANUAL' | 'RETRY' = 'SYSTEM',
  triggeredByUserId?: string
): Promise<string> {
  const log = await prisma.mercurySyncLog.create({
    data: {
      connection_id: connectionId,
      sync_type: syncType,
      status: 'RUNNING',
      started_at: new Date(),
      transactions_processed: 0,
      transactions_failed: 0,
      balances_updated: 0,
      triggered_by: triggeredBy,
      triggered_by_user_id: triggeredByUserId,
    },
  });

  console.log(`[Sync Logger] Started sync log ${log.id} for connection ${connectionId}`);

  return log.id;
}

/**
 * Complete a sync log entry
 *
 * @param syncLogId - Sync log ID
 * @param result - Sync result with counts and errors
 */
export async function completeSyncLog(
  syncLogId: string,
  result: TransactionSyncResult
): Promise<void> {
  const syncStatus: MercurySyncStatus =
    result.success && result.failed === 0
      ? 'SUCCESS'
      : result.success && result.failed > 0
      ? 'PARTIAL'
      : 'FAILED';

  const completedAt = new Date();

  // Get start time to calculate duration
  const syncLog = await prisma.mercurySyncLog.findUnique({
    where: { id: syncLogId },
    select: { started_at: true },
  });

  const durationMs = syncLog
    ? completedAt.getTime() - syncLog.started_at.getTime()
    : null;

  await prisma.mercurySyncLog.update({
    where: { id: syncLogId },
    data: {
      status: syncStatus,
      completed_at: completedAt,
      duration_ms: durationMs,
      transactions_processed: result.processed,
      transactions_failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : [],
    },
  });

  console.log(`[Sync Logger] Completed sync log ${syncLogId}: ${syncStatus} (${result.processed} processed, ${result.failed} failed)`);
}

/**
 * Update sync log progress
 *
 * @param syncLogId - Sync log ID
 * @param processed - Number of records processed so far
 * @param created - Number of records created so far
 * @param failed - Number of records failed so far
 */
export async function updateSyncProgress(
  syncLogId: string,
  processed: number,
  failed: number
): Promise<void> {
  await prisma.mercurySyncLog.update({
    where: { id: syncLogId },
    data: {
      transactions_processed: processed,
      transactions_failed: failed,
    },
  });
}

/**
 * Fail a sync log entry
 *
 * @param syncLogId - Sync log ID
 * @param errorMessage - Error message
 * @param errorDetails - Detailed error information
 */
export async function failSyncLog(
  syncLogId: string,
  errorMessage: string,
  errorDetails?: any
): Promise<void> {
  const completedAt = new Date();

  // Get start time to calculate duration
  const syncLog = await prisma.mercurySyncLog.findUnique({
    where: { id: syncLogId },
    select: { started_at: true },
  });

  const durationMs = syncLog
    ? completedAt.getTime() - syncLog.started_at.getTime()
    : null;

  const errorObject = {
    message: errorMessage,
    details: errorDetails,
    timestamp: completedAt.toISOString(),
  };

  await prisma.mercurySyncLog.update({
    where: { id: syncLogId },
    data: {
      status: 'FAILED',
      completed_at: completedAt,
      duration_ms: durationMs,
      errors: [errorObject],
    },
  });

  console.error(`[Sync Logger] Failed sync log ${syncLogId}: ${errorMessage}`);
}

/**
 * Get sync history for a connection
 *
 * @param connectionId - Mercury connection ID
 * @param limit - Maximum number of logs to return
 * @returns Array of sync logs
 */
export async function getSyncHistory(
  connectionId: string,
  limit: number = 30
) {
  return await prisma.mercurySyncLog.findMany({
    where: { connection_id: connectionId },
    orderBy: { started_at: 'desc' },
    take: limit,
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
}

/**
 * Get sync statistics for a connection
 *
 * @param connectionId - Mercury connection ID
 * @param days - Number of days to include in stats
 * @returns Sync statistics
 */
export async function getSyncStats(connectionId: string, days: number = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.mercurySyncLog.findMany({
    where: {
      connection_id: connectionId,
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
  const partialSuccess = logs.filter((l) => l.status === 'PARTIAL').length;
  const failed = logs.filter((l) => l.status === 'FAILED').length;

  const totalProcessed = logs.reduce((sum, l) => sum + (l.transactions_processed || 0), 0);
  const totalFailed = logs.reduce((sum, l) => sum + (l.transactions_failed || 0), 0);

  // Calculate average duration
  const durations = logs
    .filter((l) => l.duration_ms)
    .map((l) => l.duration_ms!);

  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  return {
    period_days: days,
    total_syncs: total,
    successful_syncs: successful,
    partial_success_syncs: partialSuccess,
    failed_syncs: failed,
    success_rate: total > 0 ? successful / total : 0,
    total_records_processed: totalProcessed,
    total_records_failed: totalFailed,
    error_rate: totalProcessed > 0 ? totalFailed / totalProcessed : 0,
    avg_duration_ms: Math.round(avgDuration),
  };
}

/**
 * Get latest sync for a connection
 *
 * @param connectionId - Mercury connection ID
 * @returns Latest sync log or null
 */
export async function getLatestSync(connectionId: string) {
  return await prisma.mercurySyncLog.findFirst({
    where: { connection_id: connectionId },
    orderBy: { started_at: 'desc' },
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
}

/**
 * Add a detailed error to sync log
 *
 * Appends error to the errors JSONB array with full context.
 *
 * @param syncLogId - Sync log ID
 * @param error - Error object
 * @param context - Additional context (transaction_id, merchant_name, etc.)
 * @param retryAttempt - Retry attempt number (optional)
 */
export async function addSyncError(
  syncLogId: string,
  error: any,
  context: {
    transaction_id?: string;
    merchant_name?: string;
    account_id?: string;
    operation?: string;
  },
  retryAttempt?: number
): Promise<void> {
  const statusCode = error?.response?.status || error?.statusCode || error?.status;

  const errorObject = {
    type: error?.name || error?.errorType || 'SYNC_ERROR',
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    context: {
      ...context,
      http_status: statusCode,
      error_code: error?.code,
      retry_count: retryAttempt !== undefined ? retryAttempt : null,
    },
    stack: error?.stack ? error.stack.split('\n').slice(0, 5).join('\n') : null,
  };

  // Get current sync log
  const syncLog = await prisma.mercurySyncLog.findUnique({
    where: { id: syncLogId },
    select: { errors: true },
  });

  if (!syncLog) {
    console.error(`[Sync Logger] Sync log ${syncLogId} not found`);
    return;
  }

  // Append to errors array
  const currentErrors = (syncLog.errors as any[]) || [];
  const updatedErrors = [...currentErrors, errorObject];

  await prisma.mercurySyncLog.update({
    where: { id: syncLogId },
    data: {
      errors: updatedErrors,
    },
  });

  console.error(
    `[Sync Logger] Added error to sync log ${syncLogId}:`,
    errorObject.type,
    errorObject.message
  );
}

/**
 * Create a formatted error object for logging
 *
 * @param error - Error object
 * @param context - Error context
 * @returns Formatted error object
 */
export function formatSyncError(
  error: any,
  context: {
    transaction_id?: string;
    merchant_name?: string;
    account_id?: string;
    operation?: string;
    retry_attempt?: number;
  }
) {
  const statusCode = error?.response?.status || error?.statusCode || error?.status;

  return {
    type: error?.name || error?.errorType || 'UNKNOWN_ERROR',
    message: error?.message || String(error),
    context: {
      ...context,
      http_status: statusCode,
      error_code: error?.code,
    },
    timestamp: new Date().toISOString(),
  };
}
