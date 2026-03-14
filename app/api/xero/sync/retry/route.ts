/**
 * Xero Sync Retry API Endpoint
 *
 * Retries a failed or partial sync job.
 *
 * Flow:
 * 1. Verify user has admin or finance admin role
 * 2. Find original sync_log, verify status is FAILED or PARTIAL
 * 3. Create new sync_log with triggered_by=RETRY
 * 4. Execute sync using same sync_type as original
 * 5. Return new sync_log_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getXeroClientWithTokenRefresh } from '@/lib/xero/client';
import { syncInvoices } from '@/lib/xero/invoice-sync';
import { syncExpenses } from '@/lib/xero/expense-sync';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get authenticated user and organization
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Get user's role in the organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        user_id: user.userId,
        organization_id: organizationId,
      },
      select: { role: true },
    });

    // Verify user has admin or finance admin role
    const allowedRoles = ['owner', 'ADMIN', 'FINANCE_ADMIN'];
    if (!userOrg || !allowedRoles.includes(userOrg.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Admin or Finance Admin role required.',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sync_log_id } = body;

    if (!sync_log_id) {
      return NextResponse.json(
        { error: 'sync_log_id required' },
        { status: 400 }
      );
    }

    // Find original sync log
    const originalSyncLog = await prisma.xeroSyncLog.findFirst({
      where: {
        id: sync_log_id,
        connection: {
          organization_id: organizationId,
        },
      },
      include: {
        connection: true,
      },
    });

    if (!originalSyncLog) {
      return NextResponse.json(
        { error: 'Sync log not found or access denied' },
        { status: 404 }
      );
    }

    // Verify original sync can be retried (FAILED or PARTIAL)
    if (!['FAILED', 'PARTIAL'].includes(originalSyncLog.status)) {
      return NextResponse.json(
        {
          error: `Cannot retry sync with status ${originalSyncLog.status}. Only FAILED or PARTIAL syncs can be retried.`,
        },
        { status: 400 }
      );
    }

    // Verify connection is still ACTIVE
    if (originalSyncLog.connection.connection_status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: `Xero connection is ${originalSyncLog.connection.connection_status}. Cannot retry.`,
        },
        { status: 400 }
      );
    }

    // Create new sync log for retry
    const retrySyncLog = await prisma.xeroSyncLog.create({
      data: {
        connection_id: originalSyncLog.connection_id,
        sync_type: originalSyncLog.sync_type,
        status: 'PENDING',
        triggered_by: 'RETRY',
        started_at: new Date(),
      },
    });

    // Update to RUNNING
    await prisma.xeroSyncLog.update({
      where: { id: retrySyncLog.id },
      data: { status: 'RUNNING' },
    });

    // Get Xero client
    const { client, tenantId } = await getXeroClientWithTokenRefresh(
      organizationId
    );

    // Execute sync
    let invoicesProcessed = 0;
    let invoicesFailed = 0;
    let expensesProcessed = 0;
    let expensesFailed = 0;
    let contactsMapped = 0;
    let contactsUnmapped = 0;
    let errors: any[] = [];

    try {
      if (
        originalSyncLog.sync_type === 'INVOICES' ||
        originalSyncLog.sync_type === 'FULL'
      ) {
        const invoiceResult = await syncInvoices(
          organizationId,
          originalSyncLog.connection_id,
          client,
          tenantId
        );

        invoicesProcessed = invoiceResult.invoicesProcessed;
        invoicesFailed = invoiceResult.invoicesFailed;
        contactsMapped = invoiceResult.invoicesMapped;
        contactsUnmapped = invoiceResult.invoicesUnmapped;
        errors.push(...invoiceResult.errors);
      }

      if (
        originalSyncLog.sync_type === 'EXPENSES' ||
        originalSyncLog.sync_type === 'FULL'
      ) {
        const expenseResult = await syncExpenses(
          organizationId,
          originalSyncLog.connection_id,
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
        message:
          syncError instanceof Error ? syncError.message : 'Unknown error',
      });
    }

    // Calculate duration
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - new Date(retrySyncLog.started_at).getTime();

    // Determine final status
    let finalStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    if (invoicesFailed === 0 && expensesFailed === 0) {
      finalStatus = 'SUCCESS';
    } else if (
      invoicesProcessed === invoicesFailed &&
      expensesProcessed === expensesFailed
    ) {
      finalStatus = 'FAILED';
    } else {
      finalStatus = 'PARTIAL';
    }

    // Update retry sync log
    await prisma.xeroSyncLog.update({
      where: { id: retrySyncLog.id },
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

    // Update connection
    await prisma.xeroConnection.update({
      where: { id: originalSyncLog.connection_id },
      data: {
        last_sync_status:
          finalStatus === 'SUCCESS'
            ? 'SUCCESS'
            : finalStatus === 'FAILED'
            ? 'FAILED'
            : 'PARTIAL',
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      new_sync_log_id: retrySyncLog.id,
      original_sync_log_id: originalSyncLog.id,
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
    });
  } catch (error) {
    console.error('Sync retry error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to retry sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
