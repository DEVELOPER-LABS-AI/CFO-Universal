/**
 * POST /api/mercury/merchants/[merchantId]/rules/test
 * Test a pattern against recent transactions for a merchant.
 * Reuses matchesRule() from the categorization engine.
 * Returns which transactions would match without persisting anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { matchesRule } from '@/lib/mercury/categorization-engine';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    await requireAdminOrExecutive();
    const { merchantId } = await params;
    const body = await request.json();
    const { organizationId, rule_type, pattern } = body;

    if (!organizationId || !rule_type || !pattern) {
      return NextResponse.json(
        { error: 'Missing required parameters: organizationId, rule_type, pattern' },
        { status: 400 }
      );
    }

    // Get merchant mapping
    const mapping = await prisma.merchantMappingCache.findUnique({
      where: { id: merchantId },
      select: {
        mercury_merchant_name: true,
        connection: { select: { organization_id: true } },
      },
    });

    if (!mapping || mapping.connection.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Merchant mapping not found' }, { status: 404 });
    }

    // Fetch recent transactions for this merchant (last 20)
    const recentExpenses = await prisma.expenseRecord.findMany({
      where: {
        organization_id: organizationId,
        merchant_name: mapping.mercury_merchant_name,
      },
      select: {
        id: true,
        mercury_transaction_id: true,
        description: true,
        amount: true,
        transaction_date: true,
        category: true,
        categorization_rule_id: true,
      },
      orderBy: { transaction_date: 'desc' },
      take: 20,
    });

    // Create a synthetic rule for matching
    const testRule = {
      id: 'test',
      rule_type: rule_type as 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE',
      pattern,
      category: 'OTHER' as const, // Doesn't matter for match testing
      priority: 0,
    };

    // Test each transaction
    const results = recentExpenses.map((expense) => {
      const matched = matchesRule(
        {
          merchantName: mapping.mercury_merchant_name,
          description: expense.description,
          amount: Number(expense.amount),
        },
        testRule
      );

      return {
        id: expense.id,
        mercury_transaction_id: expense.mercury_transaction_id,
        description: expense.description,
        amount: Number(expense.amount),
        transaction_date: expense.transaction_date,
        current_category: expense.category,
        matched,
      };
    });

    const matchedCount = results.filter((r) => r.matched).length;

    return NextResponse.json({
      merchant_name: mapping.mercury_merchant_name,
      total_tested: results.length,
      matched_count: matchedCount,
      transactions: results,
    });
  } catch (error: unknown) {
    console.error('Error testing rule:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
