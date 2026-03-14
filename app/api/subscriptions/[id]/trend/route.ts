/**
 * GET /api/subscriptions/[id]/trend
 *
 * Returns month-over-month cost trend for a subscription.
 *
 * Query params:
 *   historyMonths - Number of periods to aggregate (default 3, max 24)
 *
 * Response shape:
 *   { currentPeriod, priorPeriod, trend, history }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSubscriptionTrend } from '@/lib/calculations/trend-reporter';
import { trendQuerySchema } from '@/lib/validations/subscription';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: subscriptionId } = await context.params;

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

    // Confirm subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, name: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    const currentYear = now.getFullYear();

    const trend = await getSubscriptionTrend(
      subscriptionId,
      currentMonth,
      currentYear,
      historyMonths
    );

    return NextResponse.json({ subscriptionId, subscriptionName: subscription.name, ...trend });
  } catch (error) {
    console.error('[GET /api/subscriptions/[id]/trend]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
