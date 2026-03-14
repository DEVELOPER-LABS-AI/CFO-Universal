/**
 * POST /api/mercury/merchants/map-subscription
 * Link a subscription to a Mercury merchant and backfill transactions.
 *
 * DELETE /api/mercury/merchants/map-subscription
 * Remove a subscription merchant mapping (does NOT delete transaction records).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapSubscriptionMerchantSchema } from '@/lib/validations/subscription';
import { cacheSubscriptionMapping } from '@/lib/mercury/subscription-mapper';
import { backfillSubscriptionTransactions } from '@/lib/mercury/subscription-sync';
import { computeSubscriptionPeriodCost } from '@/lib/calculations/subscription-cost-calculator';
import { normalizeName } from '@/lib/mercury/utils';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';

// ---------------------------------------------------------------------------
// POST — create mapping and backfill
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();

    const body = await request.json();
    const parsed = mapSubscriptionMerchantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subscriptionId, merchantName } = parsed.data;

    // Confirm subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, name: true, organization_id: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Get Mercury connection for organization
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: subscription.organization_id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Mercury connection found for this organization' }, { status: 422 });
    }

    // Check for existing mapping (MERCHANT_ALREADY_MAPPED guard)
    const normalizedName = normalizeName(merchantName);
    const existingMapping = await prisma.merchantMappingCache.findUnique({
      where: {
        connection_id_normalized_merchant_name: {
          connection_id: connection.id,
          normalized_merchant_name: normalizedName,
        },
      },
      select: { subscription_id: true },
    });

    if (existingMapping?.subscription_id) {
      return NextResponse.json(
        { error: 'MERCHANT_ALREADY_MAPPED', message: 'This merchant is already mapped to a subscription' },
        { status: 400 }
      );
    }

    // Cache the subscription mapping (EXACT confidence — admin-confirmed)
    await cacheSubscriptionMapping(
      connection.id,
      merchantName,
      subscriptionId,
      'EXACT',
      1.0
    );

    // Backfill last 90 days of historical transactions
    const backfillResult = await backfillSubscriptionTransactions(
      connection.id,
      subscription.organization_id,
      subscriptionId,
      merchantName
    );

    // Compute current period cost after backfill
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const computedPeriodCost = await computeSubscriptionPeriodCost(subscriptionId, currentMonth, currentYear);

    return NextResponse.json({
      success: true,
      subscriptionId,
      merchantName,
      transactionsLinked: backfillResult.linked,
      backfillSkipped: backfillResult.skipped,
      computedPeriodCost,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/mercury/merchants/map-subscription]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove mapping (T019)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrExecutive();

    const body = await request.json();
    const { subscriptionId, merchantName } = body as { subscriptionId?: string; merchantName?: string };

    if (!subscriptionId || !merchantName) {
      return NextResponse.json(
        { error: 'subscriptionId and merchantName are required' },
        { status: 400 }
      );
    }

    // Find the subscription to get organization_id
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { organization_id: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: subscription.organization_id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Mercury connection found' }, { status: 422 });
    }

    const normalizedName = normalizeName(merchantName);

    // Delete only if the cache entry points to this subscription
    const deleted = await prisma.merchantMappingCache.deleteMany({
      where: {
        connection_id: connection.id,
        normalized_merchant_name: normalizedName,
        subscription_id: subscriptionId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    // Note: subscription_transaction_records are intentionally preserved
    return NextResponse.json({ success: true, removed: deleted.count });
  } catch (error) {
    console.error('[DELETE /api/mercury/merchants/map-subscription]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
