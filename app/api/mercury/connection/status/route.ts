/**
 * GET /api/mercury/connection/status
 * Get Mercury connection status for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { MercuryConnectionStatusResponse } from '@/types/mercury';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Find Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        connection_status: true,
        last_sync_at: true,
        last_sync_status: true,
        created_at: true,
        deleted_at: true,
      },
    });

    if (!connection || connection.deleted_at) {
      const response: MercuryConnectionStatusResponse = {
        connected: false,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: MercuryConnectionStatusResponse = {
      connected: connection.connection_status === 'ACTIVE',
      connection: {
        id: connection.id,
        organization_id: connection.organization_id,
        connection_status: connection.connection_status,
        last_sync_at: connection.last_sync_at?.toISOString() || null,
        last_sync_status: connection.last_sync_status,
        created_at: connection.created_at.toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error('Error fetching Mercury connection status:', error);
    return NextResponse.json(
      {
        connected: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
