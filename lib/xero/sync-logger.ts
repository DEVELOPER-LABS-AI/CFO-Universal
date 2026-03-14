/**
 * Xero Sync Error Logger
 *
 * Utilities for logging errors to sync_log.errors JSONB array.
 *
 * Error format:
 * {
 *   type: 'API_ERROR' | 'MAPPING_FAILED' | 'CATEGORIZATION_FAILED' | 'RATE_LIMIT' | 'SYNC_ERROR',
 *   message: string,
 *   context: object,
 *   timestamp: ISO8601 string,
 *   http_status?: number,
 *   retry_count?: number,
 *   ...additional fields
 * }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type SyncErrorType =
  | 'API_ERROR'
  | 'MAPPING_FAILED'
  | 'CATEGORIZATION_FAILED'
  | 'RATE_LIMIT'
  | 'SYNC_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR';

export interface SyncError {
  type: SyncErrorType;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  http_status?: number;
  retry_count?: number;
  stack?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Format error object for sync log
 *
 * @param type - Error type category
 * @param message - Human-readable error message
 * @param context - Additional context (invoice ID, contact name, etc.)
 * @param error - Original error object (optional)
 * @returns Formatted SyncError object
 */
export function formatSyncError(
  type: SyncErrorType,
  message: string,
  context?: Record<string, any>,
  error?: any
): SyncError {
  const syncError: SyncError = {
    type,
    message,
    context: context || {},
    timestamp: new Date().toISOString(),
  };

  // Extract HTTP status code if available
  if (error?.response?.status || error?.statusCode || error?.status) {
    syncError.http_status =
      error.response?.status || error.statusCode || error.status;
  }

  // Add stack trace for debugging (only in development)
  if (process.env.NODE_ENV !== 'production' && error?.stack) {
    syncError.stack = error.stack;
  }

  // Add any additional error properties
  if (error?.code) {
    syncError.error_code = error.code;
  }

  return syncError;
}

/**
 * Add error to sync log's errors array
 *
 * Appends error to the JSONB errors array in the sync_log record.
 *
 * @param syncLogId - Sync log UUID
 * @param errorObj - Formatted SyncError object
 */
export async function addSyncError(
  syncLogId: string,
  errorObj: SyncError
): Promise<void> {
  try {
    // Get current errors array
    const syncLog = await prisma.xeroSyncLog.findUnique({
      where: { id: syncLogId },
      select: { errors: true },
    });

    if (!syncLog) {
      console.error(`Sync log ${syncLogId} not found`);
      return;
    }

    // Append new error to array
    const updatedErrors = [...(syncLog.errors as any[]), errorObj];

    // Update sync log
    await prisma.xeroSyncLog.update({
      where: { id: syncLogId },
      data: {
        errors: updatedErrors,
      },
    });

    console.log(
      `Added ${errorObj.type} error to sync log ${syncLogId}: ${errorObj.message}`
    );
  } catch (error) {
    console.error('Failed to add error to sync log:', error);
  }
}

/**
 * Add multiple errors to sync log in batch
 *
 * @param syncLogId - Sync log UUID
 * @param errors - Array of formatted SyncError objects
 */
export async function addSyncErrors(
  syncLogId: string,
  errors: SyncError[]
): Promise<void> {
  if (errors.length === 0) return;

  try {
    // Get current errors array
    const syncLog = await prisma.xeroSyncLog.findUnique({
      where: { id: syncLogId },
      select: { errors: true },
    });

    if (!syncLog) {
      console.error(`Sync log ${syncLogId} not found`);
      return;
    }

    // Append new errors to array
    const updatedErrors = [...(syncLog.errors as any[]), ...errors];

    // Update sync log
    await prisma.xeroSyncLog.update({
      where: { id: syncLogId },
      data: {
        errors: updatedErrors,
      },
    });

    console.log(`Added ${errors.length} errors to sync log ${syncLogId}`);
  } catch (error) {
    console.error('Failed to add errors to sync log:', error);
  }
}

/**
 * Get errors from sync log
 *
 * @param syncLogId - Sync log UUID
 * @returns Array of SyncError objects
 */
export async function getSyncErrors(syncLogId: string): Promise<SyncError[]> {
  try {
    const syncLog = await prisma.xeroSyncLog.findUnique({
      where: { id: syncLogId },
      select: { errors: true },
    });

    return (syncLog?.errors as SyncError[]) || [];
  } catch (error) {
    console.error('Failed to get sync errors:', error);
    return [];
  }
}

/**
 * Filter sync errors by type
 *
 * @param syncLogId - Sync log UUID
 * @param type - Error type to filter by
 * @returns Array of SyncError objects of the specified type
 */
export async function getSyncErrorsByType(
  syncLogId: string,
  type: SyncErrorType
): Promise<SyncError[]> {
  const allErrors = await getSyncErrors(syncLogId);
  return allErrors.filter((error) => error.type === type);
}

/**
 * Count errors by type
 *
 * @param syncLogId - Sync log UUID
 * @returns Object with error counts by type
 */
export async function countErrorsByType(
  syncLogId: string
): Promise<Record<SyncErrorType, number>> {
  const allErrors = await getSyncErrors(syncLogId);

  const counts: Record<string, number> = {};

  for (const error of allErrors) {
    counts[error.type] = (counts[error.type] || 0) + 1;
  }

  return counts as Record<SyncErrorType, number>;
}
