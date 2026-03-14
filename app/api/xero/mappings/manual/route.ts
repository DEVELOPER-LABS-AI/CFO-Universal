/**
 * Manual Contact Mapping API Endpoint
 *
 * Allows admins to manually map Xero contacts to internal clients.
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
        {
          error:
            'Insufficient permissions. Admin or Finance Admin role required.',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { xero_contact_id, xero_contact_name, client_id } = body;

    if (!xero_contact_id || !xero_contact_name || !client_id) {
      return NextResponse.json(
        { error: 'xero_contact_id, xero_contact_name, and client_id required' },
        { status: 400 }
      );
    }

    // Verify client belongs to user's organization
    const client = await prisma.client.findFirst({
      where: {
        id: client_id,
        organization_id: organizationId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or access denied' },
        { status: 404 }
      );
    }

    // Get Xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Xero connection not found for this organization' },
        { status: 404 }
      );
    }

    // Create or update manual mapping
    const mapping = await prisma.xeroContactMapping.upsert({
      where: {
        connection_id_xero_contact_id: {
          connection_id: connection.id,
          xero_contact_id,
        },
      },
      update: {
        client_id,
        mapping_type: 'MANUAL',
        confidence_score: 1.0,
        mapped_by_user_id: user.userId,
        updated_at: new Date(),
      },
      create: {
        connection_id: connection.id,
        xero_contact_id,
        xero_contact_name,
        client_id,
        mapping_type: 'MANUAL',
        confidence_score: 1.0,
        mapped_by_user_id: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      mapping,
    });
  } catch (error) {
    console.error('Manual mapping error:', error);

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
        error: 'Failed to create manual mapping',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
