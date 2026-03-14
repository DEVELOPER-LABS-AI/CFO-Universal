'use server';

import { prisma } from '@/lib/prisma';
import { requireBDR } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import { saveBDRReportSchema, submitBDRReportSchema, getBDRReportSchema } from '@/lib/validations/bdr-report';
import { createBDRExpenseSchema, getBDRExpensesSchema } from '@/lib/validations/bdr-expense';
import { calculateTieredBonus, type BonusTier } from '@/lib/calculations/bdr-bonus';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the current active pay plan assignment for a BDR.
 */
async function getActivePayPlan(staffId: string) {
  const assignment = await prisma.bDRPayPlanAssignment.findFirst({
    where: {
      staff_id: staffId,
      effective_to: null,
    },
    include: {
      pay_plan: {
        include: {
          tiers: { orderBy: { sort_order: 'asc' } },
        },
      },
    },
  });
  return assignment?.pay_plan ?? null;
}

// ============================================================================
// T028: GET BDR DASHBOARD
// ============================================================================

export async function getBDRDashboard() {
  try {
    const user = await requireBDR();
    const organizationId = await getOrganizationId();

    const staff = await prisma.staff.findUnique({
      where: { id: user.bdrStaffId },
      select: { id: true, name: true, staff_type: true },
    });

    if (!staff) {
      return { success: false as const, error: 'BDR staff profile not found' };
    }

    // Current pay plan
    const payPlan = await getActivePayPlan(user.bdrStaffId);

    // Current month report
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentReport = await prisma.bDRMonthlyReport.findUnique({
      where: {
        staff_id_month_year: {
          staff_id: user.bdrStaffId,
          month: currentMonth,
          year: currentYear,
        },
      },
    });

    // Recent expenses (last 5)
    const recentExpenses = await prisma.bDRExpenseClaim.findMany({
      where: { staff_id: user.bdrStaffId },
      include: { category: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    // Monthly stats
    const approvedExpenses = await prisma.bDRExpenseClaim.aggregate({
      where: {
        staff_id: user.bdrStaffId,
        status: 'APPROVED',
        expense_date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
      _sum: { amount: true },
    });

    const pendingExpenses = await prisma.bDRExpenseClaim.aggregate({
      where: {
        staff_id: user.bdrStaffId,
        status: 'SUBMITTED',
        expense_date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
      _sum: { amount: true },
    });

    return {
      success: true as const,
      data: {
        bdr: { id: staff.id, name: staff.name, staffType: staff.staff_type },
        currentPayPlan: payPlan ? {
          id: payPlan.id,
          name: payPlan.name,
          baseMetric: payPlan.base_metric,
          tiers: payPlan.tiers.map((t) => ({
            minThreshold: t.min_threshold,
            maxThreshold: t.max_threshold,
            payoutRate: Number(t.payout_rate),
            sortOrder: t.sort_order,
          })),
        } : null,
        currentReport: currentReport ? {
          id: currentReport.id,
          month: currentReport.month,
          year: currentReport.year,
          meetingsBooked: currentReport.meetings_booked,
          meetingsShowed: currentReport.meetings_showed,
          calculatedBonus: Number(currentReport.calculated_bonus),
          status: currentReport.status,
        } : null,
        recentExpenses: recentExpenses.map((e) => ({
          id: e.id,
          expenseDate: e.expense_date.toISOString(),
          category: e.category.name,
          amount: Number(e.amount),
          status: e.status,
        })),
        monthlyStats: {
          totalBonus: currentReport ? Number(currentReport.calculated_bonus) : 0,
          totalExpensesApproved: Number(approvedExpenses._sum.amount ?? 0),
          totalExpensesPending: Number(pendingExpenses._sum.amount ?? 0),
        },
      },
    };
  } catch (error) {
    console.error('getBDRDashboard error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load dashboard',
    };
  }
}

// ============================================================================
// T029: GET BDR MONTHLY REPORT
// ============================================================================

export async function getBDRMonthlyReport(input: unknown) {
  try {
    const user = await requireBDR();
    const validated = getBDRReportSchema.parse(input);

    const report = await prisma.bDRMonthlyReport.findUnique({
      where: {
        staff_id_month_year: {
          staff_id: user.bdrStaffId,
          month: validated.month,
          year: validated.year,
        },
      },
    });

    const payPlan = await getActivePayPlan(user.bdrStaffId);

    return {
      success: true as const,
      data: {
        report: report ? {
          id: report.id,
          month: report.month,
          year: report.year,
          meetingsBooked: report.meetings_booked,
          meetingsShowed: report.meetings_showed,
          calculatedBonus: Number(report.calculated_bonus),
          bonusBreakdown: (report.bonus_breakdown as any[]) ?? [],
          status: report.status,
          notes: report.notes,
          adminNotes: report.admin_notes,
          submittedAt: report.submitted_at?.toISOString() ?? null,
          approvedAt: report.approved_at?.toISOString() ?? null,
        } : null,
        payPlan: payPlan ? {
          id: payPlan.id,
          name: payPlan.name,
          baseMetric: payPlan.base_metric,
          tiers: payPlan.tiers.map((t) => ({
            minThreshold: t.min_threshold,
            maxThreshold: t.max_threshold,
            payoutRate: Number(t.payout_rate),
            sortOrder: t.sort_order,
          })),
        } : null,
      },
    };
  } catch (error) {
    console.error('getBDRMonthlyReport error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load report',
    };
  }
}

// ============================================================================
// T030: SAVE BDR REPORT
// ============================================================================

export async function saveBDRReport(input: unknown) {
  try {
    const user = await requireBDR();
    const organizationId = await getOrganizationId();
    const validated = saveBDRReportSchema.parse(input);

    // Check if report already exists
    const existing = await prisma.bDRMonthlyReport.findUnique({
      where: {
        staff_id_month_year: {
          staff_id: user.bdrStaffId,
          month: validated.month,
          year: validated.year,
        },
      },
    });

    // Only allow save if DRAFT or NEEDS_CORRECTION
    if (existing && existing.status !== 'DRAFT' && existing.status !== 'NEEDS_CORRECTION') {
      return { success: false as const, error: `Cannot edit report with status: ${existing.status}` };
    }

    // Get active pay plan for bonus calculation
    const payPlan = await getActivePayPlan(user.bdrStaffId);
    let calculatedBonus = 0;
    let bonusBreakdown: any[] = [];

    if (payPlan) {
      const tiers: BonusTier[] = payPlan.tiers.map((t) => ({
        minThreshold: t.min_threshold,
        maxThreshold: t.max_threshold,
        payoutRate: Number(t.payout_rate),
        sortOrder: t.sort_order,
      }));

      // Use the pay plan's base metric to determine which value to calculate on
      const metricValue = payPlan.base_metric === 'MEETINGS_SHOWED'
        ? validated.meetings_showed
        : validated.meetings_booked;

      const result = calculateTieredBonus(metricValue, tiers);
      calculatedBonus = result.total;
      bonusBreakdown = result.breakdown;
    }

    // Upsert report
    const report = await prisma.bDRMonthlyReport.upsert({
      where: {
        staff_id_month_year: {
          staff_id: user.bdrStaffId,
          month: validated.month,
          year: validated.year,
        },
      },
      update: {
        meetings_booked: validated.meetings_booked,
        meetings_showed: validated.meetings_showed,
        notes: validated.notes ?? null,
        calculated_bonus: calculatedBonus,
        bonus_breakdown: bonusBreakdown,
        pay_plan_id: payPlan?.id ?? null,
      },
      create: {
        organization_id: organizationId,
        staff_id: user.bdrStaffId,
        month: validated.month,
        year: validated.year,
        meetings_booked: validated.meetings_booked,
        meetings_showed: validated.meetings_showed,
        notes: validated.notes ?? null,
        calculated_bonus: calculatedBonus,
        bonus_breakdown: bonusBreakdown,
        pay_plan_id: payPlan?.id ?? null,
        status: 'DRAFT',
      },
    });

    revalidatePath('/bdr-portal/reports');
    revalidatePath('/bdr-portal');

    return {
      success: true as const,
      data: {
        id: report.id,
        calculatedBonus: Number(report.calculated_bonus),
        bonusBreakdown,
        status: report.status,
      },
    };
  } catch (error) {
    console.error('saveBDRReport error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save report',
    };
  }
}

// ============================================================================
// T031: SUBMIT BDR REPORT
// ============================================================================

export async function submitBDRReport(input: unknown) {
  try {
    const user = await requireBDR();
    const validated = submitBDRReportSchema.parse(input);

    // Validate report belongs to BDR
    const report = await prisma.bDRMonthlyReport.findFirst({
      where: { id: validated.report_id, staff_id: user.bdrStaffId },
    });

    if (!report) {
      return { success: false as const, error: 'Report not found' };
    }

    if (report.status !== 'DRAFT' && report.status !== 'NEEDS_CORRECTION') {
      return { success: false as const, error: `Cannot submit report with status: ${report.status}` };
    }

    // Get active pay plan to snapshot
    const payPlan = await getActivePayPlan(user.bdrStaffId);

    const updated = await prisma.bDRMonthlyReport.update({
      where: { id: validated.report_id },
      data: {
        status: 'SUBMITTED',
        submitted_at: new Date(),
        pay_plan_id: payPlan?.id ?? report.pay_plan_id,
      },
    });

    revalidatePath('/bdr-portal/reports');
    revalidatePath('/bdr-portal');

    return {
      success: true as const,
      data: {
        id: updated.id,
        status: updated.status as 'SUBMITTED',
        submittedAt: updated.submitted_at!.toISOString(),
      },
    };
  } catch (error) {
    console.error('submitBDRReport error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to submit report',
    };
  }
}

// ============================================================================
// T041: GET EXPENSE CATEGORIES
// ============================================================================

export async function getExpenseCategories() {
  try {
    await requireBDR();
    const organizationId = await getOrganizationId();

    const categories = await prisma.bDRExpenseCategory.findMany({
      where: { organization_id: organizationId, is_active: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return { success: true as const, data: categories };
  } catch (error) {
    console.error('getExpenseCategories error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load categories',
    };
  }
}

// ============================================================================
// T042: CREATE BDR EXPENSE
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export async function createBDRExpense(formData: FormData) {
  try {
    const user = await requireBDR();
    const organizationId = await getOrganizationId();

    // Parse form fields
    const expenseDate = formData.get('expense_date') as string;
    const categoryId = formData.get('category_id') as string;
    const amountStr = formData.get('amount') as string;
    const description = formData.get('description') as string | null;
    const receipt = formData.get('receipt') as File | null;

    const validated = createBDRExpenseSchema.parse({
      expense_date: expenseDate,
      category_id: categoryId,
      amount: parseFloat(amountStr),
      description: description || undefined,
    });

    // Validate category belongs to org
    const category = await prisma.bDRExpenseCategory.findFirst({
      where: { id: validated.category_id, organization_id: organizationId, is_active: true },
    });
    if (!category) {
      return { success: false as const, error: 'Invalid expense category' };
    }

    let receiptPath: string | null = null;
    let receiptFileName: string | null = null;
    let receiptFileSize: number | null = null;
    let receiptMimeType: string | null = null;
    let hasReceipt = false;

    // Handle receipt upload
    if (receipt && receipt instanceof File && receipt.size > 0) {
      if (receipt.size > MAX_FILE_SIZE) {
        return { success: false as const, error: 'File size exceeds 10 MB' };
      }
      if (!ALLOWED_MIME_TYPES.includes(receipt.type)) {
        return { success: false as const, error: 'File type not allowed. Accepted: PDF, JPG, PNG' };
      }

      // Create a temporary expense ID for the path
      const tempId = crypto.randomUUID();
      const ext = receipt.name.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${ext}`;
      receiptPath = `bdr-receipts/${organizationId}/${user.bdrStaffId}/${tempId}/${fileName}`;
      receiptFileName = receipt.name;
      receiptFileSize = receipt.size;
      receiptMimeType = receipt.type;
      hasReceipt = true;

      // Upload to Supabase Storage
      const buffer = Buffer.from(await receipt.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from('bdr-receipts')
        .upload(receiptPath.replace('bdr-receipts/', ''), buffer, {
          contentType: receipt.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Receipt upload error:', uploadError);
        return { success: false as const, error: 'Failed to upload receipt' };
      }
    }

    // Create expense claim
    const expense = await prisma.bDRExpenseClaim.create({
      data: {
        organization_id: organizationId,
        staff_id: user.bdrStaffId,
        expense_date: new Date(validated.expense_date),
        category_id: validated.category_id,
        amount: validated.amount,
        description: validated.description ?? null,
        receipt_path: receiptPath,
        receipt_file_name: receiptFileName,
        receipt_file_size: receiptFileSize,
        receipt_mime_type: receiptMimeType,
        has_receipt: hasReceipt,
        status: 'SUBMITTED',
      },
    });

    revalidatePath('/bdr-portal/expenses');
    revalidatePath('/bdr-portal');

    return {
      success: true as const,
      data: { id: expense.id, status: 'SUBMITTED' as const, hasReceipt },
    };
  } catch (error) {
    console.error('createBDRExpense error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create expense',
    };
  }
}

// ============================================================================
// T043: GET BDR EXPENSES
// ============================================================================

export async function getBDRExpenses(input: unknown) {
  try {
    const user = await requireBDR();
    const validated = getBDRExpensesSchema.parse(input);

    const where: any = { staff_id: user.bdrStaffId };
    if (validated.status) where.status = validated.status;

    const [expenses, total] = await Promise.all([
      prisma.bDRExpenseClaim.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
        skip: (validated.page - 1) * validated.pageSize,
        take: validated.pageSize,
      }),
      prisma.bDRExpenseClaim.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        expenses: expenses.map((e) => ({
          id: e.id,
          expenseDate: e.expense_date.toISOString(),
          category: { id: e.category.id, name: e.category.name },
          amount: Number(e.amount),
          description: e.description,
          hasReceipt: e.has_receipt,
          status: e.status,
          adminNotes: e.admin_notes,
          createdAt: e.created_at.toISOString(),
        })),
        total,
        page: validated.page,
        pageSize: validated.pageSize,
      },
    };
  } catch (error) {
    console.error('getBDRExpenses error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load expenses',
    };
  }
}

// ============================================================================
// T044: GET RECEIPT URL (in bdr-portal-actions for simplicity)
// ============================================================================

export async function getReceiptUrl(input: { expense_id: string }) {
  try {
    const user = await requireBDR();

    const expense = await prisma.bDRExpenseClaim.findFirst({
      where: { id: input.expense_id, staff_id: user.bdrStaffId },
    });

    if (!expense || !expense.receipt_path) {
      return { success: false as const, error: 'Receipt not found' };
    }

    // Generate signed URL (1 hour expiry)
    const storagePath = expense.receipt_path.replace('bdr-receipts/', '');
    const { data, error } = await supabaseAdmin.storage
      .from('bdr-receipts')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return { success: false as const, error: 'Failed to generate receipt URL' };
    }

    return { success: true as const, data: { url: data.signedUrl } };
  } catch (error) {
    console.error('getReceiptUrl error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get receipt URL',
    };
  }
}
