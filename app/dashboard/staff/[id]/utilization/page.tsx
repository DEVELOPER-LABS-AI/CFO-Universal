/**
 * T026: Staff Utilization Detail Page
 * Server component that displays comprehensive utilization metrics for a single
 * staff member, including current period summary, hours breakdown, trend chart,
 * and assignment timeline.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import {
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getPeriodBoundaries,
} from '@/lib/calculations/utilization';
import {
  calculateBenchHours,
  calculateBenchCost,
  getHourlyCostRate,
  calculateBenchDuration,
} from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineUtilizationStatus,
} from '@/lib/calculations/utilization-targets';
import { HoursBreakdown } from '@/components/utilization/hours-breakdown';
import { AssignmentTimeline } from '@/components/utilization/assignment-timeline';
import { UtilizationTrendChart } from '@/components/utilization/utilization-trend-chart';

/** Map utilization status to display properties. */
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  on_target: { label: 'On Target', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  warning: { label: 'Warning', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

export default async function StaffUtilizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();
  const { id: staffId } = await params;

  // --- Access control ---
  const allowedRoles = ['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN'];
  const isPrivileged = allowedRoles.includes(user.role);

  if (!isPrivileged) {
    // Check if viewing own staff record
    const linkedProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.userId },
      select: { bdr_staff_id: true },
    });

    if (!linkedProfile || linkedProfile.bdr_staff_id !== staffId) {
      notFound();
    }
  }

  // --- Fetch staff member ---
  const staff = await prisma.staff.findFirst({
    where: {
      id: staffId,
      organization_id: organizationId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      staff_type: true,
      engagement_type: true,
      rate: true,
      rate_type: true,
      true_cost: true,
      true_cost_rate_type: true,
      agency_id: true,
      status: true,
      created_at: true,
    },
  });

  if (!staff) {
    notFound();
  }

  // Agency admin scoping
  if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
    if (staff.agency_id !== user.agencyId) {
      notFound();
    }
  }

  // --- Resolve effective target ---
  const targets = await prisma.utilizationTarget.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
    },
    select: {
      staff_type: true,
      target_rate: true,
      warning_threshold: true,
      critical_threshold: true,
      standard_daily_hours: true,
      enabled: true,
    },
  });

  const numericTargets = targets.map((t) => ({
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
  }));

  const effectiveTarget = resolveEffectiveTarget(numericTargets, staff.staff_type);

  // --- Current period calculation ---
  const now = new Date();
  const { start: periodStart, end: periodEnd } = getPeriodBoundaries(now, 'monthly');

  const availableHours = calculateAvailableHours(
    periodStart,
    periodEnd,
    effectiveTarget.standard_daily_hours,
    staff.created_at
  );

  // Try timesheet data first
  const timesheetEntries = await prisma.timeEntry.findMany({
    where: {
      staff_id: staffId,
      entry_date: {
        gte: periodStart,
        lte: periodEnd,
      },
      timesheet: {
        status: { in: ['SUBMITTED', 'APPROVED'] },
        deleted_at: null,
      },
    },
    select: {
      hours: true,
      is_billable: true,
    },
  });

  let billableHours: number;
  let nonBillableHours: number;
  let dataSource: string;

  if (timesheetEntries.length > 0) {
    const timesheetResult = calculateBillableHoursFromTimesheets(
      timesheetEntries.map((e) => ({
        hours: Number(e.hours),
        is_billable: e.is_billable,
      }))
    );
    billableHours = timesheetResult.billableHours;
    nonBillableHours = timesheetResult.nonBillableHours;
    dataSource = 'Timesheet';
  } else {
    // Fallback to allocation data
    const allocationAssignments = await prisma.staffAssignment.findMany({
      where: {
        staff_id: staffId,
        start_date: { lte: periodEnd },
        OR: [{ end_date: null }, { end_date: { gte: periodStart } }],
      },
      select: {
        allocation_percentage: true,
        start_date: true,
        end_date: true,
      },
    });

    const allocationResult = calculateBillableHoursFromAllocations(
      allocationAssignments.map((a) => ({
        allocation_percentage: Number(a.allocation_percentage),
        start_date: a.start_date,
        end_date: a.end_date,
      })),
      periodStart,
      periodEnd,
      availableHours
    );
    billableHours = allocationResult.billableHours;
    nonBillableHours = allocationResult.nonBillableHours;
    dataSource = 'Allocation';
  }

  const benchHours = calculateBenchHours(availableHours, billableHours, nonBillableHours);
  const utilizationRate = calculateUtilizationRate(billableHours, availableHours);
  const { hourlyRate } = getHourlyCostRate({
    rate: Number(staff.rate),
    rate_type: staff.rate_type,
    true_cost: staff.true_cost ? Number(staff.true_cost) : null,
    true_cost_rate_type: staff.true_cost_rate_type,
  });
  const benchCostValue = calculateBenchCost(benchHours, hourlyRate);
  const status = determineUtilizationStatus(utilizationRate, effectiveTarget);
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.on_target;

  // --- Historical snapshots (6 months) ---
  const historyStart = new Date(now);
  historyStart.setMonth(historyStart.getMonth() - 6);
  historyStart.setDate(1);
  historyStart.setHours(0, 0, 0, 0);

  const snapshots = await prisma.utilizationSnapshot.findMany({
    where: {
      staff_id: staffId,
      organization_id: organizationId,
      period_start: { gte: historyStart },
    },
    orderBy: { period_start: 'asc' },
    select: {
      period_start: true,
      period_end: true,
      utilization_rate: true,
      billable_hours: true,
      bench_hours: true,
      bench_cost: true,
      data_source: true,
    },
  });

  const historyData = snapshots.map((s) => ({
    period_start: s.period_start.toISOString(),
    period_end: s.period_end.toISOString(),
    utilization_rate: Number(s.utilization_rate),
    billable_hours: Number(s.billable_hours),
    bench_hours: Number(s.bench_hours),
    bench_cost: Number(s.bench_cost),
    data_source: s.data_source,
  }));

  // --- Current assignments ---
  const currentAssignments = await prisma.staffAssignment.findMany({
    where: {
      staff_id: staffId,
    },
    include: {
      client: {
        select: { id: true, name: true },
      },
    },
    orderBy: { start_date: 'desc' },
  });

  const assignmentsData = currentAssignments.map((a) => ({
    id: a.id,
    client_name: a.client.name,
    allocation_percentage: Number(a.allocation_percentage),
    start_date: a.start_date.toISOString(),
    end_date: a.end_date ? a.end_date.toISOString() : null,
    is_active: a.start_date <= now && (a.end_date === null || a.end_date >= now),
  }));

  // --- Bench duration ---
  const assignmentsForBench = currentAssignments.map((a) => ({
    start_date: a.start_date,
    end_date: a.end_date,
  }));
  const { daysOnBench, lastAssignmentEnd } = calculateBenchDuration(assignmentsForBench, now);

  // --- Engagement type label ---
  const ENGAGEMENT_LABELS: Record<string, string> = {
    FULL_TIME: 'Full Time',
    PART_TIME: 'Part Time',
    PROJECT: 'Project Based',
    AGENCY: 'Agency',
    OWNER: 'Owner',
  };

  // --- Period label ---
  const periodLabel = periodStart.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" asChild>
        <Link href={`/dashboard/staff/${staffId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Staff Detail
        </Link>
      </Button>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{staff.name} - Utilization</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{staff.staff_type}</Badge>
          <span className="text-sm text-muted-foreground">
            {ENGAGEMENT_LABELS[staff.engagement_type] || staff.engagement_type}
          </span>
          <span className="text-sm text-muted-foreground">
            | {periodLabel}
          </span>
          <Badge variant="secondary" className="text-xs">
            Data: {dataSource}
          </Badge>
        </div>
      </div>

      {/* Current period summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Utilization Rate */}
        <Card className={`border ${statusConfig.bgColor}`}>
          <CardHeader className="pb-2">
            <CardDescription>Utilization Rate</CardDescription>
            <CardTitle className={`text-3xl ${statusConfig.color}`}>
              {utilizationRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                variant={status === 'on_target' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}
                className={status === 'on_target' ? 'bg-green-600' : ''}
              >
                {statusConfig.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Target: {effectiveTarget.target_rate}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Billable Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billable Hours</CardDescription>
            <CardTitle className="text-3xl">{billableHours.toFixed(1)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              of {availableHours.toFixed(0)} available
            </p>
          </CardContent>
        </Card>

        {/* Bench Cost */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bench Cost</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(benchCostValue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {benchHours.toFixed(1)} idle hours @ {formatCurrency(hourlyRate)}/hr
            </p>
          </CardContent>
        </Card>

        {/* Bench Duration */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bench Status</CardDescription>
            <CardTitle className="text-3xl">
              {daysOnBench !== null ? (
                <span className="text-amber-600">{daysOnBench}d</span>
              ) : (
                <span className="text-green-600">Assigned</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {daysOnBench !== null
                ? 'Consecutive days on bench'
                : `${assignmentsData.filter((a) => a.is_active).length} active assignment${assignmentsData.filter((a) => a.is_active).length !== 1 ? 's' : ''}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hours Breakdown donut */}
        <HoursBreakdown
          availableHours={availableHours}
          billableHours={billableHours}
          nonBillableHours={nonBillableHours}
          benchHours={benchHours}
        />

        {/* Utilization Trend (history) */}
        <UtilizationTrendChart
          history={historyData}
          targetRate={effectiveTarget.target_rate}
          warningThreshold={effectiveTarget.warning_threshold}
          criticalThreshold={effectiveTarget.critical_threshold}
        />
      </div>

      {/* Assignment Timeline */}
      <AssignmentTimeline
        assignments={assignmentsData}
        benchDurationDays={daysOnBench}
        lastAssignmentEnd={lastAssignmentEnd ? lastAssignmentEnd.toISOString() : null}
      />
    </div>
  );
}
