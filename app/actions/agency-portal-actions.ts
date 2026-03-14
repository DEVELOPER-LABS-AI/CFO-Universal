'use server';

import { prisma } from '@/lib/prisma';
import { requireAgencyAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import {
  addAgencyStaffSchema,
  updateAgencyStaffSchema,
  addAgencyServiceSchema,
  updateAgencyServiceSchema,
} from '@/lib/validations/agency-invoice';
import { createStaffBonusSchema } from '@/lib/validations/bonus';
import { createStaffReimbursementSchema } from '@/lib/validations/reimbursement';

// ============================================================================
// STAFF MANAGEMENT (Agency-scoped)
// ============================================================================

/**
 * Get all active staff for the agency admin's agency
 */
export async function getAgencyStaff() {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const staff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
    include: {
      bonuses: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 5,
      },
      reimbursements: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 5,
      },
    },
    orderBy: { name: 'asc' },
  });

  // Strip margin/markup fields — agency admins must not see true cost or markup data
  return staff.map(({ true_cost, true_cost_rate_type, markup_override_type, markup_override_value, rate_locked, ...rest }) => rest);
}

/**
 * Add a new staff member to the agency
 */
export async function addAgencyStaff(data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = addAgencyStaffSchema.parse(data);

  // Check for duplicate name within agency
  const existing = await prisma.staff.findFirst({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });

  if (existing) {
    throw new Error('A staff member with this name already exists in your agency');
  }

  const created = await prisma.staff.create({
    data: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      name: validated.name,
      staff_type: validated.staff_type,
      rate: validated.rate,
      rate_type: validated.rate_type,
      engagement_type: validated.engagement_type,
    },
  });

  revalidatePath('/agency-portal/staff');
  const { true_cost, true_cost_rate_type, markup_override_type, markup_override_value, rate_locked, ...safeStaff } = created;
  return safeStaff;
}

/**
 * Update a staff member (must belong to agency)
 */
export async function updateAgencyStaff(staffId: string, data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = updateAgencyStaffSchema.parse(data);

  // Verify staff belongs to this agency
  const existing = await prisma.staff.findFirst({
    where: {
      id: staffId,
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
  });

  if (!existing) {
    throw new Error('Staff member not found');
  }

  const updated = await prisma.staff.update({
    where: { id: staffId },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.staff_type && { staff_type: validated.staff_type }),
      ...(validated.rate !== undefined && { rate: validated.rate }),
      ...(validated.rate_type && { rate_type: validated.rate_type }),
      ...(validated.engagement_type && { engagement_type: validated.engagement_type }),
    },
  });

  revalidatePath('/agency-portal/staff');
  const { true_cost, true_cost_rate_type, markup_override_type, markup_override_value, rate_locked, ...safeStaff } = updated;
  return safeStaff;
}

/**
 * Soft-delete a staff member (must belong to agency)
 */
