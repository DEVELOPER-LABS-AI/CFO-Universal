'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import { calculateProjectCosts } from '@/lib/calculations/project-costs';
import { projectRevenueSchema } from '@/lib/validations/project';

/**
 * T027: Calculate and persist a project cost snapshot for a given period.
 * Fetches cost breakdown, preserves existing revenue, computes ROI, and upserts the snapshot.
 *
 * @param projectId - The project to snapshot.
 * @param month - Period month (defaults to current month).
 * @param year - Period year (defaults to current year).
 * @returns The upserted snapshot with Decimal fields converted to numbers.
 */
export async function calculateProjectSnapshot(
  projectId: string,
  month?: number,
  year?: number,
) {
  const organizationId = await getOrganizationId();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });

  if (!project) {
    throw new Error('Project not found or access denied');
  }

  const now = new Date();
  const periodMonth = month ?? now.getMonth() + 1;
  const periodYear = year ?? now.getFullYear();

  const costs = await calculateProjectCosts(projectId, periodMonth, periodYear);

  const existing = await prisma.projectCostSnapshot.findFirst({
    where: {
      project_id: projectId,
      period_month: periodMonth,
      period_year: periodYear,
    },
  });

  const existingRevenue = existing ? Number(existing.revenue) : 0;

  const roi =
    existingRevenue === 0
      ? null
      : costs.total_costs === 0
        ? null
        : (existingRevenue - costs.total_costs) / costs.total_costs;

  const snapshot = await prisma.projectCostSnapshot.upsert({
    where: {
      project_id_period_month_period_year: {
        project_id: projectId,
        period_month: periodMonth,
        period_year: periodYear,
      },
    },
    create: {
      project_id: projectId,
      period_month: periodMonth,
      period_year: periodYear,
      subscription_costs: costs.subscription_costs,
      staff_costs: costs.staff_costs,
      contractor_costs: costs.contractor_costs,
      other_costs: costs.other_costs,
      total_costs: costs.total_costs,
      revenue: existingRevenue,
      roi,
    },
    update: {
      subscription_costs: costs.subscription_costs,
      staff_costs: costs.staff_costs,
      contractor_costs: costs.contractor_costs,
      other_costs: costs.other_costs,
      total_costs: costs.total_costs,
      roi,
    },
  });

  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${projectId}`);

  return {
    ...snapshot,
    subscription_costs: Number(snapshot.subscription_costs),
    staff_costs: Number(snapshot.staff_costs),
    contractor_costs: Number(snapshot.contractor_costs),
    other_costs: Number(snapshot.other_costs),
    total_costs: Number(snapshot.total_costs),
    revenue: Number(snapshot.revenue),
    roi: snapshot.roi !== null ? Number(snapshot.roi) : null,
  };
}

/**
 * T028: Update revenue for a project snapshot and recalculate ROI.
 * Validates input, fetches or computes costs if no snapshot exists, then upserts.
 *
 * @param data - Unknown input validated against projectRevenueSchema.
 * @returns Success indicator with the upserted snapshot data.
 */
export async function updateProjectRevenue(data: unknown) {
  const validated = projectRevenueSchema.parse(data);

  const organizationId = await getOrganizationId();

  const project = await prisma.project.findFirst({
    where: {
      id: validated.project_id,
      organization_id: organizationId,
      deleted_at: null,
    },
  });

  if (!project) {
    throw new Error('Project not found or access denied');
  }

  const existingSnapshot = await prisma.projectCostSnapshot.findFirst({
    where: {
      project_id: validated.project_id,
      period_month: validated.month,
      period_year: validated.year,
    },
  });

  let costs: {
    subscription_costs: number;
    staff_costs: number;
    contractor_costs: number;
    other_costs: number;
    total_costs: number;
  };

  if (existingSnapshot) {
    costs = {
      subscription_costs: Number(existingSnapshot.subscription_costs),
      staff_costs: Number(existingSnapshot.staff_costs),
      contractor_costs: Number(existingSnapshot.contractor_costs),
      other_costs: Number(existingSnapshot.other_costs),
      total_costs: Number(existingSnapshot.total_costs),
    };
  } else {
    costs = await calculateProjectCosts(
      validated.project_id,
      validated.month,
      validated.year,
    );
  }

  const totalCosts = costs.total_costs;
  const roi =
    validated.revenue === 0
      ? null
      : totalCosts === 0
        ? null
        : (validated.revenue - totalCosts) / totalCosts;

  const snapshot = await prisma.projectCostSnapshot.upsert({
    where: {
      project_id_period_month_period_year: {
        project_id: validated.project_id,
        period_month: validated.month,
        period_year: validated.year,
      },
    },
    create: {
      project_id: validated.project_id,
      period_month: validated.month,
      period_year: validated.year,
      subscription_costs: costs.subscription_costs,
      staff_costs: costs.staff_costs,
      contractor_costs: costs.contractor_costs,
      other_costs: costs.other_costs,
      total_costs: costs.total_costs,
      revenue: validated.revenue,
      roi,
    },
    update: {
      revenue: validated.revenue,
      roi,
    },
  });

  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${validated.project_id}`);

  return {
    success: true,
    snapshot: {
      ...snapshot,
      subscription_costs: Number(snapshot.subscription_costs),
      staff_costs: Number(snapshot.staff_costs),
      contractor_costs: Number(snapshot.contractor_costs),
      other_costs: Number(snapshot.other_costs),
      total_costs: Number(snapshot.total_costs),
      revenue: Number(snapshot.revenue),
      roi: snapshot.roi !== null ? Number(snapshot.roi) : null,
    },
  };
}

