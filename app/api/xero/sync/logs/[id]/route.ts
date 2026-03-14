/**
 * Xero Sync Log Detail API Endpoint
 *
 * Returns detailed sync log including full errors array.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get authenticated user's organization (throws on auth failure or missing org)
    const organizationId = await getOrganizationId();

    // Get sync log with connection verification (RLS)
    const syncLog = await prisma.xeroSyncLog.findFirst({
      where: {
        id,
        connection: {
          organization_id: organizationId,
        },
      },
      include: {
        connection: {
          select: {
            xero_tenant_id: true,
            organization_id: true,
          },
        },
      },
    });

    if (!syncLog) {
      return NextResponse.json(
        { error: 'Sync log not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ sync_log: syncLog });
  } catch (error) {
    console.error('Sync log detail error:', error);

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
        error: 'Failed to get sync log details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
