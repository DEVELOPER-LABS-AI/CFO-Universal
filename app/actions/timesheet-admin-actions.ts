'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  reviewTimesheetSchema,
  bulkApproveTimesheetsSchema,
  upsertOvertimeConfigSchema,
} from '@/lib/validations/timesheet';

// ---------------------------------------------------------------------------
// T023: reviewTimesheet
// ---------------------------------------------------------------------------

export async function reviewTimesheet(input: {
  timesheet_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Must be admin, executive, or agency_admin
    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE' && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Admin or executive access required' };
    }

    const parsed = reviewTimesheetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const { timesheet_id, action, rejection_reason } = parsed.data;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheet_id },
      include: {
        staff: { select: { name: true, agency_id: true } },
      },
    });

    if (!timesheet || timesheet.organization_id !== organizationId) {
      return { success: false as const, error: 'Timesheet not found' };
    }

    // Agency admins can only review their agency's staff
    if (user.role === 'AGENCY_ADMIN') {
      if (!user.agencyId || timesheet.staff.agency_id !== user.agencyId) {
        return { success: false as const, error: 'Access denied — staff not in your agency' };
      }
    }

    // Must be in SUBMITTED status
    if (timesheet.status !== 'SUBMITTED') {
      return { success: false as const, error: 'Timesheet must be in SUBMITTED status to review' };
    }

    // Get the reviewer's UserProfile ID
    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!userProfile) {
      return { success: false as const, error: 'User profile not found' };
    }

    // Update timesheet
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const updated = await prisma.timesheet.update({
      where: { id: timesheet.id },
      data: {
        status: newStatus as 'APPROVED' | 'REJECTED',
        reviewed_at: new Date(),
        reviewed_by: userProfile.id,
        rejection_reason: action === 'reject' ? rejection_reason : null,
      },
      include: {
        entries: { orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }] },
      },
    });

    // Create notification for the staff member
    const notificationType = action === 'approve' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED';
    const notificationTitle = action === 'approve'
      ? `Timesheet approved for week of ${timesheet.period_start.toISOString().split('T')[0]}`
      : `Timesheet rejected for week of ${timesheet.period_start.toISOString().split('T')[0]}`;

    await prisma.notification.create({
      data: {
        organization_id: organizationId,
        type: notificationType,
        priority: action === 'reject' ? 'HIGH' : 'MEDIUM',
        title: notificationTitle,
        message: action === 'reject'
          ? `Reason: ${rejection_reason}`
          : `${Number(timesheet.total_hours)} hours approved.`,
        source: 'TIMESHEET_SYSTEM',
        action_url: `/staff-portal/timesheets/${timesheet.id}`,
        related_entity_type: 'timesheet',
        related_entity_id: timesheet.id,
      },
    });

    revalidatePath('/timesheets');
    revalidatePath(`/timesheets/${timesheet.id}`);
    revalidatePath('/staff-portal/timesheets');

    return {
      success: true as const,
      timesheet: {
        id: updated.id,
        status: updated.status,
        reviewed_at: updated.reviewed_at?.toISOString() ?? null,
        reviewed_by: updated.reviewed_by,
        rejection_reason: updated.rejection_reason,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to review timesheet',
    };
  }
}

// ---------------------------------------------------------------------------
// T024: bulkApproveTimesheets
// ---------------------------------------------------------------------------

export async function bulkApproveTimesheets(input: { timesheet_ids: string[] }) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      return { success: false as const, error: 'Admin or executive access required' };
    }

    const parsed = bulkApproveTimesheetsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });

    if (!userProfile) {
      return { success: false as const, error: 'User profile not found' };
    }

    const results: { timesheet_id: string; error: string }[] = [];
    let approvedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const timesheetId of parsed.data.timesheet_ids) {
        const timesheet = await tx.timesheet.findUnique({
          where: { id: timesheetId },
          include: { staff: { select: { name: true } } },
        });

        if (!timesheet || timesheet.organization_id !== organizationId) {
          results.push({ timesheet_id: timesheetId, error: 'Not found' });
          continue;
        }

        if (timesheet.status !== 'SUBMITTED') {
          results.push({ timesheet_id: timesheetId, error: `Invalid status: ${timesheet.status}` });
          continue;
        }

        await tx.timesheet.update({
          where: { id: timesheetId },
          data: {
            status: 'APPROVED',
            reviewed_at: new Date(),
            reviewed_by: userProfile.id,
            rejection_reason: null,
          },
        });

        await tx.notification.create({
          data: {
            organization_id: organizationId,
            type: 'TIMESHEET_APPROVED',
            priority: 'MEDIUM',
            title: `Timesheet approved for week of ${timesheet.period_start.toISOString().split('T')[0]}`,
            message: `${Number(timesheet.total_hours)} hours approved.`,
            source: 'TIMESHEET_SYSTEM',
            action_url: `/staff-portal/timesheets/${timesheetId}`,
            related_entity_type: 'timesheet',
            related_entity_id: timesheetId,
          },
        });

        approvedCount++;
      }
    });

    revalidatePath('/timesheets');
    revalidatePath('/staff-portal/timesheets');

    return {
      success: true as const,
      approved_count: approvedCount,
      failed: results,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to bulk approve timesheets',
    };
  }
}

// ---------------------------------------------------------------------------
// T035: upsertOvertimeConfig
// ---------------------------------------------------------------------------

export async function upsertOvertimeConfig(input: {
  weekly_hours_threshold: number;
  overtime_multiplier: number;
  is_enabled: boolean;
  agency_id?: string | null;
}) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Platform admins can set org-level and any agency-level config
    // Agency admins can only set their own agency-level config
    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE' && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Admin access required' };
    }

    const parsed = upsertOvertimeConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const { weekly_hours_threshold, overtime_multiplier, is_enabled, agency_id } = parsed.data;

    // Agency admins can only configure their own agency
    if (user.role === 'AGENCY_ADMIN') {
      if (!agency_id || agency_id !== user.agencyId) {
        return { success: false as const, error: 'Agency admins can only configure their own agency' };
      }
    }

    // Upsert by organization_id + agency_id (null for org-level)
    const config = await prisma.overtimeConfig.upsert({
      where: {
        organization_id_agency_id: {
          organization_id: organizationId,
          agency_id: agency_id ?? null as unknown as string,
        },
      },
      update: {
        weekly_hours_threshold,
        overtime_multiplier,
        is_enabled,
      },
      create: {
        organization_id: organizationId,
        agency_id: agency_id ?? null,
        weekly_hours_threshold,
        overtime_multiplier,
        is_enabled,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/agency-portal');

    return {
      success: true as const,
      config: {
        id: config.id,
        organization_id: config.organization_id,
        agency_id: config.agency_id,
        weekly_hours_threshold: Number(config.weekly_hours_threshold),
        overtime_multiplier: Number(config.overtime_multiplier),
        is_enabled: config.is_enabled,
        created_at: config.created_at.toISOString(),
        updated_at: config.updated_at.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save overtime config',
    };
  }
}
