'use server';

import { prisma, Prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  createAgencySchema,
  updateAgencySchema,
  createAgencyMonthlyBreakdownSchema,
  getAgenciesSchema,
  getAgencyBreakdownsSchema,
  type StaffBreakdownItem,
  type ServiceBreakdownItem,
} from '@/lib/validations/agency';
import { getAgencyMercuryCost, getAllAgencyAvgMonthlySpend } from '@/lib/calculations/agency-costs';

// T109: createAgency server action using CreateAgencySchema
export async function createAgency(data: unknown) {
  const validated = createAgencySchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check for duplicate name
  const existing = await prisma.agency.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });

  if (existing) throw new Error('An agency with this name already exists');

  const agency = await prisma.agency.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      monthly_payment: validated.monthly_payment ?? null,
      merchant_name: validated.merchant_name ?? null,
      start_date: validated.start_date,
    },
  });

  revalidatePath('/dashboard/agencies');
  return agency;
}

// T110: getAgencies server action
export async function getAgencies(input?: unknown) {
  const validated = input ? getAgenciesSchema.parse(input) : getAgenciesSchema.parse({});
  const organizationId = await getOrganizationId();

  const where: Prisma.AgencyWhereInput = {
    organization_id: organizationId,
    deleted_at: validated.include_deleted ? undefined : null,
  };

  const page = validated.page || 1;
  const limit = validated.limit || 20;
  const skip = (page - 1) * limit;

  const [agencies, total, avgSpendMap] = await Promise.all([
    prisma.agency.findMany({
      where,
      include: {
        staff: {
          where: { deleted_at: null },
          include: {
            assignments: {
              where: { end_date: null },
              include: { client: { select: { id: true, name: true } } },
            },
          },
        },
        breakdowns: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 3, // Last 3 months
        },
      },
      orderBy: { [validated.sort_by || 'created_at']: validated.sort_order || 'desc' },
      skip,
      take: limit,
    }),
    prisma.agency.count({ where }),
    getAllAgencyAvgMonthlySpend(organizationId),
  ]);

  // Enrich agencies with Mercury-based avg monthly spend
  // Convert Prisma Decimal fields to plain numbers for RSC serialization
  const agenciesWithMetrics = agencies.map((agency) => {
    const metrics = avgSpendMap.get(agency.id);
    return {
      ...agency,
      monthly_payment: agency.monthly_payment != null ? Number(agency.monthly_payment) : null,
      markup_value: agency.markup_value != null ? Number(agency.markup_value) : null,
      staff: agency.staff.map((s) => ({
        ...s,
        rate: Number(s.rate),
        true_cost: s.true_cost != null ? Number(s.true_cost) : null,
        markup_override_value: s.markup_override_value != null ? Number(s.markup_override_value) : null,
      })),
      breakdowns: agency.breakdowns.map((b) => ({
        ...b,
        breakdown_total: Number(b.breakdown_total),
        mercury_actual: b.mercury_actual != null ? Number(b.mercury_actual) : null,
        variance: Number(b.variance),
      })),
      avg_monthly_spend: metrics?.avgMonthlySpend ?? null,
      mercury_month_count: metrics?.monthCount ?? 0,
      mercury_total_spend: metrics?.totalSpend ?? 0,
    };
  });

  return {
    agencies: agenciesWithMetrics,
    pagination: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// T111: createAgencyMonthlyBreakdown server action with itemized JSONB breakdown
// T112: breakdown_total = sum of staff subtotals + sum of service amounts
// T113: variance = breakdown_total - mercury_actual (what was itemized vs what Mercury shows was paid)
// T114: variance warning if >$100 or >10%
export async function createAgencyMonthlyBreakdown(data: unknown) {
  const validated = createAgencyMonthlyBreakdownSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify agency exists and belongs to organization
  const agency = await prisma.agency.findFirst({
    where: { id: validated.agency_id, organization_id: organizationId, deleted_at: null },
  });
  if (!agency) throw new Error('Agency not found');

  // T112: Calculate breakdown_total from itemized staff subtotals + service amounts
  const staffItems: StaffBreakdownItem[] = validated.breakdown.staff ?? [];
  const serviceItems: ServiceBreakdownItem[] = validated.breakdown.services ?? [];

  const staffTotal = staffItems.reduce((sum, s) => sum + s.subtotal, 0);
  const servicesTotal = serviceItems.reduce((sum, s) => sum + s.amount, 0);
  const breakdownTotal = staffTotal + servicesTotal;

  // Auto-fetch Mercury actual spend for this agency + month
  const mercuryActual = await getAgencyMercuryCost(
    validated.agency_id,
    validated.month,
    validated.year,
    organizationId
  );

  // T113: Variance = itemized total vs actual Mercury payment
  const variance = breakdownTotal - mercuryActual;

  // T114: Generate variance warning if significant discrepancy
  let varianceWarning: string | null = null;
  const varianceAmount = Math.abs(variance);
  const variancePercent = mercuryActual > 0 ? (varianceAmount / mercuryActual) * 100 : 0;

  if (varianceAmount > 100 || variancePercent > 10) {
    const direction = variance > 0 ? 'over' : 'under';
    varianceWarning = `Itemized total is ${direction} Mercury actual by $${varianceAmount.toFixed(2)} (${variancePercent.toFixed(1)}%)`;
  }

  // Store the full breakdown JSONB including auto-computed totals for reference
  const breakdownJson = {
    staff: staffItems,
    services: serviceItems,
  };

  // Check for existing breakdown for this month/year
  const existing = await prisma.agencyMonthlyBreakdown.findUnique({
    where: {
      agency_id_month_year: {
        agency_id: validated.agency_id,
        month: validated.month,
        year: validated.year,
      },
    },
  });

  let breakdown;
  if (existing) {
    breakdown = await prisma.agencyMonthlyBreakdown.update({
      where: { id: existing.id },
      data: {
        breakdown: breakdownJson as Prisma.InputJsonValue,
        breakdown_total: breakdownTotal,
        mercury_actual: mercuryActual,
        variance,
      },
      include: { agency: true },
    });
  } else {
    breakdown = await prisma.agencyMonthlyBreakdown.create({
      data: {
        agency_id: validated.agency_id,
        month: validated.month,
        year: validated.year,
        breakdown: breakdownJson as Prisma.InputJsonValue,
        breakdown_total: breakdownTotal,
        mercury_actual: mercuryActual,
        variance,
      },
      include: { agency: true },
    });
  }

  revalidatePath('/dashboard/agencies');
  revalidatePath(`/dashboard/agencies/${validated.agency_id}`);

  // Feature 14: True cost and margin summary
  const trueCostTotal = staffItems.reduce((sum, s) => sum + (s.true_cost ?? 0), 0);
  const marginTotal = staffTotal - trueCostTotal;
  const marginPercentage = trueCostTotal > 0 ? (marginTotal / trueCostTotal) * 100 : 0;

  return {
    breakdown,
    summary: {
      staff_total: staffTotal,
      services_total: servicesTotal,
      breakdown_total: breakdownTotal,
      mercury_actual: mercuryActual,
      variance,
      true_cost_total: trueCostTotal,
      margin_total: marginTotal,
      margin_percentage: Math.round(marginPercentage * 100) / 100,
    },
    warning: varianceWarning,
  };
}

/**
 * Get the actual Mercury spend for an agency in a given month.
 * Useful for surfacing real payment data in the UI before creating a breakdown.
 */
export async function getAgencyActualCost(
  agencyId: string,
  month: number,
  year: number
): Promise<{ mercury_actual: number; transaction_count: number }> {
  const organizationId = await getOrganizationId();

  // Verify agency belongs to org
  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, organization_id: organizationId, deleted_at: null },
    select: { id: true },
  });
  if (!agency) throw new Error('Agency not found');

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await prisma.expenseRecord.aggregate({
    where: {
      organization_id: organizationId,
      agency_id: agencyId,
      transaction_date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    mercury_actual: Number(result._sum.amount ?? 0),
    transaction_count: result._count.id,
  };
}

// T115: getAgencyBreakdownHistory server action ordered by year DESC, month DESC
export async function getAgencyBreakdownHistory(input?: unknown) {
  const validated = input
    ? getAgencyBreakdownsSchema.parse(input)
    : getAgencyBreakdownsSchema.parse({});
  const organizationId = await getOrganizationId();

  // Verify agency exists and belongs to organization
  const agency = await prisma.agency.findFirst({
    where: { id: validated.agency_id, organization_id: organizationId, deleted_at: null },
  });
  if (!agency) throw new Error('Agency not found');

  const where: any = {
    agency_id: validated.agency_id,
  };

  // Date range filters
  if (validated.start_year || validated.start_month) {
    where.OR = [
      { year: { gt: validated.start_year || 2000 } },
      {
        AND: [
          { year: validated.start_year || 2000 },
          { month: { gte: validated.start_month || 1 } },
        ],
      },
    ];
  }

  if (validated.end_year || validated.end_month) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { year: { lt: validated.end_year || 2100 } },
        {
          AND: [
            { year: validated.end_year || 2100 },
            { month: { lte: validated.end_month || 12 } },
          ],
        },
      ],
    });
  }

  const breakdowns = await prisma.agencyMonthlyBreakdown.findMany({
    where,
    include: { agency: true },
    orderBy: [
      { year: validated.sort_order || 'desc' },
      { month: validated.sort_order || 'desc' },
    ],
  });

  return breakdowns;
}

