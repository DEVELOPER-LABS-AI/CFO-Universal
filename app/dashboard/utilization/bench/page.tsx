/**
 * T017/T036: Bench Report Page
 *
 * Server component that displays organization bench cost analytics.
 * Shows summary cards (total bench cost, headcount, avg duration, payroll %)
 * followed by a bench cost trend chart and a detailed sortable table of
 * staff below utilization targets.
 *
 * Auth: ADMIN or EXECUTIVE role required.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, DollarSign, Users, Clock, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { generateBenchReport } from '@/lib/calculations/bench-report';
import { BenchStaffTable } from '@/components/utilization/bench-staff-table';
import { BenchCostTrendChart } from '@/components/utilization/bench-cost-trend-chart';

export default async function BenchReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAuth();

  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    redirect('/dashboard');
  }

  const organizationId = await getOrganizationId();
  const params = await searchParams;

  // Parse query parameters
  const now = new Date();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const year = params.year ? Number(params.year) : now.getFullYear();

  const report = await generateBenchReport(organizationId, {
    month,
    year,
    staff_type: typeof params.staff_type === 'string' ? params.staff_type : undefined,
    engagement_type: typeof params.engagement_type === 'string' ? params.engagement_type : undefined,
    sort_by: typeof params.sort_by === 'string' ? params.sort_by as any : undefined,
    sort_order: typeof params.sort_order === 'string' ? params.sort_order as any : undefined,
    include_all: params.include_all === 'true',
  });

  const exportUrl = `/api/utilization/bench/export?month=${month}&year=${year}`;

  // --- T036: Fetch last 12 months of snapshots for bench cost trend chart ---
  const benchTrendLookback = new Date();
  benchTrendLookback.setMonth(benchTrendLookback.getMonth() - 12);
  benchTrendLookback.setHours(0, 0, 0, 0);

  const benchSnapshots = await prisma.utilizationSnapshot.findMany({
    where: {
      organization_id: organizationId,
      period_start: { gte: benchTrendLookback },
    },
    select: {
      staff_id: true,
      period_start: true,
      bench_hours: true,
      bench_cost: true,
    },
    orderBy: { period_start: 'asc' },
  });

  // Aggregate snapshots by period for the bench cost trend chart
  const benchPeriodMap = new Map<
    string,
    {
      period_start: string;
      total_bench_cost: number;
      bench_staff_ids: Set<string>;
    }
  >();

  for (const snap of benchSnapshots) {
    const key = snap.period_start.toISOString();
    const entry = benchPeriodMap.get(key) ?? {
      period_start: key,
      total_bench_cost: 0,
      bench_staff_ids: new Set<string>(),
    };
    const benchCost = Number(snap.bench_cost);
    const benchHours = Number(snap.bench_hours);
    entry.total_bench_cost += benchCost;
    if (benchHours > 0) {
      entry.bench_staff_ids.add(snap.staff_id);
    }
    benchPeriodMap.set(key, entry);
  }

  const benchTrendData = Array.from(benchPeriodMap.values())
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((p) => ({
      period_start: p.period_start,
      bench_cost: Math.round(p.total_bench_cost * 100) / 100,
      bench_headcount: p.bench_staff_ids.size,
    }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bench Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Staff utilization and bench cost analysis for{' '}
            {new Date(year, month - 1).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <a href={exportUrl} download>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bench Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(report.summary.total_bench_cost)}
            </div>
            <p className="text-xs text-muted-foreground">
              {report.summary.org_utilization_rate.toFixed(1)}% org utilization
              (target: {report.summary.target_rate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bench Headcount</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.summary.total_bench_headcount}
            </div>
            <p className="text-xs text-muted-foreground">
              of {report.summary.total_active_staff} active staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Days on Bench</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.summary.average_bench_duration_days.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              {report.period.working_days} working days in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bench % of Payroll</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.summary.bench_cost_as_pct_of_payroll.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(report.summary.total_payroll_cost)} total payroll
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bench Cost Trend Chart */}
      <BenchCostTrendChart data={benchTrendData} />

      {/* Bench Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Staff Below Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BenchStaffTable staff={report.bench_staff} />
        </CardContent>
      </Card>
    </div>
  );
}
