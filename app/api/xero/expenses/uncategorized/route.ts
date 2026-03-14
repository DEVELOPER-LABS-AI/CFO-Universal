/**
 * Uncategorized Expenses Count API
 *
 * Returns count of expenses with expense_sync_status = CATEGORIZATION_FAILED.
 * These are expenses that couldn't be automatically categorized.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user's organization (throws on auth failure or missing org)
    const organizationId = await getOrganizationId();

    // Count expenses with CATEGORIZATION_FAILED status
    const count = await prisma.expenseRecord.count({
      where: {
        organization_id: organizationId,
        expense_sync_status: 'CATEGORIZATION_FAILED',
      },
    });

    return NextResponse.json({
      count,
      message: count > 0
        ? `${count} expenses need manual categorization`
        : 'All expenses are categorized',
    });
  } catch (error) {
    console.error('Uncategorized expenses count error:', error);

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
        error: 'Failed to fetch uncategorized expenses count',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
