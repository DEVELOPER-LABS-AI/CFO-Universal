/**
 * Unmapped Contacts Count API
 *
 * Returns count of Xero contacts that couldn't be automatically mapped to clients.
 * These are contacts from failed invoice syncs with MAPPING_FAILED errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user's organization (throws on auth failure or missing org)
    const organizationId = await getOrganizationId();

    // Get Xero connection for this organization
    const connection = await prisma.xeroConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({
        count: 0,
        message: 'No Xero connection found',
      });
    }

    // Count unmapped contacts from sync logs
    // These are contacts that appear in MAPPING_FAILED errors
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
      take: 50, // Check recent sync logs
    });

    // Extract unique unmapped contact IDs from errors
    const unmappedContacts = new Set<string>();

    syncLogs.forEach((log) => {
      if (log.errors && Array.isArray(log.errors)) {
        const errors = log.errors as any[];
        errors.forEach((error: any) => {
          if (error.type === 'MAPPING_FAILED' && error.invoice_id) {
            unmappedContacts.add(error.contact_name || error.invoice_id);
          }
        });
      }
    });

    return NextResponse.json({
      count: unmappedContacts.size,
      message: unmappedContacts.size > 0
        ? `${unmappedContacts.size} contacts need manual mapping`
        : 'All contacts are mapped',
    });
  } catch (error) {
    console.error('Unmapped contacts count error:', error);

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
        error: 'Failed to fetch unmapped contacts count',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
