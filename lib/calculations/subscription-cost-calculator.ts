/**
 * Subscription Cost Calculator (T030)
 *
 * Computes dynamic subscription costs from SubscriptionTransactionRecord
 * and cascades updates to SubscriptionAllocation and ClientROI.
 *
 * Core principle: subscription costs are NEVER stored as a scalar —
 * they are always computed as SUM(subscription_transaction_records.amount)
 * for a given subscription + period.
 */

import { prisma } from '@/lib/prisma';

/**
 * Compute the total cost for a subscription in a given period.
 * Returns 0 if no transaction records exist for the period.
 */
export async function computeSubscriptionPeriodCost(
  subscriptionId: string,
  month: number,
  year: number
): Promise<number> {
  const agg = await prisma.subscriptionTransactionRecord.aggregate({
    where: {
      subscription_id: subscriptionId,
      period_month: month,
      period_year: year,
    },
    _sum: { amount: true },
  });

  return Number(agg._sum.amount || 0);
}

/**
 * Recompute cost_allocated for all active SubscriptionAllocations
 * for a given subscription + period.
 *
 * - SEAT_BASED: cost_allocated = (seats_allocated / total_seats) * periodTotal
 * - PERCENTAGE_BASED: cost_allocated = (percentage_allocated / 100) * periodTotal
 *
 * Returns the list of affected client_ids.
 */
export async function cascadeAllocationUpdates(
  subscriptionId: string,
  month: number,
  year: number
): Promise<string[]> {
  const periodTotal = await computeSubscriptionPeriodCost(subscriptionId, month, year);

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { total_seats: true },
  });

  const allocations = await prisma.subscriptionAllocation.findMany({
    where: { subscription_id: subscriptionId },
    select: {
      id: true,
      client_id: true,
      staff_id: true,
      allocation_type: true,
      seats_allocated: true,
      percentage_allocated: true,
    },
  });

  const affectedClientIds: string[] = [];

  for (const alloc of allocations) {
    let costAllocated = 0;

    if (alloc.allocation_type === 'SEAT_BASED') {
      const totalSeats = subscription?.total_seats || 1;
      const seats = alloc.seats_allocated || 0;
      costAllocated = (seats / totalSeats) * periodTotal;
    } else if (alloc.allocation_type === 'PERCENTAGE_BASED') {
      const pct = Number(alloc.percentage_allocated || 0);
      costAllocated = (pct / 100) * periodTotal;
    }

    await prisma.subscriptionAllocation.update({
      where: { id: alloc.id },
      data: { cost_allocated: costAllocated },
    });

    if (alloc.client_id) {
      affectedClientIds.push(alloc.client_id);
    }
  }

  return [...new Set(affectedClientIds)]; // deduplicate
}

/**
 * Update client_roi.subscription_costs for all affected clients
 * for a given period.
 *
 * Recomputes subscription costs as SUM(cost_allocated) across all
 * SubscriptionAllocations pointing to the client.
 */
export async function updateClientROISubscriptionCosts(
  subscriptionId: string,
  month: number,
  year: number
): Promise<void> {
  const affectedClientIds = await cascadeAllocationUpdates(subscriptionId, month, year);

  for (const clientId of affectedClientIds) {
    // Sum all subscription allocation costs for this client
    const allocationAgg = await prisma.subscriptionAllocation.aggregate({
      where: { client_id: clientId },
      _sum: { cost_allocated: true },
    });

    const subscriptionCosts = Number(allocationAgg._sum.cost_allocated || 0);

    // Upsert ClientROI subscription_costs for the period
    await prisma.clientROI.updateMany({
      where: {
        client_id: clientId,
        month,
        year,
      },
      data: { subscription_costs: subscriptionCosts },
    });
  }
}

/**
 * Detect a significant cost change (> threshold%) and create a notification.
 * Used to alert admins when subscription costs change substantially.
 *
 * @param thresholdPct - Minimum % change to trigger notification (default: 10%)
 */
export async function detectCostChangeAndNotify(
  subscriptionId: string,
  currentTotal: number,
  priorTotal: number,
  organizationId: string,
  thresholdPct: number = 10
): Promise<void> {
  // No prior data — can't determine change
  if (priorTotal === 0) return;

  const changePct = Math.abs((currentTotal - priorTotal) / priorTotal) * 100;

  if (changePct <= thresholdPct) return;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { name: true },
  });

  const direction = currentTotal > priorTotal ? 'increased' : 'decreased';
  const changeAmt = Math.abs(currentTotal - priorTotal).toFixed(2);

  await prisma.notification.create({
    data: {
      organization_id: organizationId,
      type: 'INFO',
      priority: 'MEDIUM',
      title: `Subscription cost ${direction}: ${subscription?.name}`,
      message:
        `${subscription?.name || 'A subscription'} cost has ${direction} by ` +
        `$${changeAmt} (${changePct.toFixed(1)}%) compared to last month.`,
      source: 'SYSTEM',
      related_entity_type: 'subscription',
      related_entity_id: subscriptionId,
      metadata: {
        subscriptionId,
        currentTotal,
        priorTotal,
        changePct: Math.round(changePct),
        direction,
      },
    },
  });
}
