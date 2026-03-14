'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, type AuthUser } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  getOrCreateDraftTimesheetSchema,
  upsertTimeEntrySchema,
  batchUpsertTimeEntriesSchema,
  deleteTimeEntrySchema,
  submitTimesheetSchema,
} from '@/lib/validations/timesheet';
import {
  getEffectiveOvertimeConfig,
  calculateOvertimeBreakdown,
} from '@/lib/calculations/timesheet-billing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the staff ID for the current user.
 * - BDR users: use bdr_staff_id
 * - Agency admins: must specify a staff_id that belongs to their agency
 * - Platform admins: can specify any staff_id in the org
 */
async function resolveStaffId(
  user: AuthUser,
  organizationId: string,
  requestedStaffId?: string,
): Promise<{ staffId: string; error?: never } | { staffId?: never; error: string }> {
  // If the user is a staff member (BDR), use their linked staff
  if (user.bdrStaffId) {
    return { staffId: user.bdrStaffId };
  }

  // Admins and agency admins must provide a staff_id
  if (!requestedStaffId) {
    return { error: 'staff_id is required for non-staff users' };
  }

  // Verify the staff belongs to the same organization
  const staff = await prisma.staff.findUnique({
    where: { id: requestedStaffId },
    select: { id: true, organization_id: true, agency_id: true, status: true },
  });

  if (!staff || staff.organization_id !== organizationId) {
    return { error: 'Staff not found' };
  }

  // Agency admins can only manage their agency's staff
  if (user.role === 'AGENCY_ADMIN') {
    if (!user.agencyId || staff.agency_id !== user.agencyId) {
      return { error: 'Staff does not belong to your agency' };
    }
  }

  // Platform admins/executives can manage any staff in the org
  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE' && user.role !== 'AGENCY_ADMIN') {
    return { error: 'Insufficient permissions' };
  }

  return { staffId: staff.id };
}

/** Compute the Monday of the week for a given date. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Check if a date string (YYYY-MM-DD) is a Monday. */
function isMonday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getUTCDay() === 1;
}

/** Check that the period is within 2 weeks lookback from today. */
function isWithinLookback(periodStart: string): boolean {
  const today = new Date();
  const currentMonday = getMonday(today);
  const requestedDate = new Date(periodStart + 'T00:00:00Z');
  const twoWeeksAgo = new Date(currentMonday);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
  return requestedDate >= twoWeeksAgo;
}

/** Recalculate timesheet totals from its entries. */
async function recalculateTimesheetTotals(timesheetId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { timesheet_id: timesheetId },
    select: { hours: true, is_billable: true },
  });

  let totalHours = 0;
  let billableHours = 0;

  for (const entry of entries) {
    const hours = Number(entry.hours);
    totalHours += hours;
    if (entry.is_billable) {
      billableHours += hours;
    }
  }

  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: {
      total_hours: totalHours,
      billable_hours: billableHours,
    },
  });

  return { totalHours, billableHours };
}

/** Serialize a timesheet for the response (convert Decimals to numbers). */
function serializeTimesheet(ts: {
  id: string;
  organization_id: string;
  staff_id: string;
  period_start: Date;
  period_end: Date;
  status: string;
  total_hours: unknown;
  billable_hours: unknown;
  overtime_hours: unknown;
  submitted_at: Date | null;
  submitted_by: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
  entries?: Array<{
    id: string;
    timesheet_id: string;
    staff_id: string;
    assignment_id: string | null;
    project_id: string | null;
    entry_date: Date;
    hours: unknown;
    description: string | null;
    is_billable: boolean;
    is_overtime: boolean;
    created_at: Date;
    updated_at: Date;
  }>;
}) {
  return {
    id: ts.id,
    organization_id: ts.organization_id,
    staff_id: ts.staff_id,
    period_start: ts.period_start.toISOString().split('T')[0],
    period_end: ts.period_end.toISOString().split('T')[0],
    status: ts.status,
    total_hours: Number(ts.total_hours),
    billable_hours: Number(ts.billable_hours),
    overtime_hours: Number(ts.overtime_hours),
    submitted_at: ts.submitted_at?.toISOString() ?? null,
    submitted_by: ts.submitted_by ?? null,
    reviewed_at: ts.reviewed_at?.toISOString() ?? null,
    reviewed_by: ts.reviewed_by ?? null,
    rejection_reason: ts.rejection_reason ?? null,
    created_at: ts.created_at.toISOString(),
    updated_at: ts.updated_at.toISOString(),
    entries: ts.entries?.map((e) => ({
      id: e.id,
      timesheet_id: e.timesheet_id,
      staff_id: e.staff_id,
      assignment_id: e.assignment_id,
      project_id: e.project_id,
      entry_date: e.entry_date.toISOString().split('T')[0],
      hours: Number(e.hours),
      description: e.description,
      is_billable: e.is_billable,
      is_overtime: e.is_overtime,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
    })) ?? [],
  };
}

