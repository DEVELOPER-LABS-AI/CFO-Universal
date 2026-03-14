/**
 * POST /api/mercury/disconnect
 * Disconnect Mercury Bank account (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin();
    const organizationId = await getOrganizationId();

    // Find Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'No Mercury connection found for this organization' },
        { status: 404 }
      );
    }

    if (connection.connection_status === 'DISCONNECTED' && connection.deleted_at) {
      return NextResponse.json(
        { success: false, error: 'Mercury account is already disconnected' },
        { status: 400 }
      );
    }

    // Soft delete connection (set deleted_at and update status)
    await prisma.mercuryConnection.update({
      where: { id: connection.id },
      data: {
        connection_status: 'DISCONNECTED',
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Mercury account disconnected successfully',
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error disconnecting Mercury:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
