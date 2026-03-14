import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

/**
 * One-time migration: Rebalance existing subscription allocations into
 * independent client and staff pools. Each pool sums to 100% independently.
 *
 * POST /api/admin/migrate-allocation-pools
 *
 * Remove this route after migration is complete.
 */
export async function POST() {
  try {
    await requireAdmin();
    const organizationId = await getOrganizationId();

    const subscriptions = await prisma.subscription.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      include: { allocations: true },
    });

    let migrated = 0;
    let skipped = 0;

    for (const sub of subscriptions) {
      if (sub.allocations.length === 0) {
        skipped++;
        continue;
      }

      const rawCost = Number(sub.total_cost);
      // Normalize to monthly cost based on billing frequency
      const monthlyCost = sub.billing_frequency === 'QUARTERLY' ? rawCost / 3
        : sub.billing_frequency === 'ANNUAL' ? rawCost / 12
        : rawCost;
      const clientAllocations = sub.allocations.filter((a) => a.client_id !== null);
      const staffAllocations = sub.allocations.filter((a) => a.staff_id !== null);

      const updates = [];

      // Rebalance client pool to 100%
      if (clientAllocations.length > 0) {
        const clientPct = 100 / clientAllocations.length;
        const clientCost = monthlyCost / clientAllocations.length;
        for (const a of clientAllocations) {
          updates.push(
            prisma.subscriptionAllocation.update({
              where: { id: a.id },
              data: {
                allocation_type: 'PERCENTAGE_BASED',
                percentage_allocated: clientPct,
                cost_allocated: clientCost,
                seats_allocated: null,
              },
            })
          );
        }
      }

      // Rebalance staff pool to 100%
      if (staffAllocations.length > 0) {
        const staffPct = 100 / staffAllocations.length;
        const staffCost = monthlyCost / staffAllocations.length;
        for (const a of staffAllocations) {
          updates.push(
            prisma.subscriptionAllocation.update({
              where: { id: a.id },
              data: {
                allocation_type: 'PERCENTAGE_BASED',
                percentage_allocated: staffPct,
                cost_allocated: staffCost,
                seats_allocated: null,
              },
            })
          );
        }
      }

      if (updates.length > 0) {
        await prisma.$transaction(updates);
        migrated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      total: subscriptions.length,
      message: `Migrated ${migrated} subscriptions to independent pools. ${skipped} skipped (no allocations).`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