// ---------------------------------------------------------------------------
// T012: getOrCreateDraftTimesheet
// ---------------------------------------------------------------------------

export async function getOrCreateDraftTimesheet(input: {
  period_start: string;
  staff_id?: string;
}) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Validate input
    const parsed = getOrCreateDraftTimesheetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const { period_start } = parsed.data;

    // Validate period_start is a Monday
    if (!isMonday(period_start)) {
      return { success: false as const, error: 'period_start must be a Monday' };
    }

    // Enforce 2-week lookback for staff (admins exempt)
    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      if (!isWithinLookback(period_start)) {
        return { success: false as const, error: 'Cannot create timesheets more than 2 weeks in the past' };
      }
    }

    // Resolve staff_id
    const staffResult = await resolveStaffId(user, organizationId, input.staff_id);
    if ('error' in staffResult) {
      return { success: false as const, error: staffResult.error };
    }
    const { staffId } = staffResult;

    // Calculate period_end (Sunday)
    const periodEnd = new Date(period_start + 'T00:00:00Z');
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);

    // Upsert: find existing or create new DRAFT timesheet
    const existing = await prisma.timesheet.findUnique({
      where: {
        staff_id_period_start: {
          staff_id: staffId,
          period_start: new Date(period_start + 'T00:00:00Z'),
        },
      },
      include: {
        entries: { orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }] },
      },
    });

    if (existing) {
      return { success: true as const, timesheet: serializeTimesheet(existing) };
    }

    // Create new draft
    const timesheet = await prisma.timesheet.create({
      data: {
        organization_id: organizationId,
        staff_id: staffId,
        period_start: new Date(period_start + 'T00:00:00Z'),
        period_end: periodEnd,
        status: 'DRAFT',
      },
      include: {
        entries: { orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }] },
      },
    });

    revalidatePath('/staff-portal/timesheets');
    return { success: true as const, timesheet: serializeTimesheet(timesheet) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get or create timesheet',
    };
  }
}

// ---------------------------------------------------------------------------
// T013: upsertTimeEntry
// ---------------------------------------------------------------------------