/**
 * T029: Aggregate portfolio-level metrics across all active projects for the current period.
 * Returns counts, investment totals, revenue, ROI, and budget/ROI warnings.
 *
 * @returns Portfolio summary with all Decimal fields converted to plain numbers.
 */
export async function getPortfolioSummary() {
  const organizationId = await getOrganizationId();

  const projects = await prisma.project.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
    },
    select: {
      id: true,
      status: true,
      budget_target: true,
    },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const projectIds = projects.map((p) => p.id);

  const snapshots = await prisma.projectCostSnapshot.findMany({
    where: {
      project_id: { in: projectIds },
      period_month: currentMonth,
      period_year: currentYear,
    },
  });

  const snapshotsByProjectId = new Map(
    snapshots.map((s) => [s.project_id, s]),
  );

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  let totalInvestment = 0;
  let totalRevenue = 0;
  let projectsOverBudget = 0;
  let projectsNegativeRoi = 0;

  for (const project of projects) {
    const snapshot = snapshotsByProjectId.get(project.id);
    if (!snapshot) continue;

    const snapshotTotalCosts = Number(snapshot.total_costs);
    const snapshotRevenue = Number(snapshot.revenue);
    const snapshotRoi = snapshot.roi !== null ? Number(snapshot.roi) : null;

    totalInvestment += snapshotTotalCosts;
    totalRevenue += snapshotRevenue;

    if (
      project.budget_target !== null &&
      snapshotTotalCosts > Number(project.budget_target)
    ) {
      projectsOverBudget++;
    }

    if (snapshotRoi !== null && snapshotRoi < 0) {
      projectsNegativeRoi++;
    }
  }

  const overallRoi =
    totalRevenue === 0 || totalInvestment === 0
      ? null
      : (totalRevenue - totalInvestment) / totalInvestment;

  return {
    total_projects: totalProjects,
    active_projects: activeProjects,
    total_investment: totalInvestment,
    total_revenue: totalRevenue,
    overall_roi: overallRoi,
    projects_over_budget: projectsOverBudget,
    projects_negative_roi: projectsNegativeRoi,
  };
}
