'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import {
  createAllocationSchema,
  updateAllocationSchema,
} from '@/lib/validations/project';
import { CostSourceType, StaffStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the "active allocation" filter clause reused across queries.
 * An allocation is considered active when its effective_end_date is either
 * null (open-ended) or in the future (>= today).
 */
function activeEndDateFilter() {
  return {
    OR: [
      { effective_end_date: null },
      { effective_end_date: { gte: new Date() } },
    ],
  };
}

/**
 * Normalize a rate to a monthly equivalent based on the rate type.
 *
 * @param rate - The raw rate value
 * @param rateType - HOURLY | DAILY | MONTHLY | VARIABLE
 * @returns The monthly-equivalent rate as a number
 */
function normalizeRateToMonthly(rate: number, rateType: string | null): number {
  switch (rateType) {
    case 'HOURLY':
      return rate * 160;
    case 'DAILY':
      return rate * 22;
    case 'MONTHLY':
    default:
      return rate;
  }
}

/**
 * Normalize a subscription total cost to a monthly equivalent based on
 * billing frequency.
 *
 * @param totalCost - The total subscription cost per billing period
 * @param billingFrequency - MONTHLY | QUARTERLY | ANNUAL
 * @returns The monthly-equivalent cost as a number
 */
function normalizeSubscriptionToMonthly(
  totalCost: number,
  billingFrequency: string,
): number {
  switch (billingFrequency) {
    case 'ANNUAL':
      return totalCost / 12;
    case 'QUARTERLY':
      return totalCost / 3;
    case 'MONTHLY':
    default:
      return totalCost;
  }
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Create a new project cost allocation record.
 *
 * Validates the input against `createAllocationSchema`, verifies the project
 * and cost source belong to the authenticated user's organization, and ensures
 * the total allocation percentage for the source does not exceed 100%.
 *
 * @param data - Raw input to be validated against createAllocationSchema
 * @returns Result object with `success` flag and either the allocation data or an error message
 */
export async function createAllocation(data: unknown): Promise<
  | { success: true; allocation: Record<string, unknown> }
  | { success: false; error: string }
> {
  const parseResult = createAllocationSchema.safeParse(data);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid input' };
  }
  const validated = parseResult.data;

  const organizationId = await getOrganizationId();

  // Verify project exists and belongs to the organization
  const project = await prisma.project.findFirst({
    where: {
      id: validated.project_id,
      organization_id: organizationId,
      deleted_at: null,
    },
  });
  if (!project) {
    return { success: false, error: 'Project not found or does not belong to this organization' };
  }

  // Verify the cost source exists and belongs to the organization
  switch (validated.cost_source_type) {
    case 'STAFF': {
      const staff = await prisma.staff.findFirst({
        where: { id: validated.cost_source_id, organization_id: organizationId },
      });
      if (!staff) {
        return { success: false, error: 'Staff member not found or does not belong to this organization' };
      }
      break;
    }
    case 'CONTRACTOR': {
      const contractor = await prisma.contractor.findFirst({
        where: { id: validated.cost_source_id, organization_id: organizationId, deleted_at: null },
      });
      if (!contractor) {
        return { success: false, error: 'Contractor not found or does not belong to this organization' };
      }
      if (contractor.status === 'INACTIVE') {
        return { success: false, error: 'Cannot allocate an inactive contractor to a project' };
      }
      break;
    }
    case 'SUBSCRIPTION': {
      const subscription = await prisma.subscription.findFirst({
        where: { id: validated.cost_source_id, organization_id: organizationId },
      });
      if (!subscription) {
        return { success: false, error: 'Subscription not found or does not belong to this organization' };
      }
      break;
    }
    // OTHER type does not require source verification
  }

  // Check that total allocation for this source does not exceed 100%
  const existingAllocations = await prisma.projectCostAllocation.findMany({
    where: {
      cost_source_type: validated.cost_source_type as CostSourceType,
      cost_source_id: validated.cost_source_id,
      ...activeEndDateFilter(),
    },
    select: { allocation_percentage: true },
  });

  const currentTotal = existingAllocations.reduce(
    (sum: number, a: { allocation_percentage: unknown }) =>
      sum + Number(a.allocation_percentage),
    0,
  );

  if (currentTotal + validated.allocation_percentage > 100) {
    return {
      success: false,
      error: `Total allocation would be ${currentTotal + validated.allocation_percentage}%. ` +
        `Only ${100 - currentTotal}% is available for this source.`,
    };
  }

  const allocation = await prisma.projectCostAllocation.create({
    data: {
      project_id: validated.project_id,
      cost_source_type: validated.cost_source_type as CostSourceType,
      cost_source_id: validated.cost_source_id,
      allocation_percentage: validated.allocation_percentage,
      fixed_amount: validated.fixed_amount ?? null,
      effective_start_date: validated.effective_start_date,
      effective_end_date: validated.effective_end_date ?? null,
      notes: validated.notes ?? null,
      created_by: 'system',
    },
  });

  revalidatePath('/dashboard/projects/' + validated.project_id);

  return {
    success: true,
    allocation: {
      ...allocation,
      allocation_percentage: Number(allocation.allocation_percentage),
      fixed_amount: allocation.fixed_amount ? Number(allocation.fixed_amount) : null,
    },
  };
}

/**
 * Retrieve all active cost allocations for a project, enriched with
 * resolved source names and calculated monthly cost contributions.
 *
 * For each allocation the monthly cost is computed as:
 * - STAFF / CONTRACTOR: normalized monthly rate * (allocation_percentage / 100)
 * - SUBSCRIPTION: normalized monthly cost * (allocation_percentage / 100)
 * - OTHER: fixed_amount (returned as-is)
 *
 * @param projectId - The UUID of the project
 * @returns Array of enriched allocation objects with numeric fields
 * @throws {Error} If the project is not found or does not belong to the organization
 */
export async function getProjectAllocations(projectId: string) {
  const organizationId = await getOrganizationId();

  // Verify project belongs to the organization
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });
  if (!project) {
    throw new Error('Project not found or does not belong to this organization');
  }

  // Fetch all active allocations for this project
  const allocations = await prisma.projectCostAllocation.findMany({
    where: {
      project_id: projectId,
      ...activeEndDateFilter(),
    },
    orderBy: { created_at: 'desc' },
  });

  // Resolve source names and monthly costs
  const enriched = await Promise.all(
    allocations.map(async (alloc) => {
      let sourceName = 'Unknown';
      let monthlyCost = 0;
      const pct = Number(alloc.allocation_percentage);

      switch (alloc.cost_source_type) {
        case 'STAFF': {
          const staff = await prisma.staff.findUnique({
            where: { id: alloc.cost_source_id },
            select: { name: true, rate: true, rate_type: true },
          });
          if (staff) {
            sourceName = staff.name;
            const monthlyRate = normalizeRateToMonthly(
              Number(staff.rate),
              staff.rate_type,
            );
            monthlyCost = monthlyRate * (pct / 100);
          }
          break;
        }
        case 'CONTRACTOR': {
          const contractor = await prisma.contractor.findUnique({
            where: { id: alloc.cost_source_id },
            select: { name: true, rate: true, rate_type: true },
          });
          if (contractor) {
            sourceName = contractor.name;
            const rate = contractor.rate ? Number(contractor.rate) : 0;
            const monthlyRate = normalizeRateToMonthly(
              rate,
              contractor.rate_type ?? null,
            );
            monthlyCost = monthlyRate * (pct / 100);
          }
          break;
        }
        case 'SUBSCRIPTION': {
          const subscription = await prisma.subscription.findUnique({
            where: { id: alloc.cost_source_id },
            select: { name: true, total_cost: true, billing_frequency: true },
          });
          if (subscription) {
            sourceName = subscription.name;
            // Check Mercury transaction records for actual spend first
            const latestPeriod = await prisma.subscriptionTransactionRecord.groupBy({
              by: ['period_month', 'period_year'],
              where: { subscription_id: alloc.cost_source_id },
              _sum: { amount: true },
              orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
              take: 1,
            });
            const txCost = latestPeriod.length > 0
              ? Number(latestPeriod[0]._sum.amount || 0)
              : 0;
            const rawCost = txCost > 0 ? txCost : Number(subscription.total_cost);
            const monthlySubCost = normalizeSubscriptionToMonthly(
              rawCost,
              subscription.billing_frequency,
            );
            monthlyCost = monthlySubCost * (pct / 100);
          }
          break;
        }
        case 'OTHER': {
          sourceName = alloc.notes || 'Other expense';
          monthlyCost = alloc.fixed_amount ? Number(alloc.fixed_amount) : 0;
          break;
        }
      }

      return {
        id: alloc.id,
        cost_source_type: alloc.cost_source_type,
        cost_source_id: alloc.cost_source_id,
        source_name: sourceName,
        allocation_percentage: pct,
        fixed_amount: alloc.fixed_amount ? Number(alloc.fixed_amount) : null,
        effective_start_date: alloc.effective_start_date,
        effective_end_date: alloc.effective_end_date,
        monthly_cost: monthlyCost,
        notes: alloc.notes,
      };
    }),
  );

  return enriched;
}

