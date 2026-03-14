/**
 * T015: GET /api/utilization/bench/export
 *
 * CSV export of the bench report data.
 * Reuses the same bench report calculation logic as T014.
 *
 * Auth: ADMIN or EXECUTIVE role required.
 * Query params: month, year, staff_type, engagement_type, sort_by, sort_order, include_all
 *
 * Returns text/csv with Content-Disposition header for download.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { benchQuerySchema } from '@/lib/validations/utilization';
import { generateBenchReport } from '@/lib/calculations/bench-report';

/**
 * Escape a CSV field value. Wraps in double quotes if the value contains
 * commas, double quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parsed = benchQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const report = await generateBenchReport(organizationId, parsed.data);

    // Build CSV
    const headers = [
      'Name',
      'Staff Type',
      'Engagement Type',
      'Agency',
      'Utilization Rate (%)',
      'Available Hours',
      'Billable Hours',
      'Bench Hours',
      'Bench Cost ($)',
      'Days on Bench',
      'Last Assignment End',
      'Data Source',
    ];

    const rows: string[] = [headers.join(',')];

    for (const entry of report.bench_staff) {
      const row = [
        escapeCsvField(entry.staff.name),
        escapeCsvField(entry.staff.staff_type),
        escapeCsvField(entry.staff.engagement_type),
        escapeCsvField(entry.staff.agency_name ?? ''),
        entry.utilization.rate.toFixed(2),
        entry.utilization.available_hours.toFixed(2),
        entry.utilization.billable_hours.toFixed(2),
        entry.utilization.bench_hours.toFixed(2),
        entry.cost.bench_cost.toFixed(2),
        entry.bench_info.days_on_bench !== null ? String(entry.bench_info.days_on_bench) : '',
        entry.bench_info.last_assignment_end ?? '',
        entry.utilization.data_source,
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const year = parsed.data.year ?? new Date().getFullYear();
    const filename = `bench-report-${year}-${String(month).padStart(2, '0')}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    }
    console.error('Bench report export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
