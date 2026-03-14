/**
 * T016: GET /api/timesheets/[id] — Timesheet detail with entries, staff info,
 * active assignments, and billing summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import {
  calculateTimesheetBilling,
  getEffectiveOvertimeConfig,
} from '@/lib/calculations/timesheet-billing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();
    const { id } = await params;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }],
          include: {
            assignment: {
              select: {
                id: true,
                client_id: true,
                client: { select: { name: true } },
                assignment_type: true,
                allocation_percentage: true,
              },
            },
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
            rate: true,
            rate_type: true,
            staff_type: true,
            agency_id: true,
            assignments: {
              where: {
                OR: [
                  { end_date: null },
                  { end_date: { gte: new Date() } },
                ],
              },
              select: {
                id: true,
                client_id: true,
                client: { select: { name: true } },
                assignment_type: true,
                allocation_percentage: true,
              },
            },
          },
        },
      },
    });

    if (!timesheet || timesheet.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    }

    // Role-based access check
    const isOwner = user.bdrStaffId === timesheet.staff_id;
    const isAdminRole = user.role === 'ADMIN' || user.role === 'EXECUTIVE';
    const isAgencyAdmin = user.role === 'AGENCY_ADMIN' && user.agencyId === timesheet.staff.agency_id;

    if (!isOwner && !isAdminRole && !isAgencyAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Compute billing summary (only for timesheets with entries)
    let billingSummary = null;
    if (timesheet.entries.length > 0 && timesheet.status !== 'DRAFT') {
      const overtimeConfig = await getEffectiveOvertimeConfig(
        organizationId,
        timesheet.staff.agency_id,
      );

      const billingEntries = timesheet.entries.map((e) => ({
        assignmentId: e.assignment_id,
        clientName: e.assignment?.client?.name ?? 'Unassigned',
        hours: Number(e.hours),
        isBillable: e.is_billable,
      }));

      const billingResult = calculateTimesheetBilling({
        entries: billingEntries,
        staffRate: {
          rate: Number(timesheet.staff.rate),
          rateType: timesheet.staff.rate_type,
        },
        overtimeConfig,
      });

      billingSummary = {
        regular_hours: billingResult.totalBillableHours - billingResult.totalOvertimeHours,
        overtime_hours: billingResult.totalOvertimeHours,
        regular_amount: billingResult.regularAmount,
        overtime_amount: billingResult.overtimeAmount,
        total_amount: billingResult.totalAmount,
        by_assignment: billingResult.byAssignment.map((a) => ({
          assignment_id: a.assignmentId,
          client_name: a.clientName,
          regular_hours: a.regularHours,
          overtime_hours: a.overtimeHours,
          regular_amount: a.regularAmount,
          overtime_amount: a.overtimeAmount,
          total_amount: a.totalAmount,
        })),
      };
    }

    // Serialize response
    const response = {
      timesheet: {
        id: timesheet.id,
        organization_id: timesheet.organization_id,
        staff_id: timesheet.staff_id,
        period_start: timesheet.period_start.toISOString().split('T')[0],
        period_end: timesheet.period_end.toISOString().split('T')[0],
        status: timesheet.status,
        total_hours: Number(timesheet.total_hours),
        billable_hours: Number(timesheet.billable_hours),
        overtime_hours: Number(timesheet.overtime_hours),
        submitted_at: timesheet.submitted_at?.toISOString() ?? null,
        reviewed_at: timesheet.reviewed_at?.toISOString() ?? null,
        reviewed_by: timesheet.reviewed_by ?? null,
        rejection_reason: timesheet.rejection_reason ?? null,
        created_at: timesheet.created_at.toISOString(),
        updated_at: timesheet.updated_at.toISOString(),
        entries: timesheet.entries.map((e) => ({
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
          client_name: e.assignment?.client?.name ?? null,
        })),
      },
      staff: {
        id: timesheet.staff.id,
        name: timesheet.staff.name,
        rate: Number(timesheet.staff.rate),
        rate_type: timesheet.staff.rate_type,
        staff_type: timesheet.staff.staff_type,
      },
      assignments: timesheet.staff.assignments.map((a) => ({
        id: a.id,
        client_id: a.client_id,
        client_name: a.client.name,
        assignment_type: a.assignment_type,
        allocation_percentage: Number(a.allocation_percentage),
      })),
      billing_summary: billingSummary,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
