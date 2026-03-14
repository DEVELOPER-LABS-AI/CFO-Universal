/**
 * GET /api/clients/[id]/revenue-reconciliation
 *
 * Returns invoiced revenue vs received (Mercury deposits) for a client + period.
 *
 * Query params:
 *   month - Period month (1–12, default current month)
 *   year  - Period year (default current year)
 *
 * Response:
 *   {
 *     invoiced: { total, records[] },
 *     received: { total, receipts[] },
 *     reconciliation: { outstanding, overpayment, status: FULLY_PAID | PARTIALLY_PAID | UNPAID | OVERPAID }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ReconciliationStatus = 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERPAID';

function computeReconciliationStatus(invoiced: number, received: number): ReconciliationStatus {
  if (invoiced === 0) return received > 0 ? 'OVERPAID' : 'FULLY_PAID';
  if (received >= invoiced) return received > invoiced ? 'OVERPAID' : 'FULLY_PAID';
  if (received === 0) return 'UNPAID';
  return 'PARTIALLY_PAID';
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: clientId } = await context.params;
    const { searchParams } = request.nextUrl;

    const now = new Date();
    const month = Number(searchParams.get('month') ?? now.getMonth() + 1);
    const year = Number(searchParams.get('year') ?? now.getFullYear());

    if (month < 1 || month > 12 || year < 2020) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
    }

    // Confirm client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Date range for the period
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    // Fetch invoiced revenue (Xero / manual) and Mercury cash receipts in parallel
    const [invoicedRecords, cashReceipts] = await Promise.all([
      prisma.revenueRecord.findMany({
        where: {
          client_id: clientId,
          transaction_date: { gte: periodStart, lt: periodEnd },
        },
        select: {
          id: true,
          amount: true,
          transaction_date: true,
          status: true,
          xero_invoice_number: true,
          description: true,
        },
        orderBy: { transaction_date: 'desc' },
      }),
      prisma.clientCashReceipt.findMany({
        where: {
          client_id: clientId,
          period_month: month,
          period_year: year,
        },
        select: {
          id: true,
          mercury_transaction_id: true,
          amount: true,
          receipt_date: true,
          linked_at: true,
        },
        orderBy: { receipt_date: 'desc' },
      }),
    ]);

    const invoicedTotal = invoicedRecords.reduce((sum, r) => sum + Number(r.amount), 0);
    const receivedTotal = cashReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
    const outstanding = Math.max(0, invoicedTotal - receivedTotal);
    const overpayment = Math.max(0, receivedTotal - invoicedTotal);
    const status = computeReconciliationStatus(invoicedTotal, receivedTotal);

    return NextResponse.json({
      clientId,
      clientName: client.name,
      period: { month, year },
      invoiced: {
        total: invoicedTotal,
        records: invoicedRecords.map((r) => ({ ...r, amount: Number(r.amount) })),
      },
      received: {
        total: receivedTotal,
        receipts: cashReceipts.map((r) => ({ ...r, amount: Number(r.amount) })),
      },
      reconciliation: {
        outstanding,
        overpayment,
        status,
      },
    });
  } catch (error) {
    console.error('[GET /api/clients/[id]/revenue-reconciliation]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