export async function updateAgency(id: string, data: unknown) {
  const validated = updateAgencySchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.agency.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Agency not found');

  if (validated.name) {
    const duplicate = await prisma.agency.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: validated.name, mode: 'insensitive' },
        id: { not: id },
        deleted_at: null,
      },
    });
    if (duplicate) throw new Error('An agency with this name already exists');
  }

  // Feature 14: Build markup update data
  const markupData: Record<string, unknown> = {};
  if (validated.markup_type !== undefined) {
    markupData.markup_type = validated.markup_type ?? null;
  }
  if (validated.markup_value !== undefined) {
    markupData.markup_value = validated.markup_value ?? null;
  }
  if (validated.markup_basis !== undefined) {
    markupData.markup_basis = validated.markup_basis ?? null;
  }

  const agency = await prisma.agency.update({
    where: { id },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.monthly_payment !== undefined && { monthly_payment: validated.monthly_payment ?? null }),
      ...(validated.merchant_name !== undefined && { merchant_name: validated.merchant_name ?? null }),
      ...(validated.start_date && { start_date: validated.start_date }),
      ...markupData,
    },
  });

  revalidatePath('/dashboard/agencies');
  revalidatePath(`/dashboard/agencies/${id}`);
  return agency;
}

export async function softDeleteAgency(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.agency.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Agency not found');

  const agency = await prisma.agency.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/agencies');
  return agency;
}
