/**
 * All Xero Contact Mappings API
 *
 * Returns all XeroContactMapping records for the authenticated user's organization.
 * Includes the related client name for display in the UI.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET() {
  try {
    const organizationId = await getOrganizationId();

    // Find xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ mappings: [], total: 0 });
    }

    // Query all XeroContactMapping records for this connection
    const mappings = await prisma.xeroContactMapping.findMany({
      where: {
        connection_id: connection.id,
      },
      include: {
        client: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      mappings,
      total: mappings.length,
    });
  } catch (error) {
    console.error('All mappings fetch error:', error);

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
        error: 'Failed to fetch contact mappings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
