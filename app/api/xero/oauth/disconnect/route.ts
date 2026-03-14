/**
 * Xero OAuth Disconnect Endpoint
 *
 * Disconnects Xero integration by deleting connection and updating synced records.
 *
 * Flow:
 * 1. Verify user has admin or finance admin role
 * 2. Find xero_connection for user's organization
 * 3. Delete connection (CASCADE deletes related records)
 * 4. Update revenue_records and expense_records sync_status to MANUAL
 * 5. Create audit log entry
 * 6. Return success response
 *
 * @see specs/4-xero-integration/contracts/oauth.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function POST(request: NextRequest) {
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
        { error: 'Insufficient permissions. Admin or Finance Admin role required.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    if (!body.confirm) {
      return NextResponse.json(
        { error: 'Confirmation required. Set confirm: true in request body.' },
        { status: 400 }
      );
    }

    // Find Xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No Xero connection found for this organization' },
        { status: 404 }
      );
    }

    // Update revenue records to MANUAL sync status
    await prisma.revenueRecord.updateMany({
      where: {
        organization_id: organizationId,
        xero_invoice_id: { not: null },
      },
      data: {
        revenue_sync_status: 'MANUAL',
      },
    });

    // Update expense records to MANUAL sync status
    await prisma.expenseRecord.updateMany({
      where: {
        organization_id: organizationId,
        xero_expense_id: { not: null },
      },
      data: {
        expense_sync_status: 'MANUAL',
      },
    });

    // TODO: Add XERO_DISCONNECT to AuditActionType enum to enable audit logging
    // await prisma.auditLog.create({
    //   data: {
    //     organization_id: organizationId,
    //     actor_id: user.userId,
    //     action_type: 'XERO_DISCONNECT',
    //     action_details: {
    //       xero_tenant_id: connection.xero_tenant_id,
    //       connection_id: connection.id,
    //     },
    //     timestamp: new Date(),
    //   },
    // });

    // Delete connection (CASCADE deletes sync_logs, contact_mappings, expense_mappings)
    await prisma.xeroConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Xero connection disconnected successfully',
    });
  } catch (error) {
    console.error('Xero disconnect error:', error);

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
        error: 'Failed to disconnect Xero',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