export async function removeAgencyStaff(staffId: string) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const existing = await prisma.staff.findFirst({
    where: {
      id: staffId,
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
  });

  if (!existing) {
    throw new Error('Staff member not found');
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/agency-portal/staff');
  return { success: true };
}

// ============================================================================
// BONUS MANAGEMENT (Agency-scoped)
// ============================================================================

/**
 * Get bonuses for agency staff in a given period
 */
export async function getAgencyBonuses(month?: number, year?: number) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  // Get all agency staff IDs first
  const agencyStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
    select: { id: true },
  });

  const staffIds = agencyStaff.map((s) => s.id);

  const bonuses = await prisma.staffBonus.findMany({
    where: {
      staff_id: { in: staffIds },
      month: targetMonth,
      year: targetYear,
    },
    include: {
      staff: { select: { id: true, name: true, staff_type: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return bonuses;
}

/**
 * Add a bonus for an agency staff member
 */
export async function addAgencyBonus(data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = createStaffBonusSchema.parse(data);

  // Verify staff belongs to this agency
  const staff = await prisma.staff.findFirst({
    where: {
      id: validated.staff_id,
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
  });

  if (!staff) {
    throw new Error('Staff member not found in your agency');
  }

  const bonus = await prisma.staffBonus.create({
    data: {
      staff_id: validated.staff_id,
      bonus_type: validated.bonus_type,
      amount: validated.amount,
      description: validated.description,
      month: validated.month,
      year: validated.year,
      created_by: user.userId,
    },
  });

  revalidatePath('/agency-portal/staff');
  revalidatePath('/agency-portal/invoices');
  return bonus;
}

/**
 * Remove a bonus (must be for agency staff and not yet paid)
 */
export async function removeAgencyBonus(bonusId: string) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const bonus = await prisma.staffBonus.findUnique({
    where: { id: bonusId },
    include: { staff: { select: { agency_id: true, organization_id: true } } },
  });

  if (!bonus || bonus.staff.organization_id !== organizationId || bonus.staff.agency_id !== user.agencyId) {
    throw new Error('Bonus not found');
  }

  if (bonus.is_paid) {
    throw new Error('Cannot remove a bonus that has already been paid');
  }

  await prisma.staffBonus.delete({
    where: { id: bonusId },
  });

  revalidatePath('/agency-portal/staff');
  revalidatePath('/agency-portal/invoices');
  return { success: true };
}

// ============================================================================
// REIMBURSEMENT MANAGEMENT (Agency-scoped)
// ============================================================================

/**
 * Get reimbursements for agency staff in a given period.
 */
export async function getAgencyReimbursements(month?: number, year?: number) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const agencyStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
    select: { id: true },
  });

  const staffIds = agencyStaff.map((s) => s.id);

  const reimbursements = await prisma.staffReimbursement.findMany({
    where: {
      staff_id: { in: staffIds },
      month: targetMonth,
      year: targetYear,
    },
    include: {
      staff: { select: { id: true, name: true, staff_type: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return reimbursements;
}

/**
 * Add a reimbursement for an agency staff member.
 */
export async function addAgencyReimbursement(data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = createStaffReimbursementSchema.parse(data);

  // Verify staff belongs to this agency
  const staff = await prisma.staff.findFirst({
    where: {
      id: validated.staff_id,
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
  });

  if (!staff) {
    throw new Error('Staff member not found in your agency');
  }

  const reimbursement = await prisma.staffReimbursement.create({
    data: {
      staff_id: validated.staff_id,
      reimbursement_type: validated.reimbursement_type,
      amount: validated.amount,
      description: validated.description ?? null,
      receipt_url: validated.receipt_url ?? null,
      month: validated.month,
      year: validated.year,
      created_by: user.userId,
    },
  });

  revalidatePath('/agency-portal/staff');
  revalidatePath('/agency-portal/invoices');
  return reimbursement;
}

/**
 * Remove a reimbursement (must be for agency staff and not yet paid).
 */
export async function removeAgencyReimbursement(reimbursementId: string) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const reimbursement = await prisma.staffReimbursement.findUnique({
    where: { id: reimbursementId },
    include: { staff: { select: { agency_id: true, organization_id: true } } },
  });

  if (!reimbursement || reimbursement.staff.organization_id !== organizationId || reimbursement.staff.agency_id !== user.agencyId) {
    throw new Error('Reimbursement not found');
  }

  if (reimbursement.is_paid) {
    throw new Error('Cannot remove a reimbursement that has already been paid');
  }

  await prisma.staffReimbursement.delete({
    where: { id: reimbursementId },
  });

  revalidatePath('/agency-portal/staff');
  revalidatePath('/agency-portal/invoices');
  return { success: true };
}

// ============================================================================
// SERVICE MANAGEMENT (Agency-scoped)
// ============================================================================

/**
 * Get services for the agency's organization
 */
export async function getAgencyServices() {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  // Agency services are org-scoped services
  const services = await prisma.service.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      deleted_at: null,
    },
    orderBy: { name: 'asc' },
  });

  return services;
}

/**
 * Add a service the agency provides
 */
export async function addAgencyService(data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = addAgencyServiceSchema.parse(data);

  // Check for duplicate name
  const existing = await prisma.service.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });

  if (existing) {
    throw new Error('A service with this name already exists');
  }

  const service = await prisma.service.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      description: validated.description ?? null,
      standard_rate: validated.standard_rate,
      billing_type: validated.billing_type,
      target_margin: validated.target_margin,
    },
  });

  revalidatePath('/agency-portal/services');
  return service;
}

