'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createSubscriptionAllocationSchema,
  getSubscriptionsSchema,
} from '@/lib/validations/subscription';
import { Prisma } from '@prisma/client';

// T094: createSubscription server action using CreateSubscriptionSchema
export async function createSubscription(data: unknown) {
  const validated = createSubscriptionSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check for duplicate name
  const existing = await prisma.subscription.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });

  if (existing) throw new Error('A subscription with this name already exists');

  const subscription = await prisma.subscription.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      total_cost: validated.total_cost,
      total_seats: validated.total_seats,
      billing_frequency: validated.billing_frequency,
      is_active: validated.is_active ?? true,
    },
  });

  revalidatePath('/dashboard/subscriptions');
  return {
    ...subscription,
    total_cost: Number(subscription.total_cost),
  };
}

// T095: getSubscriptions server action with utilization calculation
// Returns ALL subscriptions (no server-side pagination) so client can sort across full dataset
export async function getSubscriptions(input?: unknown) {
  const organizationId = await getOrganizationId();

  const where: Prisma.SubscriptionWhereInput = {
    organization_id: organizationId,
    deleted_at: null,
  };

  let periodMonth: number | undefined;
  let periodYear: number | undefined;

  if (input) {
    const validated = getSubscriptionsSchema.parse(input);
    if (validated.is_active !== undefined) {
      where.is_active = validated.is_active;
    }
    periodMonth = validated.period_month;
    periodYear = validated.period_year;
  }

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      allocations: {
        include: {
          client: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const subscriptionIds = subscriptions.map((s) => s.id);

  // Compute monthly cost per subscription from linked transactions.
  // When a specific period is selected, filter to that month only.
  // Otherwise, groups by subscription + period, ordered newest first,
  // so the first occurrence for each subscription_id is its most recent cost.
  const periodFilter = periodMonth && periodYear
    ? { period_month: periodMonth, period_year: periodYear }
    : {};

  const allPeriodCosts = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['subscription_id', 'period_month', 'period_year'],
    where: {
      subscription_id: { in: subscriptionIds },
      ...periodFilter,
    },
    _sum: { amount: true },
    orderBy: [
      { period_year: 'desc' },
      { period_month: 'desc' },
    ],
  });

  const latestCostMap = new Map<string, number>();
  for (const pc of allPeriodCosts) {
    if (!latestCostMap.has(pc.subscription_id)) {
      latestCostMap.set(pc.subscription_id, Number(pc._sum.amount || 0));
    }
  }

  // Fetch mapped merchant names per subscription for verification display
  const merchantMappings = await prisma.merchantMappingCache.findMany({
    where: {
      subscription_id: { in: subscriptionIds },
    },
    select: {
      subscription_id: true,
      mercury_merchant_name: true,
    },
  });

  const merchantNameMap = new Map<string, string[]>();
  for (const m of merchantMappings) {
    if (!m.subscription_id) continue;
    const existing = merchantNameMap.get(m.subscription_id) || [];
    existing.push(m.mercury_merchant_name);
    merchantNameMap.set(m.subscription_id, existing);
  }

  // Calculate utilization for each subscription
  const subscriptionsWithUtilization = subscriptions.map((sub) => {
    // Use latest month's transaction-derived cost, fall back to static total_cost,
    // normalized to monthly based on billing frequency
    const computedCost = latestCostMap.get(sub.id);
    const rawCost = computedCost != null && computedCost > 0
      ? computedCost
      : Number(sub.total_cost);
    const effectiveCost = toMonthlyCost(rawCost, sub.billing_frequency);

    // Split allocations by pool — client and staff pools are independent,
    // each targeting up to 100% of the subscription cost.
    const clientAllocations = sub.allocations.filter(a => a.client_id !== null);
    const staffAllocations = sub.allocations.filter(a => a.staff_id !== null);

    // Compute utilization from percentages/seat ratios against CURRENT effective
    // cost — stored cost_allocated values go stale when transaction costs change.
    const poolPercentage = (allocs: typeof sub.allocations) =>
      allocs.reduce((sum, a) => {
        if (a.allocation_type === 'SEAT_BASED' && sub.total_seats) {
          return sum + ((a.seats_allocated || 0) / sub.total_seats) * 100;
        }
        return sum + Number(a.percentage_allocated || 0);
      }, 0);

    const clientPct = poolPercentage(clientAllocations);
    const staffPct = poolPercentage(staffAllocations);
    const highestPoolPct = Math.max(clientPct, staffPct);

    const totalAllocatedCost = effectiveCost * (highestPoolPct / 100);
    const unutilizedCost = effectiveCost - totalAllocatedCost;

    // For seat-based subscriptions, calculate seat utilization
    let seatsAllocated = 0;
    let seatsRemaining = null;
    if (sub.total_seats) {
      seatsAllocated = sub.allocations
        .filter((a) => a.allocation_type === 'SEAT_BASED')
        .reduce((sum, alloc) => sum + (alloc.seats_allocated || 0), 0);
      seatsRemaining = sub.total_seats - seatsAllocated;
    }

    // For percentage-based, calculate total percentage
    const totalPercentage = sub.allocations
      .filter((a) => a.allocation_type === 'PERCENTAGE_BASED')
      .reduce((sum, alloc) => sum + Number(alloc.percentage_allocated || 0), 0);

    return {
      ...sub,
      effective_cost: effectiveCost,
      mapped_merchants: merchantNameMap.get(sub.id) || [],
      utilization: {
        totalAllocatedCost,
        unutilizedCost,
        seatsAllocated,
        seatsRemaining,
        totalPercentage,
      },
    };
  });

  // Distinct available periods for the period picker
  const availablePeriods = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['period_month', 'period_year'],
    where: { subscription_id: { in: subscriptionIds } },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
  });

  return {
    subscriptions: subscriptionsWithUtilization,
    total: subscriptions.length,
    availablePeriods: availablePeriods.map((p) => ({
      month: p.period_month,
      year: p.period_year,
    })),
  };
}

