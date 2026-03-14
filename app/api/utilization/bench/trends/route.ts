/**
 * T032: GET /api/utilization/bench/trends
 *
 * Returns bench cost trends over time from the UtilizationSnapshot table.
 * Aggregates bench cost, headcount, and payroll data by period.
 *
 * Query params:
 *   - months: number of months to look back (default 12, max 24)
 *
 * Response: Array of {
 *   period_start, period_end, total_bench_cost, bench_headcount,
 *   avg_bench_hours, total_payroll_hours, bench_cost_pct_of_payroll
 * }
 *
 * Auth: ADMIN or EXECUTIVE role required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { z } from 'zod';

/** Validation schema for bench trends query parameters. */
const benchTrendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

/** Shape of a single bench trend data point in the response. */
interface BenchTrendDataPoint {
  period_start: string;
  period_end: string;
  total_bench_cost: number;
  bench_headcount: number;
  avg_bench_hours: number;
  total_payroll_hours: number;
  bench_cost_pct_of_payroll: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams = {
      months: searchParams.get('months') ?? undefined,
    };

    const parseResult = benchTrendsQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { months } = parseResult.data;

    // Calculate the lookback date
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - months);
    lookbackDate.setHours(0, 0, 0, 0);

    // Fetch snapshots within the lookback period
    const snapshots = await prisma.utilizationSnapshot.findMany({
      where: {
        organization_id: organizationId,
        period_start: { gte: lookbackDate },
      },
      select: {
        staff_id: true,
        period_start: true,
        period_end: true,
        available_hours: true,
        bench_hours: true,
        bench_cost: true,
        cost_rate_hourly: true,
      },
      orderBy: { period_start: 'asc' },
    });

    // Group snapshots by period_start + period_end
    const periodGroups = new Map<
      string,
      {
        period_start: Date;
        period_end: Date;
        total_bench_cost: number;
        bench_staff_ids: Set<string>;
        total_bench_hours: number;
        total_payroll_hours: number;
        total_payroll_cost: number;
        snapshot_count: number;
      }
    >();

    for (const snap of snapshots) {
      const key = `${snap.period_start.toISOString()}_${snap.period_end.toISOString()}`;
      const benchCost = Number(snap.bench_cost);
      const benchHours = Number(snap.bench_hours);
      const availableHours = Number(snap.available_hours);
      const costRateHourly = Number(snap.cost_rate_hourly);

      const group = periodGroups.get(key) ?? {
        period_start: snap.period_start,
        period_end: snap.period_end,
        total_bench_cost: 0,
        bench_staff_ids: new Set<string>(),
        total_bench_hours: 0,
        total_payroll_hours: 0,
        total_payroll_cost: 0,
        snapshot_count: 0,
      };

      group.total_bench_cost += benchCost;
      group.total_bench_hours += benchHours;
      group.total_payroll_hours += availableHours;
      group.total_payroll_cost += availableHours * costRateHourly;
      group.snapshot_count += 1;

      // Count staff with non-zero bench hours
      if (benchHours > 0) {
        group.bench_staff_ids.add(snap.staff_id);
      }

      periodGroups.set(key, group);
    }

    // Build response array sorted by period_start
    const trends: BenchTrendDataPoint[] = Array.from(periodGroups.values())
      .sort((a, b) => a.period_start.getTime() - b.period_start.getTime())
      .map((group) => {
        const benchHeadcount = group.bench_staff_ids.size;
        const avgBenchHours =
          benchHeadcount > 0
            ? Math.round((group.total_bench_hours / benchHeadcount) * 100) / 100
            : 0;
        const benchCostPctOfPayroll =
          group.total_payroll_cost > 0
            ? Math.round((group.total_bench_cost / group.total_payroll_cost) * 100 * 100) / 100
            : 0;

        return {
          period_start: group.period_start.toISOString(),
          period_end: group.period_end.toISOString(),
          total_bench_cost: Math.round(group.total_bench_cost * 100) / 100,
          bench_headcount: benchHeadcount,
          avg_bench_hours: avgBenchHours,
          total_payroll_hours: Math.round(group.total_payroll_hours * 100) / 100,
          bench_cost_pct_of_payroll: benchCostPctOfPayroll,
        };
      });

    return NextResponse.json(trends);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Account inactive') {
      return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Forbidden - admin or executive access required') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'User is not associated with any organization') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    console.error('Bench trends error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
