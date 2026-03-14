/**
 * GET /api/clients
 *
 * Returns active clients for the authenticated user's organization.
 * Used by Xero contact mapping UI to populate the client dropdown.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET() {
  try {
    const organizationId = await getOrganizationId();

    const clients = await prisma.client.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Failed to fetch clients:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
