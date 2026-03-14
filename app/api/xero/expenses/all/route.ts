/**
 * All Xero Expenses API
 *
 * Returns all ExpenseRecord entries that originated from Xero
 * (where xero_expense_id is not null) for the authenticated user's organization.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET() {
  try {
    const organizationId = await getOrganizationId();

    // Fetch expense records that have a xero_expense_id (Xero-sourced)
    const expenses = await prisma.expenseRecord.findMany({
      where: {
        organization_id: organizationId,
        xero_expense_id: { not: null },
      },
      include: {
        contractor: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { transaction_date: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      expenses,
      total: expenses.length,
    });
  } catch (error) {
    console.error('All Xero expenses fetch error:', error);

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
        error: 'Failed to fetch Xero expenses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