/**
 * Update an existing allocation using an append-only audit trail.
 *
 * The existing allocation is soft-ended (effective_end_date set to today),
 * and a new allocation record is created with the old values merged with the
 * provided updates. If the allocation_percentage changes, the total across
 * all active allocations for the same source is re-validated (<= 100%).
 *
 * @param allocationId - The UUID of the allocation to update
 * @param data - Raw input validated against updateAllocationSchema
 * @returns The newly created allocation record with Decimal fields as numbers
 * @throws {Error} If allocation not found, project not in org, or total exceeds 100%
 */
export async function updateAllocation(allocationId: string, data: unknown) {
  const validated = updateAllocationSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Fetch the existing allocation and verify project ownership
  const existingAllocation = await prisma.projectCostAllocation.findUnique({
    where: { id: allocationId },
    include: {
      project: { select: { organization_id: true } },
    },
  });

  if (!existingAllocation) {
    throw new Error('Allocation not found');
  }
  if (existingAllocation.project.organization_id !== organizationId) {
    throw new Error('Allocation does not belong to this organization');
  }

  // Determine the new allocation percentage
  const newPercentage =
    validated.allocation_percentage ?? Number(existingAllocation.allocation_percentage);

  // If allocation_percentage changed, re-validate total <= 100%
  if (
    validated.allocation_percentage !== undefined &&
    validated.allocation_percentage !== Number(existingAllocation.allocation_percentage)
  ) {
    const siblingAllocations = await prisma.projectCostAllocation.findMany({
      where: {
        cost_source_type: existingAllocation.cost_source_type,
        cost_source_id: existingAllocation.cost_source_id,
        id: { not: allocationId }, // Exclude the record being ended
        ...activeEndDateFilter(),
      },
      select: { allocation_percentage: true },
    });

    const siblingTotal = siblingAllocations.reduce(
      (sum: number, a: { allocation_percentage: unknown }) =>
        sum + Number(a.allocation_percentage),
      0,
    );

    if (siblingTotal + newPercentage > 100) {
      throw new Error(
        `Total allocation would be ${siblingTotal + newPercentage}%. ` +
        `Only ${100 - siblingTotal}% is available for this source.`,
      );
    }
  }

  // Soft-end the old allocation and create the new one in a transaction
  const today = new Date();

  const newAllocation = await prisma.$transaction(async (tx) => {
    // Soft-end old allocation
    await tx.projectCostAllocation.update({
      where: { id: allocationId },
      data: { effective_end_date: today },
    });

    // Create new allocation record with merged values
    return tx.projectCostAllocation.create({
      data: {
        project_id: existingAllocation.project_id,
        cost_source_type: existingAllocation.cost_source_type,
        cost_source_id: existingAllocation.cost_source_id,
        allocation_percentage: newPercentage,
        fixed_amount: validated.fixed_amount ?? (existingAllocation.fixed_amount ? Number(existingAllocation.fixed_amount) : null),
        effective_start_date: today,
        effective_end_date: validated.effective_end_date ?? null,
        notes: validated.notes ?? existingAllocation.notes,
        created_by: 'system',
      },
    });
  });

  revalidatePath('/dashboard/projects/' + existingAllocation.project_id);

  return {
    ...newAllocation,
    allocation_percentage: Number(newAllocation.allocation_percentage),
    fixed_amount: newAllocation.fixed_amount
      ? Number(newAllocation.fixed_amount)
      : null,
  };
}