export async function upsertTimeEntry(input: {
  timesheet_id: string;
  entry_id?: string;
  assignment_id?: string | null;
  project_id?: string | null;
  entry_date: string;
  hours: number;
  description?: string | null;
  is_billable?: boolean;
}) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Validate input
    const parsed = upsertTimeEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Load the parent timesheet
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: data.timesheet_id },
      select: {
        id: true,
        organization_id: true,
        staff_id: true,
        status: true,
        period_start: true,
        period_end: true,
        staff: { select: { agency_id: true } },
      },
    });

    if (!timesheet || timesheet.organization_id !== organizationId) {
      return { success: false as const, error: 'Timesheet not found' };
    }

    // Verify access: staff must own the timesheet, or user must be admin/agency_admin
    const isOwner = user.bdrStaffId === timesheet.staff_id;
    const isAdminRole = user.role === 'ADMIN' || user.role === 'EXECUTIVE';
    if (!isOwner && !isAdminRole && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Access denied' };
    }
    // Agency admins can only modify timesheets for their agency's staff
    if (user.role === 'AGENCY_ADMIN' && timesheet.staff.agency_id !== user.agencyId) {
      return { success: false as const, error: 'Access denied' };
    }

    // Timesheet must be DRAFT or REJECTED
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      return { success: false as const, error: 'Timesheet is locked (status: ' + timesheet.status + ')' };
    }

    // Validate entry_date is within the timesheet period
    const entryDate = new Date(data.entry_date + 'T00:00:00Z');
    if (entryDate < timesheet.period_start || entryDate > timesheet.period_end) {
      return { success: false as const, error: 'Entry date is outside the timesheet period' };
    }

    // Validate daily total doesn't exceed 24 hours
    const existingDayEntries = await prisma.timeEntry.findMany({
      where: {
        timesheet_id: timesheet.id,
        entry_date: entryDate,
        ...(data.entry_id ? { id: { not: data.entry_id } } : {}),
      },
      select: { hours: true },
    });

    const existingDayTotal = existingDayEntries.reduce((sum, e) => sum + Number(e.hours), 0);
    if (existingDayTotal + data.hours > 24) {
      return { success: false as const, error: 'Daily total cannot exceed 24 hours' };
    }

    // Validate assignment is active on entry_date (if provided)
    if (data.assignment_id) {
      const assignment = await prisma.staffAssignment.findUnique({
        where: { id: data.assignment_id },
        select: { staff_id: true, start_date: true, end_date: true },
      });

      if (!assignment || assignment.staff_id !== timesheet.staff_id) {
        return { success: false as const, error: 'Assignment not found for this staff member' };
      }

      if (entryDate < assignment.start_date) {
        return { success: false as const, error: 'Assignment was not active on this date' };
      }

      if (assignment.end_date && entryDate > assignment.end_date) {
        return { success: false as const, error: 'Assignment ended before this date' };
      }
    }

    // Force is_billable=false for bench time (no assignment)
    const isBillable = data.assignment_id ? (data.is_billable ?? true) : false;

    // Upsert the entry
    let entry;
    if (data.entry_id) {
      // Update existing entry
      entry = await prisma.timeEntry.update({
        where: { id: data.entry_id },
        data: {
          assignment_id: data.assignment_id ?? null,
          project_id: data.project_id ?? null,
          entry_date: entryDate,
          hours: data.hours,
          description: data.description ?? null,
          is_billable: isBillable,
        },
      });
    } else {
      // Create new entry - use upsert by unique constraint
      entry = await prisma.timeEntry.upsert({
        where: {
          timesheet_id_entry_date_assignment_id: {
            timesheet_id: timesheet.id,
            entry_date: entryDate,
            assignment_id: data.assignment_id ?? '',
          },
        },
        update: {
          hours: data.hours,
          description: data.description ?? null,
          is_billable: isBillable,
          project_id: data.project_id ?? null,
        },
        create: {
          timesheet_id: timesheet.id,
          staff_id: timesheet.staff_id,
          assignment_id: data.assignment_id ?? null,
          project_id: data.project_id ?? null,
          entry_date: entryDate,
          hours: data.hours,
          description: data.description ?? null,
          is_billable: isBillable,
        },
      });
    }

    // Recalculate timesheet totals
    const totals = await recalculateTimesheetTotals(timesheet.id);

    // Get day total for response
    const dayEntries = await prisma.timeEntry.findMany({
      where: { timesheet_id: timesheet.id, entry_date: entryDate },
      select: { hours: true },
    });
    const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);

    revalidatePath(`/staff-portal/timesheets/${timesheet.id}`);

    return {
      success: true as const,
      entry: {
        id: entry.id,
        timesheet_id: entry.timesheet_id,
        staff_id: entry.staff_id,
        assignment_id: entry.assignment_id,
        project_id: entry.project_id,
        entry_date: entry.entry_date.toISOString().split('T')[0],
        hours: Number(entry.hours),
        description: entry.description,
        is_billable: entry.is_billable,
        is_overtime: entry.is_overtime,
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
      },
      timesheet_totals: {
        total_hours: totals.totalHours,
        billable_hours: totals.billableHours,
        day_total: dayTotal,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to save time entry',
    };
  }
}

// ---------------------------------------------------------------------------
// T013: deleteTimeEntry
// ---------------------------------------------------------------------------

export async function deleteTimeEntry(input: { entry_id: string }) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    const parsed = deleteTimeEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    // Load entry and its parent timesheet
    const entry = await prisma.timeEntry.findUnique({
      where: { id: parsed.data.entry_id },
      include: {
        timesheet: {
          select: { id: true, organization_id: true, staff_id: true, status: true, staff: { select: { agency_id: true } } },
        },
      },
    });

    if (!entry || entry.timesheet.organization_id !== organizationId) {
      return { success: false as const, error: 'Time entry not found' };
    }

    // Verify access
    const isOwner = user.bdrStaffId === entry.timesheet.staff_id;
    const isAdminRole = user.role === 'ADMIN' || user.role === 'EXECUTIVE';
    if (!isOwner && !isAdminRole && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Access denied' };
    }
    // Agency admins can only delete entries for their agency's staff
    if (user.role === 'AGENCY_ADMIN' && entry.timesheet.staff.agency_id !== user.agencyId) {
      return { success: false as const, error: 'Access denied' };
    }

    // Timesheet must be DRAFT or REJECTED
    if (entry.timesheet.status !== 'DRAFT' && entry.timesheet.status !== 'REJECTED') {
      return { success: false as const, error: 'Cannot delete entries from a locked timesheet' };
    }

    // Delete the entry
    await prisma.timeEntry.delete({ where: { id: entry.id } });

    // Recalculate timesheet totals
    await recalculateTimesheetTotals(entry.timesheet.id);

    revalidatePath(`/staff-portal/timesheets/${entry.timesheet.id}`);

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete time entry',
    };
  }
}