/**
 * Update a service
 */
export async function updateAgencyService(serviceId: string, data: unknown) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();
  const validated = updateAgencyServiceSchema.parse(data);

  const existing = await prisma.service.findFirst({
    where: {
      id: serviceId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });

  if (!existing) {
    throw new Error('Service not found');
  }

  const service = await prisma.service.update({
    where: { id: serviceId },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.description !== undefined && { description: validated.description ?? null }),
      ...(validated.standard_rate !== undefined && { standard_rate: validated.standard_rate }),
      ...(validated.billing_type !== undefined && { billing_type: validated.billing_type }),
      ...(validated.target_margin !== undefined && { target_margin: validated.target_margin }),
    },
  });

  revalidatePath('/agency-portal/services');
  return service;
}

/**
 * Soft-delete a service
 */
export async function removeAgencyService(serviceId: string) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const existing = await prisma.service.findFirst({
    where: {
      id: serviceId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });

  if (!existing) {
    throw new Error('Service not found');
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/agency-portal/services');
  return { success: true };
}

/**
 * Get the agency info for the current agency admin
 */
export async function getAgencyInfo() {
  const user = await requireAgencyAdmin();

  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId },
    include: {
      _count: {
        select: {
          staff: { where: { deleted_at: null } },
          invoices: true,
        },
      },
    },
  });

  if (!agency) {
    throw new Error('Agency not found');
  }

  // Strip markup fields — agency admins must not see markup configuration
  const { markup_type, markup_value, markup_basis, ...safeAgency } = agency;
  return safeAgency;
}

// ============================================================================
// TIMESHEET MANAGEMENT (Agency-scoped)
// ============================================================================

/**
 * Get all timesheets for the agency admin's staff with filters and pagination.
 * Agency admins can see all statuses (DRAFT, SUBMITTED, APPROVED, REJECTED).
 */
export async function getAgencyTimesheets(params: {
  status?: string;
  staff_id?: string;
  period_start?: string;
  period_end?: string;
  page?: number;
  per_page?: number;
}) {
  try {
    const user = await requireAgencyAdmin();
    const organizationId = await getOrganizationId();

    // Pagination defaults and bounds
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(100, Math.max(1, params.per_page ?? 20));
    const skip = (page - 1) * perPage;

    // Get all agency staff IDs for scoping
    const agencyStaff = await prisma.staff.findMany({
      where: {
        organization_id: organizationId,
        agency_id: user.agencyId,
        deleted_at: null,
      },
      select: { id: true },
    });

    const staffIds = agencyStaff.map((s) => s.id);

    if (staffIds.length === 0) {
      return {
        success: true as const,
        data: [],
        pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      };
    }

    // Build where clause with filters
    const where: Prisma.TimesheetWhereInput = {
      organization_id: organizationId,
      staff_id: { in: staffIds },
      deleted_at: null,
    };

    if (params.status) {
      where.status = params.status as Prisma.EnumTimesheetStatusFilter;
    }

    if (params.staff_id) {
      // Validate the requested staff_id belongs to this agency
      if (!staffIds.includes(params.staff_id)) {
        return { success: false as const, error: 'Staff member not found in your agency' };
      }
      where.staff_id = params.staff_id;
    }

    if (params.period_start) {
      where.period_start = { gte: new Date(params.period_start) };
    }

    if (params.period_end) {
      where.period_end = { lte: new Date(params.period_end) };
    }

    // Query timesheets with count
    const [timesheets, total] = await Promise.all([
      prisma.timesheet.findMany({
        where,
        include: {
          staff: { select: { id: true, name: true, staff_type: true } },
          _count: { select: { entries: true } },
        },
        orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
        skip,
        take: perPage,
      }),
      prisma.timesheet.count({ where }),
    ]);

    // Convert Decimal fields to Number for serialization
    const data = timesheets.map((ts) => ({
      ...ts,
      total_hours: Number(ts.total_hours),
      billable_hours: Number(ts.billable_hours),
      overtime_hours: Number(ts.overtime_hours),
      entry_count: ts._count.entries,
      _count: undefined,
    }));

    return {
      success: true as const,
      data,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load timesheets',
    };
  }
}

