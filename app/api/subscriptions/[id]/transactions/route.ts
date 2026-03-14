/**
 * GET /api/subscriptions/[id]/transactions
 *
 * Returns paginated subscription_transaction_records for a subscription,
 * enriched with the raw bank statement description from the expense record.
 *
 * Query params:
 *   month  - Period month (1-12)
 *   year   - Period year (e.g. 2026)
 *   page   - Page number (default 1)
 *   limit  - Page size (default 20, max 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transactionQuerySchema } from '@/lib/validations/subscription';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: subscriptionId } = await context.params;

    const { searchParams } = request.nextUrl;
    const parsed = transactionQuerySchema.safeParse({
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { month, year, page = 1, limit = 20 } = parsed.data;

    // Confirm subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, name: true, organization_id: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const whereClause = {
      subscription_id: subscriptionId,
      ...(month != null && year != null
        ? { period_month: month, period_year: year }
        : {}),
    };

    const [records, total] = await Promise.all([
      prisma.subscriptionTransactionRecord.findMany({
        where: whereClause,
        orderBy: { transaction_date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mercury_transaction_id: true,
          amount: true,
          transaction_date: true,
          merchant_name: true,
          period_month: true,
          period_year: true,
          linked_at: true,
        },
      }),
      prisma.subscriptionTransactionRecord.count({ where: whereClause }),
    ]);

    // Enrich with raw bank statement description from expense records
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
          // Raw bank statement description (bankDescription from Mercury API)
          bank_description: expense?.description || null,
          // Raw counterparty name from Mercury API
          counterparty_name: expense?.merchant_name || r.merchant_name,
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
    console.error('[GET /api/subscriptions/[id]/transactions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
