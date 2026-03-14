/**
 * Xero Sync Status API Endpoint
 *
 * Returns current connection status and recent sync history.
 *
 * Response:
 * - connection: Xero connection with status and last_sync_at
 * - current_sync: Active sync (status=RUNNING) if any
 * - recent_syncs: Last 50 sync logs with pagination
 * - pagination: { total, offset, limit }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user's organization (throws on auth failure or missing org)
    const organizationId = await getOrganizationId();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10),
      100
    );

    // Get Xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
      select: {
        id: true,
        xero_tenant_id: true,
        connection_status: true,
        last_sync_at: true,
        last_sync_status: true,
        scopes_granted: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        connection: null,
        current_sync: null,
        recent_syncs: [],
        pagination: { total: 0, offset: 0, limit },
      });
    }

    // Check for currently running sync
    const currentSync = await prisma.xeroSyncLog.findFirst({
      where: {
        connection_id: connection.id,
        status: 'RUNNING',
      },
      orderBy: {
        started_at: 'desc',
      },
    });

    // Get recent sync logs with pagination
    const [recentSyncs, totalCount] = await Promise.all([
      prisma.xeroSyncLog.findMany({
        where: {
          connection_id: connection.id,
        },
        orderBy: {
          started_at: 'desc',
        },
        skip: offset,
        take: limit,
        select: {
          id: true,
          sync_type: true,
          status: true,
          started_at: true,
          completed_at: true,
          duration_ms: true,
          invoices_processed: true,
          invoices_failed: true,
          expenses_processed: true,
          expenses_failed: true,
          contacts_mapped: true,
          contacts_unmapped: true,
          errors: true,
          triggered_by: true,
        },
      }),
      prisma.xeroSyncLog.count({
        where: {
          connection_id: connection.id,
        },
      }),
    ]);

    return NextResponse.json({
      connection,
      current_sync: currentSync,
      recent_syncs: recentSyncs,
      pagination: {
        total: totalCount,
        offset,
        limit,
      },
    });
  } catch (error) {
    console.error('Sync status error:', error);

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
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