/**
 * Review (approve/reject) a timesheet. Agency admins can only review their agency's staff.
 */
export async function reviewAgencyTimesheet(params: {
  timesheet_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}) {
  try {
    const user = await requireAgencyAdmin();
    const organizationId = await getOrganizationId();

    // Validate the timesheet exists and belongs to agency staff
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.timesheet_id },
      include: { staff: { select: { agency_id: true, organization_id: true, name: true } } },
    });

    if (
      !timesheet ||
      timesheet.deleted_at ||
      timesheet.staff.organization_id !== organizationId ||
      timesheet.staff.agency_id !== user.agencyId
    ) {
      return { success: false as const, error: 'Timesheet not found' };
    }

    if (timesheet.status !== 'SUBMITTED') {
      return { success: false as const, error: 'Only submitted timesheets can be reviewed' };
    }

    if (params.action === 'reject') {
      if (!params.rejection_reason || params.rejection_reason.trim().length < 10) {
        return {
          success: false as const,
          error: 'Rejection reason is required and must be at least 10 characters',
        };
      }
    }

    // Get UserProfile ID for reviewed_by FK
    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!userProfile) {
      return { success: false as const, error: 'User profile not found' };
    }

    if (params.action === 'approve') {
      const updated = await prisma.timesheet.update({
        where: { id: params.timesheet_id },
        data: {
          status: 'APPROVED',
          reviewed_at: new Date(),
          reviewed_by: userProfile.id,
          rejection_reason: null,
        },
      });

      // Create approval notification
      await prisma.notification.create({
        data: {
          organization_id: organizationId,
          type: 'TIMESHEET_APPROVED',
          priority: 'MEDIUM',
          title: 'Timesheet Approved',
          message: `Timesheet for ${timesheet.staff.name} has been approved.`,
          source: 'TIMESHEET_SYSTEM',
          related_entity_type: 'timesheet',
          related_entity_id: params.timesheet_id,
        },
      });

      revalidatePath('/agency-portal/timesheets');
      return { success: true as const, data: updated };
    }

    // Reject
    const updated = await prisma.timesheet.update({
      where: { id: params.timesheet_id },
      data: {
        status: 'REJECTED',
        reviewed_at: new Date(),
        reviewed_by: userProfile.id,
        rejection_reason: params.rejection_reason!.trim(),
      },
    });

    // Create rejection notification
    await prisma.notification.create({
      data: {
        organization_id: organizationId,
        type: 'TIMESHEET_REJECTED',
        priority: 'HIGH',
        title: 'Timesheet Rejected',
        message: `Timesheet for ${timesheet.staff.name} has been rejected: ${params.rejection_reason!.trim()}`,
        source: 'TIMESHEET_SYSTEM',
        related_entity_type: 'timesheet',
        related_entity_id: params.timesheet_id,
      },
    });

    revalidatePath('/agency-portal/timesheets');
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to review timesheet',
    };
  }
}

/**
 * Bulk approve timesheets. Agency admin can only approve their agency's staff timesheets.
 */