// T099: Calculate allocated cost based on allocation type
function calculateAllocatedCost(
  allocationType: 'SEAT_BASED' | 'PERCENTAGE_BASED',
  totalCost: number,
  totalSeats: number | null,
  seatsAllocated: number | null,
  percentageAllocated: number | null
): number {
  if (allocationType === 'SEAT_BASED') {
    if (!totalSeats || !seatsAllocated) {
      throw new Error('Seats required for seat-based allocation');
    }
    const costPerSeat = totalCost / totalSeats;
    return costPerSeat * seatsAllocated;
  } else {
    // PERCENTAGE_BASED
    if (percentageAllocated === null || percentageAllocated === undefined) {
      throw new Error('Percentage required for percentage-based allocation');
    }
    return totalCost * (percentageAllocated / 100);
  }
}

// T096: createSubscriptionAllocation server action with hybrid allocation
// T097: Seat constraint validation - block if exceeded
// T098: Percentage warning - allow if >100%
export async function createSubscriptionAllocation(data: unknown) {
  const validated = createSubscriptionAllocationSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify subscription exists
  const subscription = await prisma.subscription.findFirst({
    where: { id: validated.subscription_id, organization_id: organizationId, deleted_at: null },
    include: { allocations: true },
  });
  if (!subscription) throw new Error('Subscription not found');

  // Verify client or staff exists
  if (validated.client_id) {
    const client = await prisma.client.findFirst({
      where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
    });
    if (!client) throw new Error('Client not found');
  }

  if (validated.staff_id) {
    const staff = await prisma.staff.findFirst({
      where: { id: validated.staff_id, organization_id: organizationId, deleted_at: null },
    });
    if (!staff) throw new Error('Staff member not found');
  }

  // Filter to same-pool allocations for validation
  const entityType = validated.client_id ? 'client' : 'staff';
  const samePoolAllocations = subscription.allocations.filter((a) =>
    entityType === 'client' ? a.client_id !== null : a.staff_id !== null
  );

  // T097: Seat constraint validation (hard constraint - BLOCK if exceeded, per pool)
  if (validated.allocation_type === 'SEAT_BASED') {
    if (!subscription.total_seats) {
      throw new Error('Subscription does not have seat-based pricing');
    }

    const currentSeatsAllocated = samePoolAllocations
      .filter((a) => a.allocation_type === 'SEAT_BASED')
      .reduce((sum, alloc) => sum + (alloc.seats_allocated || 0), 0);

    const newSeatsAllocated = validated.seats_allocated || 0;
    const totalSeatsAfterAllocation = currentSeatsAllocated + newSeatsAllocated;

    if (totalSeatsAfterAllocation > subscription.total_seats) {
      throw new Error(
        `Cannot allocate ${newSeatsAllocated} seats. Only ${subscription.total_seats - currentSeatsAllocated} seats remaining (${currentSeatsAllocated}/${subscription.total_seats} allocated).`
      );
    }
  }

  // T098: Percentage warning (soft warning - ALLOW but warn, per pool)
  let percentageWarning = null;
  if (validated.allocation_type === 'PERCENTAGE_BASED') {
    const currentPercentage = samePoolAllocations
      .filter((a) => a.allocation_type === 'PERCENTAGE_BASED')
      .reduce((sum, alloc) => sum + Number(alloc.percentage_allocated || 0), 0);

    const newPercentage = validated.percentage_allocated || 0;
    const totalPercentageAfterAllocation = currentPercentage + newPercentage;

    if (totalPercentageAfterAllocation > 100) {
      percentageWarning = `Warning: ${entityType} pool allocation is now ${totalPercentageAfterAllocation}% (exceeds 100%). Current: ${currentPercentage}%, Adding: ${newPercentage}%`;
    }
  }

  // T099: Calculate allocated cost
  const costAllocated = calculateAllocatedCost(
    validated.allocation_type,
    Number(subscription.total_cost),
    subscription.total_seats,
    validated.seats_allocated ?? null,
    validated.percentage_allocated ?? null
  );

  const allocation = await prisma.subscriptionAllocation.create({
    data: {
      subscription_id: validated.subscription_id,
      client_id: validated.client_id,
      staff_id: validated.staff_id,
      allocation_type: validated.allocation_type,
      seats_allocated: validated.seats_allocated,
      percentage_allocated: validated.percentage_allocated,
      cost_allocated: costAllocated,
    },
    include: {
      subscription: true,
      client: true,
      staff: true,
    },
  });

  revalidatePath('/dashboard/subscriptions');
  if (validated.client_id) {
    revalidatePath(`/dashboard/clients/${validated.client_id}`);
  }
  if (validated.staff_id) {
    revalidatePath(`/dashboard/staff/${validated.staff_id}`);
  }

  return {
    allocation,
    warning: percentageWarning,
  };
}

