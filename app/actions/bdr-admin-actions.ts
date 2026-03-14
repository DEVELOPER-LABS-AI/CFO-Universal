'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  createPayPlanSchema,
  updatePayPlanSchema,
  assignPayPlanSchema,
} from '@/lib/validations/bdr-pay-plan';
import {
  manageExpenseCategorySchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  markExpenseReimbursedSchema,
} from '@/lib/validations/bdr-expense';
import { calculateTieredBonus, type BonusTier } from '@/lib/calculations/bdr-bonus';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate that the authenticated user is ADMIN or AGENCY_ADMIN.
 */
async function requireAdminOrAgencyAdmin() {
  const user = await requireAuth();
  if (user.role !== 'ADMIN' && user.role !== 'AGENCY_ADMIN') {
    throw new Error('Forbidden - admin or agency admin access required');
  }
  return user;
}

/**
 * Validate tier ranges have no gaps or overlaps.
 */
function validateTierRanges(tiers: { min_threshold: number; max_threshold?: number | null }[]): string | null {
  if (tiers.length === 0) return 'At least one tier is required';

  const sorted = [...tiers].sort((a, b) => a.min_threshold - b.min_threshold);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const nextTier = sorted[i + 1];

    if (i === 0 && tier.min_threshold !== 1) {
      return 'First tier must start at 1';
    }

    if (nextTier) {
      // Current tier must have a max_threshold
      if (tier.max_threshold == null) {
        return 'Only the last tier can have an uncapped max threshold';
      }
      // Next tier min must be current max + 1 (no gaps/overlaps)
      if (nextTier.min_threshold !== tier.max_threshold + 1) {
        return `Tier gap/overlap detected: tier ending at ${tier.max_threshold} and next starting at ${nextTier.min_threshold}`;
      }
    }
  }

  return null;
}

// ============================================================================
// T020: CREATE PAY PLAN
// ============================================================================

export async function createPayPlan(input: unknown) {
  try {
    const user = await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = createPayPlanSchema.parse(input);

    // Validate tier ranges
    const tierError = validateTierRanges(validated.tiers);
    if (tierError) {
      return { success: false as const, error: tierError };
    }

    // Create pay plan + tiers in transaction
    const payPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.bDRPayPlan.create({
        data: {
          organization_id: organizationId,
          name: validated.name,
          description: validated.description ?? null,
          base_metric: validated.base_metric,
          effective_start: new Date(validated.effective_start),
          effective_end: validated.effective_end ? new Date(validated.effective_end) : null,
          created_by: user.userId,
        },
      });

      // Create tiers sorted by min_threshold
      const sortedTiers = [...validated.tiers].sort((a, b) => a.min_threshold - b.min_threshold);
      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        await tx.bDRBonusTier.create({
          data: {
            pay_plan_id: plan.id,
            min_threshold: tier.min_threshold,
            max_threshold: tier.max_threshold ?? null,
            payout_rate: tier.payout_rate,
            sort_order: i + 1,
          },
        });
      }

      return plan;
    });

    revalidatePath('/dashboard/bdr/pay-plans');

    return {
      success: true as const,
      data: {
        id: payPlan.id,
        name: payPlan.name,
        tierCount: validated.tiers.length,
      },
    };
  } catch (error) {
    console.error('createPayPlan error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create pay plan',
    };
  }
}

// ============================================================================
// T021: UPDATE PAY PLAN
// ============================================================================

export async function updatePayPlan(input: unknown) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = updatePayPlanSchema.parse(input);

    // Verify plan belongs to org
    const existing = await prisma.bDRPayPlan.findFirst({
      where: { id: validated.id, organization_id: organizationId },
    });
    if (!existing) {
      return { success: false as const, error: 'Pay plan not found' };
    }

    // Validate tier ranges if tiers provided
    if (validated.tiers) {
      const tierError = validateTierRanges(validated.tiers);
      if (tierError) {
        return { success: false as const, error: tierError };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update plan fields
      const plan = await tx.bDRPayPlan.update({
        where: { id: validated.id },
        data: {
          ...(validated.name && { name: validated.name }),
          ...(validated.description !== undefined && { description: validated.description }),
          ...(validated.base_metric && { base_metric: validated.base_metric }),
          ...(validated.effective_end !== undefined && {
            effective_end: validated.effective_end ? new Date(validated.effective_end) : null,
          }),
        },
      });

      // Replace all tiers if provided
      let tierCount = 0;
      if (validated.tiers) {
        await tx.bDRBonusTier.deleteMany({ where: { pay_plan_id: validated.id } });
        const sortedTiers = [...validated.tiers].sort((a, b) => a.min_threshold - b.min_threshold);
        for (let i = 0; i < sortedTiers.length; i++) {
          const tier = sortedTiers[i];
          await tx.bDRBonusTier.create({
            data: {
              pay_plan_id: plan.id,
              min_threshold: tier.min_threshold,
              max_threshold: tier.max_threshold ?? null,
              payout_rate: tier.payout_rate,
              sort_order: i + 1,
            },
          });
        }
        tierCount = sortedTiers.length;
      } else {
        tierCount = await tx.bDRBonusTier.count({ where: { pay_plan_id: plan.id } });
      }

      return { plan, tierCount };
    });

    revalidatePath('/dashboard/bdr/pay-plans');

    return {
      success: true as const,
      data: {
        id: result.plan.id,
        name: result.plan.name,
        tierCount: result.tierCount,
      },
    };
  } catch (error) {
    console.error('updatePayPlan error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update pay plan',
    };
  }
}

