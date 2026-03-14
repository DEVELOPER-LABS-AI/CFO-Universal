/**
 * GET /api/clients/[id]/transactions
 *
 * Returns paginated Mercury deposits (ClientCashReceipt) linked to a client,
 * enriched with bank description from the corresponding ExpenseRecord.
 *
 * Query params:
 *   page  - Page number (default 1)
 *   limit - Page size (default 25, max 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: clientId } = await context.params;
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)));

    // Confirm client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const whereClause = { client_id: clientId };

    const [records, total] = await Promise.all([
      prisma.clientCashReceipt.findMany({
        where: whereClause,
        orderBy: { receipt_date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mercury_transaction_id: true,
          amount: true,
          receipt_date: true,
          period_month: true,
          period_year: true,
          linked_at: true,
        },
      }),
      prisma.clientCashReceipt.count({ where: whereClause }),
    ]);

    // Enrich with bank description / counterparty from ExpenseRecord
    const mercuryTxIds = records
      .map((r) => r.mercury_transaction_id)
      .filter((id): id is string => id != null);

    const expenseRecords = mercuryTxIds.length > 0
      ? await prisma.expenseRecord.findMany({
          where: { mercury_transaction_id: { in: mercuryTxIds } },
          select: {
            mercury_transaction_id: true,
            merchant_name: true,
            description: true,
          },
        })
      : [];

    const expenseMap = new Map(
      expenseRecords.map((e) => [e.mercury_transaction_id, e])
    );

    return NextResponse.json({
      data: records.map((r) => {
        const expense = expenseMap.get(r.mercury_transaction_id);
        return {
          ...r,
          amount: Number(r.amount),
          bank_description: expense?.description || null,
          counterparty_name: expense?.merchant_name || null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/clients/[id]/transactions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
