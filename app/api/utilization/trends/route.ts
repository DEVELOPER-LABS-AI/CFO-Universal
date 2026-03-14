/**
 * T031: GET /api/utilization/trends
 *
 * Returns historical utilization trend data from the UtilizationSnapshot table.
 * Aggregates snapshots by period across all staff to produce org-level trend data.
 *
 * Query params:
 *   - months: number of months to look back (default 12, max 24)
 *   - period: 'weekly' | 'monthly' (filters by period granularity)
 *
 * Response: Array of {
 *   period_start, period_end, avg_utilization_rate, total_billable_hours,
 *   total_available_hours, total_bench_hours, total_bench_cost,
 *   staff_count, data_points
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { z } from 'zod';

/** Validation schema for trend query parameters. */
const trendsQueryParamsSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
  period: z.enum(['weekly', 'monthly']).optional(),
});

/** Shape of a single trend data point in the response. */
interface TrendDataPoint {
  period_start: string;
  period_end: string;
  avg_utilization_rate: number;
  total_billable_hours: number;
  total_available_hours: number;
  total_bench_hours: number;
  total_bench_cost: number;
  staff_count: number;
  data_points: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth();
    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams = {
      months: searchParams.get('months') ?? undefined,
      period: searchParams.get('period') ?? undefined,
    };

    const parseResult = trendsQueryParamsSchema.safeParse(rawParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { months, period } = parseResult.data;

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
        billable_hours: true,
        bench_hours: true,
        bench_cost: true,
        utilization_rate: true,
      },
      orderBy: { period_start: 'asc' },
    });

    // Optionally filter by period type (weekly vs monthly) based on period duration
    const filteredSnapshots = period
      ? snapshots.filter((s) => {
          const durationDays = Math.round(
            (s.period_end.getTime() - s.period_start.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (period === 'weekly') return durationDays <= 10;
          if (period === 'monthly') return durationDays > 10;
          return true;
        })
      : snapshots;

    // Group snapshots by period_start + period_end combination
    const periodGroups = new Map<
      string,
      {
        period_start: Date;
        period_end: Date;
        staff_ids: Set<string>;
        total_utilization_rate: number;
        total_billable_hours: number;
        total_available_hours: number;
        total_bench_hours: number;
        total_bench_cost: number;
        data_points: number;
      }
    >();

    for (const snap of filteredSnapshots) {
      const key = `${snap.period_start.toISOString()}_${snap.period_end.toISOString()}`;
      const group = periodGroups.get(key) ?? {
        period_start: snap.period_start,
        period_end: snap.period_end,
        staff_ids: new Set<string>(),
        total_utilization_rate: 0,
        total_billable_hours: 0,
        total_available_hours: 0,
        total_bench_hours: 0,
        total_bench_cost: 0,
        data_points: 0,
      };

      group.staff_ids.add(snap.staff_id);
      group.total_utilization_rate += Number(snap.utilization_rate);
      group.total_billable_hours += Number(snap.billable_hours);
      group.total_available_hours += Number(snap.available_hours);
      group.total_bench_hours += Number(snap.bench_hours);
      group.total_bench_cost += Number(snap.bench_cost);
      group.data_points += 1;

      periodGroups.set(key, group);
    }

    // Build response array sorted by period_start
    const trends: TrendDataPoint[] = Array.from(periodGroups.values())
      .sort((a, b) => a.period_start.getTime() - b.period_start.getTime())
      .map((group) => ({
        period_start: group.period_start.toISOString(),
        period_end: group.period_end.toISOString(),
        avg_utilization_rate:
          group.data_points > 0
            ? Math.round((group.total_utilization_rate / group.data_points) * 100) / 100
            : 0,
        total_billable_hours: Math.round(group.total_billable_hours * 100) / 100,
        total_available_hours: Math.round(group.total_available_hours * 100) / 100,
        total_bench_hours: Math.round(group.total_bench_hours * 100) / 100,
        total_bench_cost: Math.round(group.total_bench_cost * 100) / 100,
        staff_count: group.staff_ids.size,
        data_points: group.data_points,
      }));

    return NextResponse.json(trends);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Account inactive') {
      return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'User is not associated with any organization') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    console.error('Utilization trends error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
