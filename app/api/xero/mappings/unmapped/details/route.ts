/**
 * Unmapped Contacts Details API
 *
 * Returns detailed list of unmapped Xero contacts for manual mapping UI.
 * Extracts contacts from MAPPING_FAILED errors in sync logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

interface UnmappedContact {
  xero_contact_id: string;
  xero_contact_name: string;
  xero_contact_email?: string;
  invoice_count: number;
}

export async function GET(request: NextRequest) {
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

    // Verify admin or finance admin role
    const allowedRoles = ['owner', 'ADMIN', 'FINANCE_ADMIN'];
    if (!userOrg || !allowedRoles.includes(userOrg.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or Finance Admin role required.' },
        { status: 403 }
      );
    }

    // Get Xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({
        contacts: [],
        message: 'No Xero connection found',
      });
    }

    // Get sync logs with MAPPING_FAILED errors
    const syncLogs = await prisma.xeroSyncLog.findMany({
      where: {
        connection_id: connection.id,
        sync_type: 'INVOICES',
        OR: [
          { status: 'PARTIAL' },
          { status: 'FAILED' },
        ],
      },
      select: {
        errors: true,
      },
      orderBy: {
        started_at: 'desc',
      },
      take: 100, // Check recent sync logs
    });

    // Extract and aggregate unmapped contacts from errors
    const contactsMap = new Map<string, UnmappedContact>();

    syncLogs.forEach((log) => {
      if (log.errors && Array.isArray(log.errors)) {
        const errors = log.errors as any[];
        errors.forEach((error: any) => {
          if (error.type === 'MAPPING_FAILED') {
            const contactId = error.invoice_id || error.contact_name;
            const existing = contactsMap.get(contactId);

            if (existing) {
              existing.invoice_count++;
            } else {
              contactsMap.set(contactId, {
                xero_contact_id: contactId,
                xero_contact_name: error.contact_name || 'Unknown Contact',
                xero_contact_email: error.contact_email,
                invoice_count: 1,
              });
            }
          }
        });
      }
    });

    // Convert to array and sort by invoice count (descending)
    const contacts = Array.from(contactsMap.values()).sort(
      (a, b) => b.invoice_count - a.invoice_count
    );

    return NextResponse.json({
      contacts,
      total: contacts.length,
      message: contacts.length > 0
        ? `${contacts.length} unmapped contacts found`
        : 'No unmapped contacts',
    });
  } catch (error) {
    console.error('Unmapped contacts details error:', error);

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
        error: 'Failed to fetch unmapped contacts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
