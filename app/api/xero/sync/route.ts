/**
 * Xero Sync Job Orchestration Endpoint
 *
 * Triggers invoice and/or expense sync jobs.
 *
 * Authorization:
 * - Bearer {CRON_SECRET} header (for scheduled cron jobs)
 * - OR admin user session (for manual sync)
 *
 * Flow:
 * 1. Validate authorization
 * 2. Get organization_id from request or session
 * 3. Verify Xero connection is ACTIVE
 * 4. Create sync_log with PENDING status
 * 5. Execute sync (invoices, expenses, or both)
 * 6. Update sync_log with results
 * 7. Return sync_log_id and duration
 *
 * @see specs/4-xero-integration/contracts/sync.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { getXeroClientWithTokenRefresh } from '@/lib/xero/client';
import { syncInvoices } from '@/lib/xero/invoice-sync';
import { syncExpenses } from '@/lib/xero/expense-sync';

type SyncType = 'INVOICES' | 'EXPENSES' | 'FULL';
type SyncTrigger = 'SCHEDULED' | 'MANUAL' | 'RETRY';

interface SyncRequest {
  organization_id?: string;
  sync_type?: SyncType;
}

/**
 * Validate authorization
 * - CRON_SECRET bearer token for scheduled jobs
 * - OR authenticated admin user for manual sync
 */
async function validateAuthorization(
  request: NextRequest
): Promise<{ authorized: boolean; userId?: string; isCronJob: boolean }> {
  // Check for CRON_SECRET bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.CRON_SECRET) {
      return { authorized: true, isCronJob: true };
    }
  }

  // Check for authenticated admin user session
  const user = await getCurrentUser();
  if (user && user.role === 'ADMIN') {
    return { authorized: true, userId: user.userId, isCronJob: false };
  }

  return { authorized: false, isCronJob: false };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate authorization
    const auth = await validateAuthorization(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role or valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SyncRequest = await request.json();
    const syncType: SyncType = body.sync_type || 'FULL';

    // Get organization_id from request body (cron) or user session (manual)
    let organizationId = body.organization_id;

    if (!organizationId && auth.userId) {
      // Manual sync - get org from user's organization membership
      const userOrg = await prisma.userOrganization.findFirst({
        where: { user_id: auth.userId },
        select: { organization_id: true },
      });
      organizationId = userOrg?.organization_id;
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Find Xero connection
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Xero connection not found for this organization' },
        { status: 404 }
      );
    }

    if (connection.connection_status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Xero connection is ${connection.connection_status}. Cannot sync.`,
        },
        { status: 400 }
      );
    }

    // Create sync log with PENDING status
    const syncLog = await prisma.xeroSyncLog.create({
      data: {
        connection_id: connection.id,
        sync_type: syncType,
        status: 'PENDING',
        triggered_by: auth.isCronJob ? 'SCHEDULED' : 'MANUAL',
        started_at: new Date(),
      },
    });

    // Update sync log to RUNNING
    await prisma.xeroSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'RUNNING',
      },
    });

    // Get Xero client with token refresh
    const { client, tenantId } = await getXeroClientWithTokenRefresh(
      organizationId
    );

    // Execute sync based on type
    let invoicesProcessed = 0;
    let invoicesFailed = 0;
    let expensesProcessed = 0;
    let expensesFailed = 0;
    let contactsMapped = 0;
    let contactsUnmapped = 0;
    let errors: any[] = [];

    try {
      if (syncType === 'INVOICES' || syncType === 'FULL') {
        const invoiceResult = await syncInvoices(
          organizationId,
          connection.id,
          client,
          tenantId
        );

        invoicesProcessed = invoiceResult.invoicesProcessed;
        invoicesFailed = invoiceResult.invoicesFailed;
        contactsMapped = invoiceResult.invoicesMapped;
        contactsUnmapped = invoiceResult.invoicesUnmapped;
        errors.push(...invoiceResult.errors);
      }

      // Sync expenses if requested
      if (syncType === 'EXPENSES' || syncType === 'FULL') {
        const expenseResult = await syncExpenses(
          organizationId,
          connection.id,
          client,
          tenantId
        );

        expensesProcessed = expenseResult.expensesProcessed;
        expensesFailed = expenseResult.expensesFailed;
        errors.push(...expenseResult.errors);
      }
    } catch (syncError) {
      errors.push({
        type: 'SYNC_ERROR',
        message: syncError instanceof Error ? syncError.message : 'Unknown error',
      });
    }

    // Calculate duration
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - new Date(syncLog.started_at).getTime();

    // Determine final status
    let finalStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    if (invoicesFailed === 0 && expensesFailed === 0) {
      finalStatus = 'SUCCESS';
    } else if (invoicesProcessed === invoicesFailed && expensesProcessed === expensesFailed) {
      finalStatus = 'FAILED';
    } else {
      finalStatus = 'PARTIAL';
    }

    // Update sync log with results
    await prisma.xeroSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: finalStatus,
        completed_at: completedAt,
        duration_ms: durationMs,
        invoices_processed: invoicesProcessed,
        invoices_failed: invoicesFailed,
        expenses_processed: expensesProcessed,
        expenses_failed: expensesFailed,
        contacts_mapped: contactsMapped,
        contacts_unmapped: contactsUnmapped,
        errors: errors,
      },
    });

    // Update connection with last sync status
    await prisma.xeroConnection.update({
      where: { id: connection.id },
      data: {
        last_sync_status: finalStatus === 'SUCCESS' ? 'SUCCESS' : finalStatus === 'FAILED' ? 'FAILED' : 'PARTIAL',
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      sync_log_id: syncLog.id,
      status: finalStatus,
      duration_ms: durationMs,
      summary: {
        invoices_processed: invoicesProcessed,
        invoices_failed: invoicesFailed,
        expenses_processed: expensesProcessed,
        expenses_failed: expensesFailed,
        contacts_mapped: contactsMapped,
        contacts_unmapped: contactsUnmapped,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Sync job error:', error);

    return NextResponse.json(
      {
        error: 'Sync job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