// ============================================================================
// T022: ASSIGN PAY PLAN
// ============================================================================

export async function assignPayPlan(input: unknown) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = assignPayPlanSchema.parse(input);

    // Verify plan belongs to org
    const plan = await prisma.bDRPayPlan.findFirst({
      where: { id: validated.pay_plan_id, organization_id: organizationId },
    });
    if (!plan) {
      return { success: false as const, error: 'Pay plan not found' };
    }

    // Verify staff is a BDR in this org
    const staff = await prisma.staff.findFirst({
      where: { id: validated.staff_id, organization_id: organizationId, staff_type: 'BDR' },
    });
    if (!staff) {
      return { success: false as const, error: 'Staff member not found or is not a BDR' };
    }

    // Close any existing active assignment
    await prisma.bDRPayPlanAssignment.updateMany({
      where: {
        staff_id: validated.staff_id,
        effective_to: null,
      },
      data: {
        effective_to: new Date(validated.effective_from),
      },
    });

    // Create new assignment
    const assignment = await prisma.bDRPayPlanAssignment.create({
      data: {
        pay_plan_id: validated.pay_plan_id,
        staff_id: validated.staff_id,
        effective_from: new Date(validated.effective_from),
      },
    });

    revalidatePath('/dashboard/bdr/pay-plans');

    return {
      success: true as const,
      data: {
        id: assignment.id,
        staffName: staff.name,
        planName: plan.name,
      },
    };
  } catch (error) {
    console.error('assignPayPlan error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to assign pay plan',
    };
  }
}

// ============================================================================
// T023: GET PAY PLANS
// ============================================================================

export async function getPayPlans() {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const plans = await prisma.bDRPayPlan.findMany({
      where: { organization_id: organizationId },
      include: {
        tiers: { orderBy: { sort_order: 'asc' } },
        assignments: {
          where: { effective_to: null },
          include: { staff: { select: { id: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      success: true as const,
      data: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        baseMetric: plan.base_metric,
        effectiveStart: plan.effective_start.toISOString(),
        effectiveEnd: plan.effective_end?.toISOString() ?? null,
        isActive: plan.is_active,
        tierCount: plan.tiers.length,
        assignedBDRCount: plan.assignments.length,
        tiers: plan.tiers.map((t) => ({
          minThreshold: t.min_threshold,
          maxThreshold: t.max_threshold,
          payoutRate: Number(t.payout_rate),
        })),
        assignedBDRs: plan.assignments.map((a) => ({
          staffId: a.staff.id,
          name: a.staff.name,
        })),
      })),
    };
  } catch (error) {
    console.error('getPayPlans error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get pay plans',
    };
  }
}

// ============================================================================
// T024: MANAGE EXPENSE CATEGORIES
// ============================================================================

export async function manageExpenseCategories(input: unknown) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = manageExpenseCategorySchema.parse(input);

    if (validated.action === 'create') {
      const category = await prisma.bDRExpenseCategory.create({
        data: {
          organization_id: organizationId,
          name: validated.name,
          description: validated.description ?? null,
        },
      });

      return {
        success: true as const,
        data: { id: category.id, name: category.name, isActive: category.is_active },
      };
    }

    // Update
    const existing = await prisma.bDRExpenseCategory.findFirst({
      where: { id: validated.id, organization_id: organizationId },
    });
    if (!existing) {
      return { success: false as const, error: 'Category not found' };
    }

    const category = await prisma.bDRExpenseCategory.update({
      where: { id: validated.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.is_active !== undefined && { is_active: validated.is_active }),
      },
    });

    revalidatePath('/dashboard/bdr/expenses');

    return {
      success: true as const,
      data: { id: category.id, name: category.name, isActive: category.is_active },
    };
  } catch (error) {
    console.error('manageExpenseCategories error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to manage expense category',
    };
  }
}