/** Normalize a cost to monthly based on billing frequency. */
function toMonthlyCost(cost: number, billingFrequency: string): number {
  if (billingFrequency === 'ONE_TIME') return 0;
  if (billingFrequency === 'QUARTERLY') return cost / 3;
  if (billingFrequency === 'ANNUAL') return cost / 12;
  return cost;
}

/**
 * Get the effective monthly cost for a subscription: latest month's Mercury transaction
 * total, falling back to the static total_cost field, normalized to monthly.
 */
async function getEffectiveCost(
  subscriptionId: string,
  staticTotalCost: number,
  billingFrequency: string
): Promise<number> {
  const latestPeriod = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['period_month', 'period_year'],
    where: { subscription_id: subscriptionId },
    _sum: { amount: true },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    take: 1,
  });
  const txCost = latestPeriod.length > 0 ? Number(latestPeriod[0]._sum.amount || 0) : 0;
  const rawCost = txCost > 0 ? txCost : staticTotalCost;
  return toMonthlyCost(rawCost, billingFrequency);
}

/**
 * Rebalance allocations for a subscription within a specific entity pool.
 * Client and staff allocations are independent pools, each summing to 100%.
 */
async function rebalanceAllocations(
  subscriptionId: string,
  totalCost: number,
  entityType: 'client' | 'staff'
) {
  const allocations = await prisma.subscriptionAllocation.findMany({
    where: {
      subscription_id: subscriptionId,
      ...(entityType === 'client'
        ? { client_id: { not: null } }
        : { staff_id: { not: null } }),
    },
  });

  if (allocations.length === 0) return;

  const equalPercentage = 100 / allocations.length;
  const equalCost = totalCost / allocations.length;

  await prisma.$transaction(
    allocations.map((a) =>
      prisma.subscriptionAllocation.update({
        where: { id: a.id },
        data: {
          allocation_type: 'PERCENTAGE_BASED',
          percentage_allocated: equalPercentage,
          cost_allocated: equalCost,
          seats_allocated: null,
        },
      })
    )
  );
}

/**
 * Add clients or staff to a subscription and auto-rebalance the affected pool evenly.
 * Supports batch creation: pass multiple client_ids OR staff_ids at once.
 * Client and staff pools are rebalanced independently.
 */
