/**
 * T033: GET /api/utilization/snapshots
 *
 * Returns raw utilization snapshot data with filtering and pagination.
 * Reads from the UtilizationSnapshot table.
 *
 * Query params:
 *   - staff_id: UUID filter for specific staff member
 *   - months: number of months to look back (default 6, max 24)
 *   - page: page number for pagination (default 1)
 *   - per_page: items per page (default 50, max 200)
 *
 * Response: {
 *   data: array of snapshot records,
 *   pagination: { page, per_page, total, total_pages }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { z } from 'zod';

/** Validation schema for snapshot listing query parameters. */
const snapshotListQuerySchema = z.object({
  staff_id: z.string().uuid('Invalid staff_id format').optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(200).default(50),
});

/** Shape of a single snapshot record in the response. */
interface SnapshotRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  period_start: string;
  period_end: string;
  available_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  bench_hours: number;
  utilization_rate: number;
  bench_cost: number;
  cost_rate_hourly: number;
  cost_rate_source: string;
  data_source: string;
  alert_level: string | null;
  generated_at: string;
  created_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth();
    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams = {
      staff_id: searchParams.get('staff_id') ?? undefined,
      months: searchParams.get('months') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    };

    const parseResult = snapshotListQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { staff_id, months, page, per_page } = parseResult.data;

    // Calculate the lookback date
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - months);
    lookbackDate.setHours(0, 0, 0, 0);

    // Build where clause
    const where: Record<string, unknown> = {
      organization_id: organizationId,
      period_start: { gte: lookbackDate },
    };

    if (staff_id) {
      where.staff_id = staff_id;
    }

    // Get total count for pagination
    const total = await prisma.utilizationSnapshot.count({ where });

    // Fetch paginated snapshots
    const snapshots = await prisma.utilizationSnapshot.findMany({
      where,
      select: {
        id: true,
        staff_id: true,
        period_start: true,
        period_end: true,
        available_hours: true,
        billable_hours: true,
        non_billable_hours: true,
        bench_hours: true,
        utilization_rate: true,
        bench_cost: true,
        cost_rate_hourly: true,
        cost_rate_source: true,
        data_source: true,
        alert_level: true,
        generated_at: true,
        created_at: true,
        staff: {
          select: { name: true },
        },
      },
      orderBy: [
        { period_start: 'desc' },
        { staff: { name: 'asc' } },
      ],
      skip: (page - 1) * per_page,
      take: per_page,
    });

    // Convert Decimal fields to numbers and format response
    const data: SnapshotRecord[] = snapshots.map((snap) => ({
      id: snap.id,
      staff_id: snap.staff_id,
      staff_name: snap.staff.name,
      period_start: snap.period_start.toISOString(),
      period_end: snap.period_end.toISOString(),
      available_hours: Number(snap.available_hours),
      billable_hours: Number(snap.billable_hours),
      non_billable_hours: Number(snap.non_billable_hours),
      bench_hours: Number(snap.bench_hours),
      utilization_rate: Number(snap.utilization_rate),
      bench_cost: Number(snap.bench_cost),
      cost_rate_hourly: Number(snap.cost_rate_hourly),
      cost_rate_source: snap.cost_rate_source,
      data_source: snap.data_source,
      alert_level: snap.alert_level,
      generated_at: snap.generated_at.toISOString(),
      created_at: snap.created_at.toISOString(),
    }));

    const totalPages = Math.ceil(total / per_page);

    return NextResponse.json({
      data,
      pagination: {
        page,
        per_page,
        total,
        total_pages: totalPages,
      },
    });
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
    console.error('Utilization snapshots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
