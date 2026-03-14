/**
 * POST /api/subscriptions/backfill-all
 *
 * Re-backfills ALL subscription transaction records for every existing
 * merchant-to-subscription mapping.
 *
 * Query params:
 *   purge=true  - Delete ALL existing subscription_transaction_records first,
 *                 then re-backfill from scratch. Use after fixing matching logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { backfillSubscriptionTransactions } from '@/lib/mercury/subscription-sync';
import { computeSubscriptionPeriodCost } from '@/lib/calculations/subscription-cost-calculator';
import { getErrorMessage } from '@/lib/utils/error';

// Extend Vercel function timeout to 300s (5 min) for bulk backfill
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = await getOrganizationId();
    const purge = request.nextUrl.searchParams.get('purge') === 'true';

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No Mercury connection found' },
        { status: 422 }
      );
    }

    // Find all merchant mappings that point to a subscription
    const mappings = await prisma.merchantMappingCache.findMany({
      where: {
        connection_id: connection.id,
        subscription_id: { not: null },
      },
      select: {
        subscription_id: true,
        mercury_merchant_name: true,
      },
    });

    if (mappings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No subscription mappings found',
        results: [],
      });
    }

    // If purge=true, delete ALL existing records for this org so we start fresh
    let purgedCount = 0;
    if (purge) {
      const deleted = await prisma.subscriptionTransactionRecord.deleteMany({
        where: { organization_id: organizationId },
      });
      purgedCount = deleted.count;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const results = [];

    for (const mapping of mappings) {
      try {
        const backfillResult = await backfillSubscriptionTransactions(
          connection.id,
          organizationId,
          mapping.subscription_id!,
          mapping.mercury_merchant_name
        );

        const periodCost = await computeSubscriptionPeriodCost(
          mapping.subscription_id!,
          currentMonth,
          currentYear
        );

        results.push({
          subscriptionId: mapping.subscription_id,
          merchantName: mapping.mercury_merchant_name,
          linked: backfillResult.linked,
          skipped: backfillResult.skipped,
          errors: backfillResult.errors.length,
          periodCost,
        });
      } catch (err: unknown) {
        results.push({
          subscriptionId: mapping.subscription_id,
          merchantName: mapping.mercury_merchant_name,
          linked: 0,
          skipped: 0,
          errors: 1,
          error: getErrorMessage(err),
        });
      }
    }

    const totalLinked = results.reduce((sum, r) => sum + r.linked, 0);

    return NextResponse.json({
      success: true,
      purged: purge,
      purgedCount,
      mappingsProcessed: mappings.length,
      totalTransactionsLinked: totalLinked,
      results,
    });
  } catch (error: unknown) {
    console.error('[POST /api/subscriptions/backfill-all]', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