export async function addSubscriptionAllocation(data: {
  subscription_id: string;
  client_ids?: string[];
  staff_ids?: string[];
  /** @deprecated Use client_ids/staff_ids instead */
  client_id?: string | null;
  /** @deprecated Use client_ids/staff_ids instead */
  staff_id?: string | null;
}) {
  const organizationId = await getOrganizationId();

  // Normalize: support both single (legacy) and batch APIs
  const clientIds = data.client_ids?.length
    ? data.client_ids
    : data.client_id ? [data.client_id] : [];
  const staffIds = data.staff_ids?.length
    ? data.staff_ids
    : data.staff_id ? [data.staff_id] : [];

  const hasClients = clientIds.length > 0;
  const hasStaff = staffIds.length > 0;
  if ((!hasClients && !hasStaff) || (hasClients && hasStaff)) {
    throw new Error('Must allocate to either clients or staff members, not both');
  }

  const entityType: 'client' | 'staff' = hasClients ? 'client' : 'staff';
  const entityIds = hasClients ? clientIds : staffIds;

  const subscription = await prisma.subscription.findFirst({
    where: { id: data.subscription_id, organization_id: organizationId, deleted_at: null },
    include: { allocations: true },
  });
  if (!subscription) throw new Error('Subscription not found');

  // Filter existing allocations to the same pool
  const samePoolAllocations = subscription.allocations.filter((a) =>
    entityType === 'client' ? a.client_id !== null : a.staff_id !== null
  );

  // Check for duplicates
  const existingEntityIds = new Set(
    samePoolAllocations.map((a) => (entityType === 'client' ? a.client_id : a.staff_id))
  );
  const duplicates = entityIds.filter((id) => existingEntityIds.has(id));
  if (duplicates.length > 0) {
    throw new Error(`Already allocated: ${duplicates.length} ${entityType}(s) skipped`);
  }

  // Verify entities exist
  if (hasClients) {
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (clients.length !== clientIds.length) throw new Error('One or more clients not found');
  }
  if (hasStaff) {
    const staff = await prisma.staff.findMany({
      where: { id: { in: staffIds }, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (staff.length !== staffIds.length) throw new Error('One or more staff members not found');
  }

  const totalCost = await getEffectiveCost(data.subscription_id, Number(subscription.total_cost), subscription.billing_frequency);
  const newCount = samePoolAllocations.length + entityIds.length;
  const equalPercentage = 100 / newCount;
  const equalCost = totalCost / newCount;

  // Batch create all new allocations
  await prisma.$transaction(
    entityIds.map((id) =>
      prisma.subscriptionAllocation.create({
        data: {
          subscription_id: data.subscription_id,
          client_id: entityType === 'client' ? id : null,
          staff_id: entityType === 'staff' ? id : null,
          allocation_type: 'PERCENTAGE_BASED',
          percentage_allocated: equalPercentage,
          cost_allocated: equalCost,
        },
      })
    )
  );

  // Rebalance only the affected pool
  await rebalanceAllocations(data.subscription_id, totalCost, entityType);

  revalidatePath('/dashboard/subscriptions');
  revalidatePath(`/dashboard/subscriptions/${data.subscription_id}`);
  for (const id of entityIds) {
    revalidatePath(`/dashboard/${entityType === 'client' ? 'clients' : 'staff'}/${id}`);
  }

  return { success: true, allocationCount: newCount, percentageEach: equalPercentage, entityType };
}

// T100: removeSubscriptionAllocation server action (rebalances remaining in same pool after removal)
export async function removeSubscriptionAllocation(allocationId: string) {
  const organizationId = await getOrganizationId();

  const allocation = await prisma.subscriptionAllocation.findUnique({
    where: { id: allocationId },
    include: { subscription: true },
  });

  if (!allocation) throw new Error('Allocation not found');
  if (allocation.subscription.organization_id !== organizationId) {
    throw new Error('Allocation not found');
  }

  // Determine entity type before deletion for pool-aware rebalance
  const entityType: 'client' | 'staff' = allocation.client_id ? 'client' : 'staff';

  await prisma.subscriptionAllocation.delete({
    where: { id: allocationId },
  });

  // Rebalance only the affected pool
  const effectiveCost = await getEffectiveCost(
    allocation.subscription_id,
    Number(allocation.subscription.total_cost),
    allocation.subscription.billing_frequency
  );
  await rebalanceAllocations(allocation.subscription_id, effectiveCost, entityType);

  revalidatePath('/dashboard/subscriptions');
  revalidatePath(`/dashboard/subscriptions/${allocation.subscription_id}`);
  if (allocation.client_id) {
    revalidatePath(`/dashboard/clients/${allocation.client_id}`);
  }
  if (allocation.staff_id) {
    revalidatePath(`/dashboard/staff/${allocation.staff_id}`);
  }

  return { success: true };
}

export async function updateSubscription(id: string, data: unknown) {
  const validated = updateSubscriptionSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.subscription.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Subscription not found');

  if (validated.name) {
    const duplicate = await prisma.subscription.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: validated.name, mode: 'insensitive' },
        id: { not: id },
        deleted_at: null,
      },
    });
    if (duplicate) throw new Error('A subscription with this name already exists');
  }

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.total_cost !== undefined && { total_cost: validated.total_cost }),
      ...(validated.total_seats !== undefined && { total_seats: validated.total_seats }),
      ...(validated.billing_frequency && { billing_frequency: validated.billing_frequency }),
      ...(validated.is_active !== undefined && { is_active: validated.is_active }),
    },
  });

  revalidatePath('/dashboard/subscriptions');
  return {
    ...subscription,
    total_cost: Number(subscription.total_cost),
  };
}

