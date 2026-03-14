/**
 * GET /api/mercury/merchants/transactions
 *
 * Returns ExpenseRecord transactions for a given Mercury merchant name.
 * Supports server-side pagination and includes entity assignment data.
 *
 * Query params:
 *   organizationId - Organization UUID (required)
 *   merchantName   - Raw Mercury merchant name (required)
 *   page           - Page number (default 1)
 *   limit          - Max results per page (default 25, max 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    const { searchParams } = request.nextUrl;
    const merchantName = searchParams.get('merchantName');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(Number(searchParams.get('limit') ?? '25'), 100);
    const skip = (page - 1) * limit;

    if (!merchantName) {
      return NextResponse.json(
        { error: 'Missing required parameter: merchantName' },
        { status: 400 }
      );
    }

    const where = {
      organization_id: organizationId,
      merchant_name: merchantName,
    };

    const [transactions, total] = await Promise.all([
      prisma.expenseRecord.findMany({
        where,
        select: {
          id: true,
          amount: true,
          transaction_date: true,
          description: true,
          is_credit: true,
          category: true,
          contractor_id: true,
          client_id: true,
          agency_id: true,
          subscription_id: true,
          expense_category_id: true,
          staff_id: true,
          categorization_rule_id: true,
          contractor: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
          subscription: { select: { id: true, name: true } },
          expense_category: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
        },
        orderBy: { transaction_date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.expenseRecord.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        transaction_date: t.transaction_date,
        description: t.description,
        is_credit: t.is_credit,
        category: t.category,
        contractor_id: t.contractor_id,
        client_id: t.client_id,
        agency_id: t.agency_id,
        subscription_id: t.subscription_id,
        expense_category_id: t.expense_category_id,
        staff_id: t.staff_id,
        entity_name: t.contractor?.name ?? t.subscription?.name ?? t.agency?.name
          ?? t.client?.name ?? t.expense_category?.name ?? t.staff?.name ?? null,
        entity_type: t.contractor_id ? 'contractor' : t.subscription_id ? 'subscription'
          : t.agency_id ? 'agency' : t.client_id ? 'client'
          : t.expense_category_id ? 'expense' : t.staff_id ? 'owner' : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/mercury/merchants/transactions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
