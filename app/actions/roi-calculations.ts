'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import { refreshClientROISchema, refreshBDRROISchema, getClientROISchema, getBDRROISchema } from '@/lib/validations/roi';
import { getClientRevenue, calculateClientCosts } from '@/lib/calculations/client-roi';
import { calculateAttributedRevenue, getTotalMeetingsAttended, calculateBDRTotalCost } from '@/lib/calculations/bdr-roi';
import { calculateOverheadAllocation } from '@/lib/calculations/overhead-allocation';
import { getErrorMessage } from '@/lib/utils/error';

// T122: refreshClientROI server action
// T125: Dual metrics calculation: ROI% = (profit / total_costs) * 100, Margin% = (profit / revenue) * 100
// T126: Edge case handling: if costs = 0, roi = 0; if revenue = 0, margin = 0
// T127: Upsert logic using unique constraint (client_id, month, year)
export async function refreshClientROI(data: unknown, overheadAllocation = 0) {
  const validated = refreshClientROISchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify client exists and belongs to organization
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  // T123: Get revenue
  const revenue = await getClientRevenue(validated.client_id, validated.month, validated.year);

  // T124: Calculate costs from all sources
  const costs = await calculateClientCosts(
    validated.client_id,
    validated.month,
    validated.year,
    organizationId
  );

  // Add overhead allocation to total costs
  const totalCostsWithOverhead = costs.totalCosts + overheadAllocation;
  const profit = revenue - totalCostsWithOverhead;

  // T125 & T126: Calculate dual metrics with edge case handling
  let roiPercentage = 0;
  let marginPercentage = 0;

  if (totalCostsWithOverhead > 0) {
    roiPercentage = (profit / totalCostsWithOverhead) * 100;
  }

  if (revenue > 0) {
    marginPercentage = (profit / revenue) * 100;
  }

  // T127: Upsert using unique constraint
  const costData = {
    revenue,
    total_costs: totalCostsWithOverhead,
    profit,
    roi_percentage: roiPercentage,
    margin_percentage: marginPercentage,
    bdr_costs: costs.bdrCosts,
    contractor_costs: costs.contractorCosts,
    subscription_costs: costs.subscriptionCosts,
    service_costs: costs.serviceCosts,
    overhead_costs: overheadAllocation,
    agency_costs: costs.agencyCosts,
    other_costs: costs.otherCosts,
    calculated_at: new Date(),
  };

  const clientROI = await prisma.clientROI.upsert({
    where: {
      client_id_month_year: {
        client_id: validated.client_id,
        month: validated.month,
        year: validated.year,
      },
    },
    update: costData,
    create: {
      client_id: validated.client_id,
      month: validated.month,
      year: validated.year,
      ...costData,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  revalidatePath('/dashboard/portfolio');
  revalidatePath(`/dashboard/clients/${validated.client_id}`);

  return clientROI;
}

/**
 * Fetches the latest ClientROI record for a single client.
 * Returns financial summary with cost breakdown, or null if no data exists.
 */
export async function getClientFinancialSummary(clientId: string) {
  const organizationId = await getOrganizationId();

  // Verify client belongs to organization
  const client = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
    select: { id: true },
  });
  if (!client) return null;

  // Get the most recent ROI record for this client
  const roi = await prisma.clientROI.findFirst({
    where: { client_id: clientId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  if (!roi) return null;

  return {
    period: { month: roi.month, year: roi.year },
    calculatedAt: roi.calculated_at,
    revenue: Number(roi.revenue),
    totalCosts: Number(roi.total_costs),
    profit: Number(roi.profit),
    roiPercentage: Number(roi.roi_percentage),
    marginPercentage: Number(roi.margin_percentage),
    costBreakdown: {
      bdr: Number(roi.bdr_costs),
      contractor: Number(roi.contractor_costs),
      subscription: Number(roi.subscription_costs),
      service: Number(roi.service_costs),
      agency: Number(roi.agency_costs),
      overhead: Number(roi.overhead_costs),
      other: Number(roi.other_costs),
    },
  };
}

// T128: getClientROIDashboard server action reading from ClientROI table
// T129: Add filters: status, minMargin, maxMargin, relationship_type
// T130: Add sorting: sortBy, sortOrder
// T131: Calculate summary statistics
export async function getClientROIDashboard(input?: unknown) {
  const validated = input ? getClientROISchema.parse(input) : getClientROISchema.parse({});
  const organizationId = await getOrganizationId();

  // Build where clause for client filters (exclude internal clients from display)
  const clientWhere: any = {
    organization_id: organizationId,
    deleted_at: null,
    is_internal: false,
  };

  if (validated.status) {
    clientWhere.status = validated.status;
  }

  if (validated.relationship_type) {
    clientWhere.relationship_type = validated.relationship_type;
  }

  // Get clients matching filters
  const clients = await prisma.client.findMany({
    where: clientWhere,
    select: { id: true, name: true, status: true, relationship_type: true },
  });

  const clientIds = clients.map((c) => c.id);

  // Build where clause for ROI data
  const roiWhere: any = {
    client_id: { in: clientIds },
  };

  // Date range filters
  if (validated.start_year || validated.start_month) {
    roiWhere.OR = [
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
    roiWhere.AND = roiWhere.AND || [];
    roiWhere.AND.push({
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

  // Margin filters
  if (validated.min_margin !== undefined) {
    roiWhere.margin_percentage = roiWhere.margin_percentage || {};
    roiWhere.margin_percentage.gte = validated.min_margin;
  }

  if (validated.max_margin !== undefined) {
    roiWhere.margin_percentage = roiWhere.margin_percentage || {};
    roiWhere.margin_percentage.lte = validated.max_margin;
  }

  // ROI filters
  if (validated.min_roi !== undefined) {
    roiWhere.roi_percentage = roiWhere.roi_percentage || {};
    roiWhere.roi_percentage.gte = validated.min_roi;
  }

  if (validated.max_roi !== undefined) {
    roiWhere.roi_percentage = roiWhere.roi_percentage || {};
    roiWhere.roi_percentage.lte = validated.max_roi;
  }

  // Fetch ROI data with sorting
  const sortBy = validated.sort_by || 'margin_percentage';
  const sortOrder = validated.sort_order || 'desc';

  const roiData = await prisma.clientROI.findMany({
    where: roiWhere,
    include: {
      client: { select: { id: true, name: true, status: true, relationship_type: true } },
    },
    orderBy: { [sortBy]: sortOrder },
  });

  // T131: Calculate summary statistics
  const totalClients = roiData.length;
  const totalRevenue = roiData.reduce((sum, roi) => sum + Number(roi.revenue), 0);
  const totalCosts = roiData.reduce((sum, roi) => sum + Number(roi.total_costs), 0);
  const totalProfit = roiData.reduce((sum, roi) => sum + Number(roi.profit), 0);

  const avgMargin =
    totalClients > 0
      ? roiData.reduce((sum, roi) => sum + Number(roi.margin_percentage), 0) / totalClients
      : 0;

  const avgROI =
    totalClients > 0
      ? roiData.reduce((sum, roi) => sum + Number(roi.roi_percentage), 0) / totalClients
      : 0;

  // Convert Decimal fields to numbers for client serialization
  const roiClients = roiData.map((roi) => ({
    ...roi,
    revenue: Number(roi.revenue),
    total_costs: Number(roi.total_costs),
    profit: Number(roi.profit),
    roi_percentage: Number(roi.roi_percentage),
    margin_percentage: Number(roi.margin_percentage),
  }));

  return {
    clients: roiClients,
    summary: {
      totalClients,
      totalRevenue,
      totalCosts,
      totalProfit,
      avgMargin,
      avgROI,
    },
  };
}

// Bulk refresh for all clients with overhead cost allocation
export async function refreshAllClientROI(
  month: number,
  year: number,
  includeOwnerPayOverride?: boolean
) {
  const organizationId = await getOrganizationId();

  // Determine whether to include owner pay
  let includeOwnerPay: boolean;
  if (includeOwnerPayOverride !== undefined) {
    includeOwnerPay = includeOwnerPayOverride;
  } else {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { include_owner_pay: true },
    });
    includeOwnerPay = org.include_owner_pay;
  }

  // Calculate overhead allocation map (internal client costs → external clients)
  const overheadMap = await calculateOverheadAllocation(organizationId, month, year, includeOwnerPay);

  // Only refresh external (non-internal) active clients
  const clients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: 'ACTIVE',
      is_internal: false,
    },
    select: { id: true },
  });

  const results = [];
  for (const client of clients) {
    try {
      const overhead = overheadMap.get(client.id) ?? 0;
      const result = await refreshClientROI(
        { client_id: client.id, month, year },
        overhead
      );
      results.push({ clientId: client.id, success: true, data: result });
    } catch (error: unknown) {
      results.push({ clientId: client.id, success: false, error: getErrorMessage(error) });
    }
  }

  revalidatePath('/dashboard/portfolio');

  return {
    total: clients.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
    includeOwnerPay,
  };
}

// T138: refreshBDRROI server action
// T140: BDR cost retrieval from staff.rate
// T141: Dual metrics calculation for BDR
// T142: Get total meetings attended
export async function refreshBDRROI(data: unknown) {
  const validated = refreshBDRROISchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify BDR exists and is of type BDR
  const bdr = await prisma.staff.findFirst({
    where: {
      id: validated.bdr_id,
      organization_id: organizationId,
      staff_type: 'BDR',
      deleted_at: null,
    },
  });
  if (!bdr) throw new Error('BDR not found or staff member is not a BDR');

  // T139: Calculate attributed revenue
  const revenueAttributed = await calculateAttributedRevenue(
    validated.bdr_id,
    validated.month,
    validated.year
  );

  // T140: Get BDR cost (base rate + approved bonuses)
  const { totalCost: bdrCost } = await calculateBDRTotalCost(
    validated.bdr_id, validated.month, validated.year
  );

  // Calculate profit
  const profit = revenueAttributed - bdrCost;

  // T141: Calculate dual metrics with edge case handling
  let roiPercentage = 0;
  let marginPercentage = 0;

  if (bdrCost > 0) {
    roiPercentage = (profit / bdrCost) * 100;
  }

  if (revenueAttributed > 0) {
    marginPercentage = (profit / revenueAttributed) * 100;
  }

  // T142: Get total meetings attended
  const meetingsAttendedTotal = await getTotalMeetingsAttended(
    validated.bdr_id,
    validated.month,
    validated.year
  );

  // Upsert using unique constraint
  const bdrROI = await prisma.bDRROI.upsert({
    where: {
      bdr_id_month_year: {
        bdr_id: validated.bdr_id,
        month: validated.month,
        year: validated.year,
      },
    },
    update: {
      revenue_attributed: revenueAttributed,
      bdr_cost: bdrCost,
      profit,
      roi_percentage: roiPercentage,
      margin_percentage: marginPercentage,
      meetings_attended_total: meetingsAttendedTotal,
      calculated_at: new Date(),
    },
    create: {
      bdr_id: validated.bdr_id,
      month: validated.month,
      year: validated.year,
      revenue_attributed: revenueAttributed,
      bdr_cost: bdrCost,
      profit,
      roi_percentage: roiPercentage,
      margin_percentage: marginPercentage,
      meetings_attended_total: meetingsAttendedTotal,
      calculated_at: new Date(),
    },
    include: {
      bdr: { select: { id: true, name: true } },
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.bdr_id}`);

  return bdrROI;
}

// T143: getBDRPerformanceDashboard server action reading from BDRROI table
// T144: Calculate summary statistics
export async function getBDRPerformanceDashboard(input?: unknown) {
  const validated = input ? getBDRROISchema.parse(input) : getBDRROISchema.parse({});
  const organizationId = await getOrganizationId();

  // Build where clause
  const where: any = {
    bdr: {
      organization_id: organizationId,
      staff_type: 'BDR',
      deleted_at: null,
    },
  };

  if (validated.bdr_id) {
    where.bdr_id = validated.bdr_id;
  }

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

  // Margin filters
  if (validated.min_margin !== undefined) {
    where.margin_percentage = where.margin_percentage || {};
    where.margin_percentage.gte = validated.min_margin;
  }

  if (validated.max_margin !== undefined) {
    where.margin_percentage = where.margin_percentage || {};
    where.margin_percentage.lte = validated.max_margin;
  }

  // ROI filters
  if (validated.min_roi !== undefined) {
    where.roi_percentage = where.roi_percentage || {};
    where.roi_percentage.gte = validated.min_roi;
  }

  if (validated.max_roi !== undefined) {
    where.roi_percentage = where.roi_percentage || {};
    where.roi_percentage.lte = validated.max_roi;
  }

  // Fetch BDR ROI data with sorting
  const sortBy = validated.sort_by || 'roi_percentage';
  const sortOrder = validated.sort_order || 'desc';

  const bdrData = await prisma.bDRROI.findMany({
    where,
    include: {
      bdr: { select: { id: true, name: true, staff_type: true } },
    },
    orderBy: { [sortBy]: sortOrder },
  });

  // T144: Calculate summary statistics
  const totalBDRs = bdrData.length;
  const totalRevenueAttributed = bdrData.reduce((sum, roi) => sum + Number(roi.revenue_attributed), 0);
  const totalBDRCosts = bdrData.reduce((sum, roi) => sum + Number(roi.bdr_cost), 0);
  const totalProfit = bdrData.reduce((sum, roi) => sum + Number(roi.profit), 0);
  const totalMeetingsAttended = bdrData.reduce((sum, roi) => sum + roi.meetings_attended_total, 0);

  const avgROI =
    totalBDRs > 0
      ? bdrData.reduce((sum, roi) => sum + Number(roi.roi_percentage), 0) / totalBDRs
      : 0;

  const avgMargin =
    totalBDRs > 0
      ? bdrData.reduce((sum, roi) => sum + Number(roi.margin_percentage), 0) / totalBDRs
      : 0;

  // Convert Decimal fields to numbers for client serialization
  const bdrs = bdrData.map((roi) => ({
    ...roi,
    revenue_attributed: Number(roi.revenue_attributed),
    bdr_cost: Number(roi.bdr_cost),
    profit: Number(roi.profit),
    roi_percentage: Number(roi.roi_percentage),
    margin_percentage: Number(roi.margin_percentage),
  }));

  return {
    bdrs,
    summary: {
      totalBDRs,
      totalRevenueAttributed,
      totalBDRCosts,
      totalProfit,
      avgROI,
      avgMargin,
      totalMeetingsAttended,
    },
  };
}

// Bulk refresh for all BDRs
export async function refreshAllBDRROI(month: number, year: number) {
  const organizationId = await getOrganizationId();

  const bdrs = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      staff_type: 'BDR',
      deleted_at: null,
    },
    select: { id: true },
  });

  const results = [];
  for (const bdr of bdrs) {
    try {
      const result = await refreshBDRROI({
        bdr_id: bdr.id,
        month,
        year,
      });
      results.push({ bdrId: bdr.id, success: true, data: result });
    } catch (error: unknown) {
      results.push({ bdrId: bdr.id, success: false, error: getErrorMessage(error) });
    }
  }

  revalidatePath('/dashboard/staff');

  return {
    total: bdrs.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