/**
 * Update subscription settings: allocation type, billing frequency, and enrichment credit configuration.
 */
export async function updateSubscriptionSettings(
  id: string,
  data: {
    allocation_type: string;
    billing_frequency?: string;
    is_active?: boolean;
    is_enrichment: boolean;
    total_credits?: number | null;
    credit_cost_email?: number | null;
    credit_cost_phone?: number | null;
  }
) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.subscription.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Subscription not found');

  if (!['SEAT_BASED', 'PERCENTAGE_BASED'].includes(data.allocation_type)) {
    throw new Error('Invalid allocation type');
  }

  if (data.billing_frequency && !['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME'].includes(data.billing_frequency)) {
    throw new Error('Invalid billing frequency');
  }

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      allocation_type: data.allocation_type,
      ...(data.billing_frequency && { billing_frequency: data.billing_frequency }),
      ...(data.is_active !== undefined && { is_active: data.is_active }),
      is_enrichment: data.is_enrichment,
      total_credits: data.is_enrichment ? (data.total_credits ?? null) : null,
      credit_cost_email: data.is_enrichment ? (data.credit_cost_email ?? null) : null,
      credit_cost_phone: data.is_enrichment ? (data.credit_cost_phone ?? null) : null,
    },
  });

  revalidatePath('/dashboard/subscriptions');
  revalidatePath(`/dashboard/subscriptions/${id}`);
  revalidatePath('/dashboard/enrichments');
  return { success: true };
}

/**
 * Get all enrichment-tagged subscriptions with their allocations and costs.
 */
export async function getEnrichmentSubscriptions() {
  const organizationId = await getOrganizationId();

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organization_id: organizationId,
      is_enrichment: true,
      deleted_at: null,
    },
    include: {
      allocations: {
        include: {
          client: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get effective costs from Mercury transactions
  const subscriptionIds = subscriptions.map((s) => s.id);
  const allPeriodCosts = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['subscription_id', 'period_month', 'period_year'],
    where: { subscription_id: { in: subscriptionIds } },
    _sum: { amount: true },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
  });

  const latestCostMap = new Map<string, number>();
  for (const pc of allPeriodCosts) {
    if (!latestCostMap.has(pc.subscription_id)) {
      latestCostMap.set(pc.subscription_id, Number(pc._sum.amount || 0));
    }
  }

  const enrichmentSubs = subscriptions.map((sub) => {
    const txCost = latestCostMap.get(sub.id);
    const rawCost = txCost && txCost > 0 ? txCost : Number(sub.total_cost);
    const monthlyCost = toMonthlyCost(rawCost, sub.billing_frequency);
    const clientAllocations = sub.allocations.filter((a) => a.client_id !== null);

    return {
      id: sub.id,
      name: sub.name,
      is_active: sub.is_active,
      billing_frequency: sub.billing_frequency,
      total_cost: Number(sub.total_cost),
      effective_cost: monthlyCost,
      total_credits: sub.total_credits,
      credit_cost_email: sub.credit_cost_email ? Number(sub.credit_cost_email) : null,
      credit_cost_phone: sub.credit_cost_phone ? Number(sub.credit_cost_phone) : null,
      allocated_clients: clientAllocations.map((a) => ({
        id: a.client?.id,
        name: a.client?.name,
        cost_allocated: (Number(a.percentage_allocated ?? 0) / 100) * monthlyCost,
      })),
      allocation_count: sub.allocations.length,
    };
  });

  // Aggregate stats
  const totalSpend = enrichmentSubs.reduce((sum, s) => sum + s.effective_cost, 0);
  const totalCredits = enrichmentSubs.reduce((sum, s) => sum + (s.total_credits || 0), 0);
  const activeCount = enrichmentSubs.filter((s) => s.is_active).length;

  return {
    subscriptions: enrichmentSubs,
    stats: {
      totalSpend,
      totalCredits,
      totalSubscriptions: enrichmentSubs.length,
      activeCount,
    },
  };
}

export async function softDeleteSubscription(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.subscription.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Subscription not found');

  const subscription = await prisma.subscription.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/subscriptions');
  return {
    ...subscription,
    total_cost: Number(subscription.total_cost),
  };
}