export async function bulkApproveAgencyTimesheets(params: {
  timesheet_ids: string[];
}) {
  try {
    const user = await requireAgencyAdmin();
    const organizationId = await getOrganizationId();

    if (!params.timesheet_ids || params.timesheet_ids.length === 0) {
      return { success: false as const, error: 'No timesheet IDs provided' };
    }

    if (params.timesheet_ids.length > 50) {
      return { success: false as const, error: 'Cannot bulk approve more than 50 timesheets at once' };
    }

    // Get UserProfile ID for reviewed_by FK
    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!userProfile) {
      return { success: false as const, error: 'User profile not found' };
    }

    const failed: { timesheet_id: string; reason: string }[] = [];
    let approvedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const timesheetId of params.timesheet_ids) {
        const timesheet = await tx.timesheet.findUnique({
          where: { id: timesheetId },
          include: { staff: { select: { agency_id: true, organization_id: true, name: true } } },
        });

        // Validate timesheet exists and belongs to agency
        if (
          !timesheet ||
          timesheet.deleted_at ||
          timesheet.staff.organization_id !== organizationId ||
          timesheet.staff.agency_id !== user.agencyId
        ) {
          failed.push({ timesheet_id: timesheetId, reason: 'Timesheet not found' });
          continue;
        }

        // Validate status is SUBMITTED
        if (timesheet.status !== 'SUBMITTED') {
          failed.push({
            timesheet_id: timesheetId,
            reason: `Timesheet status is ${timesheet.status}, expected SUBMITTED`,
          });
          continue;
        }

        // Approve the timesheet
        await tx.timesheet.update({
          where: { id: timesheetId },
          data: {
            status: 'APPROVED',
            reviewed_at: new Date(),
            reviewed_by: userProfile.id,
            rejection_reason: null,
          },
        });

        // Create approval notification
        await tx.notification.create({
          data: {
            organization_id: organizationId,
            type: 'TIMESHEET_APPROVED',
            priority: 'MEDIUM',
            title: 'Timesheet Approved',
            message: `Timesheet for ${timesheet.staff.name} has been approved.`,
            source: 'TIMESHEET_SYSTEM',
            related_entity_type: 'timesheet',
            related_entity_id: timesheetId,
          },
        });

        approvedCount++;
      }
    });

    revalidatePath('/agency-portal/timesheets');
    return { success: true as const, approved_count: approvedCount, failed };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to bulk approve timesheets',
    };
  }
}

// ============================================================================
// OVERTIME CONFIGURATION (Agency-scoped)
// ============================================================================

/**
 * Upsert overtime config for the agency admin's own agency.
 */
export async function upsertAgencyOvertimeConfig(input: {
  weekly_hours_threshold: number;
  overtime_multiplier: number;
  is_enabled: boolean;
}) {
  try {
    const user = await requireAgencyAdmin();
    const organizationId = await getOrganizationId();

    // Validate inputs
    if (input.weekly_hours_threshold <= 0 || input.weekly_hours_threshold > 168) {
      return { success: false as const, error: 'Threshold must be between 0 and 168' };
    }
    if (input.overtime_multiplier < 1.0 || input.overtime_multiplier > 5.0) {
      return { success: false as const, error: 'Multiplier must be between 1.0 and 5.0' };
    }

    const config = await prisma.overtimeConfig.upsert({
      where: {
        organization_id_agency_id: {
          organization_id: organizationId,
          agency_id: user.agencyId,
        },
      },
      update: {
        weekly_hours_threshold: input.weekly_hours_threshold,
        overtime_multiplier: input.overtime_multiplier,
        is_enabled: input.is_enabled,
      },
      create: {
        organization_id: organizationId,
        agency_id: user.agencyId,
        weekly_hours_threshold: input.weekly_hours_threshold,
        overtime_multiplier: input.overtime_multiplier,
        is_enabled: input.is_enabled,
      },
    });

    revalidatePath('/agency-portal');
    return {
      success: true as const,
      config: {
        id: config.id,
        weekly_hours_threshold: Number(config.weekly_hours_threshold),
        overtime_multiplier: Number(config.overtime_multiplier),
        is_enabled: config.is_enabled,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save overtime config',
    };
  }
}