// ============================================================================
// GET BDR STAFF (helper for UI dropdowns)
// ============================================================================

export async function getBDRStaff() {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const bdrs = await prisma.staff.findMany({
      where: {
        organization_id: organizationId,
        staff_type: 'BDR',
        status: 'ACTIVE',
        deleted_at: null,
      },
      select: { id: true, name: true, staff_type: true },
      orderBy: { name: 'asc' },
    });

    return { success: true as const, data: bdrs };
  } catch (error) {
    console.error('getBDRStaff error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get BDR staff',
    };
  }
}

// ============================================================================
// T048: GET BDR REPORTS FOR REVIEW
// ============================================================================

export async function getBDRReportsForReview(input: { month: number; year: number }) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const reports = await prisma.bDRMonthlyReport.findMany({
      where: {
        organization_id: organizationId,
        month: input.month,
        year: input.year,
        status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_CORRECTION'] },
      },
      include: {
        staff: { select: { id: true, name: true } },
        pay_plan: {
          include: { tiers: { orderBy: { sort_order: 'asc' } } },
        },
      },
      orderBy: [{ status: 'asc' }, { submitted_at: 'asc' }],
    });

    // Monthly summary
    const summary = {
      totalReports: reports.length,
      submitted: reports.filter((r) => r.status === 'SUBMITTED').length,
      approved: reports.filter((r) => r.status === 'APPROVED').length,
      needsCorrection: reports.filter((r) => r.status === 'NEEDS_CORRECTION').length,
      totalBonusApproved: reports
        .filter((r) => r.status === 'APPROVED')
        .reduce((sum, r) => sum + Number(r.calculated_bonus), 0),
    };

    return {
      success: true as const,
      data: {
        reports: reports.map((r) => ({
          id: r.id,
          staffId: r.staff.id,
          staffName: r.staff.name,
          month: r.month,
          year: r.year,
          meetingsBooked: r.meetings_booked,
          meetingsShowed: r.meetings_showed,
          calculatedBonus: Number(r.calculated_bonus),
          bonusBreakdown: (r.bonus_breakdown as any[]) ?? [],
          status: r.status,
          notes: r.notes,
          adminNotes: r.admin_notes,
          submittedAt: r.submitted_at?.toISOString() ?? null,
          approvedAt: r.approved_at?.toISOString() ?? null,
          payPlanName: r.pay_plan?.name ?? null,
          baseMetric: r.pay_plan?.base_metric ?? null,
        })),
        summary,
      },
    };
  } catch (error) {
    console.error('getBDRReportsForReview error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load reports for review',
    };
  }
}

// ============================================================================
// T049: APPROVE REPORT
// ============================================================================

export async function approveReport(input: { report_id: string; admin_notes?: string }) {
  try {
    const user = await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const report = await prisma.bDRMonthlyReport.findFirst({
      where: { id: input.report_id, organization_id: organizationId },
    });

    if (!report) {
      return { success: false as const, error: 'Report not found' };
    }

    if (report.status !== 'SUBMITTED') {
      return { success: false as const, error: `Cannot approve report with status: ${report.status}` };
    }

    const updated = await prisma.bDRMonthlyReport.update({
      where: { id: input.report_id },
      data: {
        status: 'APPROVED',
        approved_at: new Date(),
        approved_by: user.userId,
        admin_notes: input.admin_notes ?? null,
      },
    });

    revalidatePath('/dashboard/bdr/reports');

    return {
      success: true as const,
      data: { id: updated.id, status: 'APPROVED' as const },
    };
  } catch (error) {
    console.error('approveReport error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to approve report',
    };
  }
}

// ============================================================================
// T050: FLAG REPORT FOR CORRECTION
// ============================================================================

export async function flagReportForCorrection(input: { report_id: string; admin_notes: string }) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    if (!input.admin_notes?.trim()) {
      return { success: false as const, error: 'Feedback notes are required when flagging for correction' };
    }

    const report = await prisma.bDRMonthlyReport.findFirst({
      where: { id: input.report_id, organization_id: organizationId },
    });

    if (!report) {
      return { success: false as const, error: 'Report not found' };
    }

    if (report.status !== 'SUBMITTED') {
      return { success: false as const, error: `Cannot flag report with status: ${report.status}` };
    }

    const updated = await prisma.bDRMonthlyReport.update({
      where: { id: input.report_id },
      data: {
        status: 'NEEDS_CORRECTION',
        admin_notes: input.admin_notes.trim(),
      },
    });

    revalidatePath('/dashboard/bdr/reports');

    return {
      success: true as const,
      data: { id: updated.id, status: 'NEEDS_CORRECTION' as const },
    };
  } catch (error) {
    console.error('flagReportForCorrection error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to flag report',
    };
  }
}