// ---------------------------------------------------------------------------
// T014: batchUpsertTimeEntries
// ---------------------------------------------------------------------------

export async function batchUpsertTimeEntries(input: {
  timesheet_id: string;
  entries: Array<{
    entry_id?: string;
    assignment_id?: string | null;
    project_id?: string | null;
    entry_date: string;
    hours: number;
    description?: string | null;
    is_billable?: boolean;
  }>;
}) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Validate input
    const parsed = batchUpsertTimeEntriesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const { timesheet_id, entries } = parsed.data;

    // Load the parent timesheet
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheet_id },
      select: {
        id: true,
        organization_id: true,
        staff_id: true,
        status: true,
        period_start: true,
        period_end: true,
        staff: { select: { agency_id: true } },
      },
    });

    if (!timesheet || timesheet.organization_id !== organizationId) {
      return { success: false as const, error: 'Timesheet not found' };
    }

    // Verify access
    const isOwner = user.bdrStaffId === timesheet.staff_id;
    const isAdminRole = user.role === 'ADMIN' || user.role === 'EXECUTIVE';
    if (!isOwner && !isAdminRole && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Access denied' };
    }
    // Agency admins can only batch-modify entries for their agency's staff
    if (user.role === 'AGENCY_ADMIN' && timesheet.staff.agency_id !== user.agencyId) {
      return { success: false as const, error: 'Access denied' };
    }

    // Timesheet must be DRAFT or REJECTED
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      return { success: false as const, error: 'Timesheet is locked' };
    }

    // Load existing entries for daily total validation
    const existingEntries = await prisma.timeEntry.findMany({
      where: { timesheet_id: timesheet.id },
      select: { id: true, entry_date: true, hours: true, assignment_id: true },
    });

    // Build a map of existing daily totals
    const dayTotals = new Map<string, number>();
    for (const e of existingEntries) {
      const dateKey = e.entry_date.toISOString().split('T')[0];
      dayTotals.set(dateKey, (dayTotals.get(dateKey) ?? 0) + Number(e.hours));
    }

    // Identify entries being updated (to subtract their existing hours)
    const updatingIds = new Set(
      entries.filter((e) => e.entry_id).map((e) => e.entry_id!),
    );
    for (const e of existingEntries) {
      if (updatingIds.has(e.id)) {
        const dateKey = e.entry_date.toISOString().split('T')[0];
        dayTotals.set(dateKey, (dayTotals.get(dateKey) ?? 0) - Number(e.hours));
      }
    }

    // Process each entry - accumulate results and errors
    const results: Array<{
      index: number;
      entry_id: string;
      entry_date: string;
      hours: number;
    }> = [];
    const errors: Array<{
      index: number;
      error: string;
    }> = [];

    // Use a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < entries.length; i++) {
        const data = entries[i];

        // Validate entry_date within period
        const entryDate = new Date(data.entry_date + 'T00:00:00Z');
        if (entryDate < timesheet.period_start || entryDate > timesheet.period_end) {
          errors.push({ index: i, error: 'Entry date outside timesheet period' });
          continue;
        }

        // Validate daily total with the new entry
        const dateKey = data.entry_date;
        const currentDayTotal = dayTotals.get(dateKey) ?? 0;
        if (currentDayTotal + data.hours > 24) {
          errors.push({ index: i, error: 'Daily total would exceed 24 hours' });
          continue;
        }

        // Force non-billable for bench time
        const isBillable = data.assignment_id ? (data.is_billable ?? true) : false;

        try {
          let entry;
          if (data.entry_id) {
            entry = await tx.timeEntry.update({
              where: { id: data.entry_id },
              data: {
                assignment_id: data.assignment_id ?? null,
                project_id: data.project_id ?? null,
                entry_date: entryDate,
                hours: data.hours,
                description: data.description ?? null,
                is_billable: isBillable,
              },
            });
          } else {
            entry = await tx.timeEntry.upsert({
              where: {
                timesheet_id_entry_date_assignment_id: {
                  timesheet_id: timesheet.id,
                  entry_date: entryDate,
                  assignment_id: data.assignment_id ?? '',
                },
              },
              update: {
                hours: data.hours,
                description: data.description ?? null,
                is_billable: isBillable,
                project_id: data.project_id ?? null,
              },
              create: {
                timesheet_id: timesheet.id,
                staff_id: timesheet.staff_id,
                assignment_id: data.assignment_id ?? null,
                project_id: data.project_id ?? null,
                entry_date: entryDate,
                hours: data.hours,
                description: data.description ?? null,
                is_billable: isBillable,
              },
            });
          }

          // Update running day total
          dayTotals.set(dateKey, (dayTotals.get(dateKey) ?? 0) + data.hours);

          results.push({
            index: i,
            entry_id: entry.id,
            entry_date: data.entry_date,
            hours: Number(entry.hours),
          });
        } catch (err) {
          errors.push({
            index: i,
            error: err instanceof Error ? err.message : 'Failed to save entry',
          });
        }
      }
    });

    // Recalculate timesheet totals
    const totals = await recalculateTimesheetTotals(timesheet.id);

    revalidatePath(`/staff-portal/timesheets/${timesheet.id}`);

    return {
      success: true as const,
      saved: results,
      errors,
      timesheet_totals: {
        total_hours: totals.totalHours,
        billable_hours: totals.billableHours,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to batch save time entries',
    };
  }
}