/**
 * Remove (soft-end) an allocation by setting its effective_end_date to today.
 *
 * @param allocationId - The UUID of the allocation to remove
 * @returns { success: true } on successful removal
 * @throws {Error} If allocation not found or project does not belong to the organization
 */
export async function removeAllocation(allocationId: string) {
  const organizationId = await getOrganizationId();

  const allocation = await prisma.projectCostAllocation.findUnique({
    where: { id: allocationId },
    include: {
      project: { select: { organization_id: true } },
    },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }
  if (allocation.project.organization_id !== organizationId) {
    throw new Error('Allocation does not belong to this organization');
  }

  await prisma.projectCostAllocation.update({
    where: { id: allocationId },
    data: { effective_end_date: new Date() },
  });

  revalidatePath('/dashboard/projects/' + allocation.project_id);

  return { success: true };
}

/**
 * Get the used and available allocation percentages for a given cost source.
 *
 * Sums the allocation_percentage across all active allocations (where
 * effective_end_date is null or >= today) for the specified source type
 * and source ID.
 *
 * @param costSourceType - The type of cost source (STAFF | CONTRACTOR | SUBSCRIPTION | OTHER)
 * @param costSourceId - The UUID of the cost source entity
 * @returns Object with `used` (total percentage allocated) and `available` (remaining percentage)
 */
export async function getAvailableAllocationPercentage(
  costSourceType: string,
  costSourceId: string,
) {
  const allocations = await prisma.projectCostAllocation.findMany({
    where: {
      cost_source_type: costSourceType as CostSourceType,
      cost_source_id: costSourceId,
      ...activeEndDateFilter(),
    },
    select: { allocation_percentage: true },
  });

  const totalUsed = allocations.reduce(
    (sum: number, a: { allocation_percentage: unknown }) =>
      sum + Number(a.allocation_percentage),
    0,
  );

  return {
    used: totalUsed,
    available: 100 - totalUsed,
  };
}

/**
 * Fetch lightweight source lists (staff, contractors, subscriptions) for the
 * allocation modal dropdowns. Returns only active/non-deleted items in the
 * authenticated user's organization.
 *
 * @returns Object with staffList, contractorList, and subscriptionList arrays of { id, name }
 */
export async function getAllocationSourceLists() {
  const organizationId = await getOrganizationId();

  const [staffList, contractorList, subscriptionList] = await Promise.all([
    prisma.staff.findMany({
      where: { organization_id: organizationId, status: StaffStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.contractor.findMany({
      where: { organization_id: organizationId, deleted_at: null, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subscription.findMany({
      where: { organization_id: organizationId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { staffList, contractorList, subscriptionList };
}
