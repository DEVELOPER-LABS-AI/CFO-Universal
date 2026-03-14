/**
 * GET /api/mercury/expenses/all
 * Get all Mercury-synced expenses with their current category
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

    const [expenses, contractors, clients] = await Promise.all([
      prisma.expenseRecord.findMany({
        where: {
          organization_id: organizationId,
          mercury_transaction_id: { not: null },
        },
        select: {
          id: true,
          amount: true,
          transaction_date: true,
          description: true,
          category: true,
          contractor_id: true,
          client_id: true,
          agency_id: true,
          mercury_transaction_id: true,
          merchant_name: true,
          contractor: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
        },
        orderBy: { transaction_date: 'desc' },
        take: 500,
      }),
      prisma.contractor.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true, engagement_type: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({ expenses, contractors, clients, count: expenses.length });
  } catch (error: unknown) {
    console.error('Error fetching all Mercury expenses:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