// ---------------------------------------------------------------------------
// T021: submitTimesheet (Phase 4 / US2 — included here for same file)
// ---------------------------------------------------------------------------

export async function submitTimesheet(input: { timesheet_id: string }) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    const parsed = submitTimesheetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: parsed.data.timesheet_id },
      include: {
        entries: true,
        staff: { select: { name: true, agency_id: true } },
      },
    });

    if (!timesheet || timesheet.organization_id !== organizationId) {
      return { success: false as const, error: 'Timesheet not found' };
    }

    // Verify ownership
    const isOwner = user.bdrStaffId === timesheet.staff_id;
    const isAdminRole = user.role === 'ADMIN' || user.role === 'EXECUTIVE';
    if (!isOwner && !isAdminRole && user.role !== 'AGENCY_ADMIN') {
      return { success: false as const, error: 'Access denied' };
    }
    // Agency admins can only submit timesheets for their agency's staff
    if (user.role === 'AGENCY_ADMIN' && timesheet.staff.agency_id !== user.agencyId) {
      return { success: false as const, error: 'Access denied' };
    }

    // Must be DRAFT or REJECTED
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      return { success: false as const, error: 'Timesheet must be in DRAFT or REJECTED status to submit' };
    }

    // Must have at least one entry
    if (timesheet.entries.length === 0) {
      return { success: false as const, error: 'Timesheet has no entries' };
    }

    // Validate all entries have descriptions
    const missingDescriptions = timesheet.entries.filter(
      (e) => !e.description || e.description.trim().length === 0,
    );
    if (missingDescriptions.length > 0) {
      return {
        success: false as const,
        error: `${missingDescriptions.length} entries are missing descriptions`,
      };
    }

    // Recalculate overtime
    const overtimeConfig = await getEffectiveOvertimeConfig(
      organizationId,
      timesheet.staff.agency_id,
    );
    const totalBillableHours = timesheet.entries
      .filter((e) => e.is_billable)
      .reduce((sum, e) => sum + Number(e.hours), 0);
    const overtimeBreakdown = calculateOvertimeBreakdown(
      totalBillableHours,
      overtimeConfig,
    );

    // Update timesheet status
    const updated = await prisma.timesheet.update({
      where: { id: timesheet.id },
      data: {
        status: 'SUBMITTED',
        submitted_at: new Date(),
        submitted_by: user.userId,
        overtime_hours: overtimeBreakdown.overtimeHours,
        rejection_reason: null,
      },
      include: {
        entries: { orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }] },
      },
    });

    // Create notification for org admins
    await prisma.notification.create({
      data: {
        organization_id: organizationId,
        type: 'TIMESHEET_SUBMITTED',
        priority: 'MEDIUM',
        title: `Timesheet submitted by ${timesheet.staff.name}`,
        message: `Week of ${timesheet.period_start.toISOString().split('T')[0]} — ${Number(timesheet.total_hours)} hours`,
        source: 'TIMESHEET_SYSTEM',
        action_url: `/timesheets/${timesheet.id}`,
        related_entity_type: 'timesheet',
        related_entity_id: timesheet.id,
      },
    });

    revalidatePath('/staff-portal/timesheets');
    revalidatePath(`/staff-portal/timesheets/${timesheet.id}`);
    revalidatePath('/timesheets');

    return { success: true as const, timesheet: serializeTimesheet(updated) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to submit timesheet',
    };
  }
}