// ============================================================================
// T053: GET EXPENSES FOR APPROVAL + ADMIN RECEIPT URL
// ============================================================================

export async function getExpensesForApproval(input: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;

    const where: any = { organization_id: organizationId };
    if (input.status) {
      where.status = input.status;
    } else {
      where.status = { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] };
    }

    const [expenses, total, summaryAgg] = await Promise.all([
      prisma.bDRExpenseClaim.findMany({
        where,
        include: {
          staff: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bDRExpenseClaim.count({ where }),
      prisma.bDRExpenseClaim.groupBy({
        by: ['status'],
        where: { organization_id: organizationId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const summaryStats = {
      pendingAmount: 0,
      pendingCount: 0,
      approvedAmount: 0,
      approvedCount: 0,
      rejectedAmount: 0,
      rejectedCount: 0,
    };

    for (const group of summaryAgg) {
      const amount = Number(group._sum.amount ?? 0);
      if (group.status === 'SUBMITTED') {
        summaryStats.pendingAmount = amount;
        summaryStats.pendingCount = group._count;
      } else if (group.status === 'APPROVED') {
        summaryStats.approvedAmount = amount;
        summaryStats.approvedCount = group._count;
      } else if (group.status === 'REJECTED') {
        summaryStats.rejectedAmount = amount;
        summaryStats.rejectedCount = group._count;
      }
    }

    return {
      success: true as const,
      data: {
        expenses: expenses.map((e) => ({
          id: e.id,
          staffId: e.staff.id,
          staffName: e.staff.name,
          expenseDate: e.expense_date.toISOString(),
          category: e.category.name,
          amount: Number(e.amount),
          description: e.description,
          hasReceipt: e.has_receipt,
          status: e.status,
          adminNotes: e.admin_notes,
          createdAt: e.created_at.toISOString(),
        })),
        total,
        page,
        pageSize,
        summary: summaryStats,
      },
    };
  } catch (error) {
    console.error('getExpensesForApproval error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load expenses for approval',
    };
  }
}

/**
 * Generate a signed receipt URL for admin review.
 */
export async function getAdminReceiptUrl(input: { expense_id: string }) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    const expense = await prisma.bDRExpenseClaim.findFirst({
      where: { id: input.expense_id, organization_id: organizationId },
    });

    if (!expense || !expense.receipt_path) {
      return { success: false as const, error: 'Receipt not found' };
    }

    const storagePath = expense.receipt_path.replace('bdr-receipts/', '');
    const { data, error } = await supabaseAdmin.storage
      .from('bdr-receipts')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return { success: false as const, error: 'Failed to generate receipt URL' };
    }

    return { success: true as const, data: { url: data.signedUrl } };
  } catch (error) {
    console.error('getAdminReceiptUrl error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get receipt URL',
    };
  }
}

// ============================================================================
// T054: APPROVE, REJECT, MARK REIMBURSED EXPENSE
// ============================================================================

export async function approveExpense(input: unknown) {
  try {
    const user = await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = approveExpenseSchema.parse(input);

    const expense = await prisma.bDRExpenseClaim.findFirst({
      where: { id: validated.expense_id, organization_id: organizationId },
    });

    if (!expense) {
      return { success: false as const, error: 'Expense not found' };
    }

    if (expense.status !== 'SUBMITTED') {
      return { success: false as const, error: `Cannot approve expense with status: ${expense.status}` };
    }

    const updated = await prisma.bDRExpenseClaim.update({
      where: { id: validated.expense_id },
      data: {
        status: 'APPROVED',
        approved_at: new Date(),
        approved_by: user.userId,
        admin_notes: validated.admin_notes ?? null,
      },
    });

    revalidatePath('/dashboard/bdr/expenses');

    return {
      success: true as const,
      data: { id: updated.id, status: 'APPROVED' as const },
    };
  } catch (error) {
    console.error('approveExpense error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to approve expense',
    };
  }
}

export async function rejectExpense(input: unknown) {
  try {
    const user = await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = rejectExpenseSchema.parse(input);

    const expense = await prisma.bDRExpenseClaim.findFirst({
      where: { id: validated.expense_id, organization_id: organizationId },
    });

    if (!expense) {
      return { success: false as const, error: 'Expense not found' };
    }

    if (expense.status !== 'SUBMITTED') {
      return { success: false as const, error: `Cannot reject expense with status: ${expense.status}` };
    }

    const updated = await prisma.bDRExpenseClaim.update({
      where: { id: validated.expense_id },
      data: {
        status: 'REJECTED',
        approved_by: user.userId,
        admin_notes: validated.admin_notes,
      },
    });

    revalidatePath('/dashboard/bdr/expenses');

    return {
      success: true as const,
      data: { id: updated.id, status: 'REJECTED' as const },
    };
  } catch (error) {
    console.error('rejectExpense error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to reject expense',
    };
  }
}

export async function markExpenseReimbursed(input: unknown) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();
    const validated = markExpenseReimbursedSchema.parse(input);

    const expense = await prisma.bDRExpenseClaim.findFirst({
      where: { id: validated.expense_id, organization_id: organizationId },
    });

    if (!expense) {
      return { success: false as const, error: 'Expense not found' };
    }

    if (expense.status !== 'APPROVED') {
      return { success: false as const, error: `Cannot mark as reimbursed: expense is ${expense.status}` };
    }

    const updated = await prisma.bDRExpenseClaim.update({
      where: { id: validated.expense_id },
      data: { status: 'REIMBURSED' },
    });

    revalidatePath('/dashboard/bdr/expenses');

    return {
      success: true as const,
      data: { id: updated.id, status: 'REIMBURSED' as const },
    };
  } catch (error) {
    console.error('markExpenseReimbursed error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to mark expense as reimbursed',
    };
  }
}

// ============================================================================
// T057: GET BDR COMPENSATION SUMMARY
// ============================================================================

export async function getBDRCompensationSummary(input: { month: number; year: number }) {
  try {
    await requireAdminOrAgencyAdmin();
    const organizationId = await getOrganizationId();

    // Get all BDR staff for this org
    const bdrStaff = await prisma.staff.findMany({
      where: {
        organization_id: organizationId,
        staff_type: 'BDR',
        deleted_at: null,
      },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });

    // Get approved reports for this month
    const reports = await prisma.bDRMonthlyReport.findMany({
      where: {
        organization_id: organizationId,
        month: input.month,
        year: input.year,
        status: 'APPROVED',
      },
    });

    // Get approved + reimbursed expenses for this month
    const expenses = await prisma.bDRExpenseClaim.findMany({
      where: {
        organization_id: organizationId,
        status: { in: ['APPROVED', 'REIMBURSED'] },
        expense_date: {
          gte: new Date(input.year, input.month - 1, 1),
          lt: new Date(input.year, input.month, 1),
        },
      },
    });

    // Build per-BDR breakdown
    const reportsByStaff = new Map(reports.map((r) => [r.staff_id, r]));
    const expensesByStaff = new Map<string, typeof expenses>();
    for (const e of expenses) {
      const list = expensesByStaff.get(e.staff_id) ?? [];
      list.push(e);
      expensesByStaff.set(e.staff_id, list);
    }

    let totalBonuses = 0;
    let totalExpenses = 0;

    const perBDR = bdrStaff.map((staff) => {
      const report = reportsByStaff.get(staff.id);
      const staffExpenses = expensesByStaff.get(staff.id) ?? [];

      const bonus = report ? Number(report.calculated_bonus) : 0;
      const expenseTotal = staffExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const total = bonus + expenseTotal;

      totalBonuses += bonus;
      totalExpenses += expenseTotal;

      return {
        staffId: staff.id,
        staffName: staff.name,
        status: staff.status,
        bonus: Math.round(bonus * 100) / 100,
        meetingsBooked: report?.meetings_booked ?? 0,
        meetingsShowed: report?.meetings_showed ?? 0,
        reportStatus: report?.status ?? null,
        expenseCount: staffExpenses.length,
        expenseTotal: Math.round(expenseTotal * 100) / 100,
        grandTotal: Math.round(total * 100) / 100,
      };
    });

    return {
      success: true as const,
      data: {
        month: input.month,
        year: input.year,
        summary: {
          totalBonuses: Math.round(totalBonuses * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          grandTotal: Math.round((totalBonuses + totalExpenses) * 100) / 100,
          bdrCount: bdrStaff.length,
          reportsApproved: reports.length,
        },
        perBDR,
      },
    };
  } catch (error) {
    console.error('getBDRCompensationSummary error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load compensation summary',
    };
  }
}
