/**
 * GET /api/mercury/expenses/uncategorized
 * Get uncategorized Mercury expenses (category = OTHER)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    // Get uncategorized expenses (category = OTHER) from Mercury
    const uncategorizedExpenses = await prisma.expenseRecord.findMany({
      where: {
        organization_id: organizationId,
        mercury_transaction_id: { not: null },
        category: 'OTHER',
      },
      select: {
        id: true,
        amount: true,
        transaction_date: true,
        description: true,
        category: true,
        contractor_id: true,
        client_id: true,
        mercury_transaction_id: true,
        merchant_name: true,
        contractor: {
          select: {
            id: true,
            name: true,
            engagement_type: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { transaction_date: 'desc' },
      ],
      take: 500, // Limit to prevent performance issues
    });

    // Get all contractors for dropdown
    const contractors = await prisma.contractor.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null, // Only active contractors
      },
      select: {
        id: true,
        name: true,
        engagement_type: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all clients for dropdown
    const clients = await prisma.client.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null, // Only active clients
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      uncategorized_expenses: uncategorizedExpenses,
      contractors,
      clients,
      count: uncategorizedExpenses.length,
    });
  } catch (error: unknown) {
    console.error('Error fetching uncategorized expenses:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
