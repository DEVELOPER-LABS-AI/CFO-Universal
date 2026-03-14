/**
 * GET /api/contractors/[id]/trend
 *
 * Returns month-over-month expense trend for a contractor.
 *
 * Query params:
 *   historyMonths - Number of periods to aggregate (default 3, max 24)
 *
 * Response shape:
 *   { contractorId, contractorName, currentPeriod, priorPeriod, trend, history }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getContractorTrend } from '@/lib/calculations/trend-reporter';
import { trendQuerySchema } from '@/lib/validations/subscription';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: contractorId } = await context.params;

    const { searchParams } = request.nextUrl;
    const parsed = trendQuerySchema.safeParse({
      historyMonths: searchParams.get('historyMonths') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const historyMonths = parsed.data.historyMonths ?? 3;

    // Confirm contractor exists
    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { id: true, name: true },
    });

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    const currentYear = now.getFullYear();

    const trend = await getContractorTrend(
      contractorId,
      currentMonth,
      currentYear,
      historyMonths
    );

    return NextResponse.json({ contractorId, contractorName: contractor.name, ...trend });
  } catch (error) {
    console.error('[GET /api/contractors/[id]/trend]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
