/**
 * GET /api/mercury/deposits/unassociated
 *
 * Returns paginated Mercury credit transactions that have no linked ClientCashReceipt.
 * Each item includes a fuzzy-matched client suggestion.
 *
 * Query params:
 *   page  - Page number (default 1)
 *   limit - Page size (default 20, max 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnassociatedDeposits } from '@/lib/mercury/receipt-mapper';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const { searchParams } = request.nextUrl;

    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const connectionId = searchParams.get('connectionId');
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));

    // getUnassociatedDeposits already enriches each item with suggestions
    const { deposits, total } = await getUnassociatedDeposits(
      connectionId,
      organizationId,
      page,
      limit
    );

    // Normalise to snake_case keys for the API response
    const data = deposits.map((d) => ({
      id: d.mercuryTransactionId,
      mercury_transaction_id: d.mercuryTransactionId,
      counterparty_name: d.counterpartyName,
      amount: d.amount,
      transaction_date: d.transactionDate,
      suggested_client_id: d.suggestedClientId,
      suggested_client_name: d.suggestedClientName,
      suggestion_confidence: d.suggestionConfidence,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/mercury/deposits/unassociated]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
