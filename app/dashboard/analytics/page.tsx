'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Activity, Users, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { getAnalyticsData } from '@/app/actions/analytics';
import { refreshAllClientROI } from '@/app/actions/roi-calculations';
import { KPISummaryCards } from '@/components/analytics/KPISummaryCards';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { CostBreakdownChart } from '@/components/analytics/CostBreakdownChart';
import { TopClientsChart } from '@/components/analytics/TopClientsChart';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

/** Shape of the utilization KPI data from the /api/utilization/current endpoint. */
interface UtilizationKPIs {
  utilization_rate: number;
  total_bench_cost: number;
  bench_staff_count: number;
  active_staff_count: number;
  status: 'on_target' | 'warning' | 'critical';
  target_rate: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAnalyticsData>> | null>(null);
  const [utilizationKPIs, setUtilizationKPIs] = useState<UtilizationKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUtilization = useCallback(async () => {
    try {
      const response = await fetch('/api/utilization/current');
      if (response.ok) {
        const result = await response.json();
        if (result.organization) {
          setUtilizationKPIs({
            utilization_rate: result.organization.utilization_rate,
            total_bench_cost: result.organization.total_bench_cost,
            bench_staff_count: result.organization.bench_staff_count,
            active_staff_count: result.organization.active_staff_count,
            status: result.organization.status,
            target_rate: result.organization.target_rate,
          });
        }
      }
    } catch (error: unknown) {
      console.error('Failed to fetch utilization data:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAnalyticsData();
      setData(result);
    } catch (error: unknown) {
      console.error('Failed to fetch analytics data:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchUtilization();
  }, [fetchData, fetchUtilization]);

  const handleRefreshROI = async () => {
    setRefreshing(true);
    try {
      const now = new Date();
      const result = await refreshAllClientROI(now.getMonth() + 1, now.getFullYear());

      if (result.successful > 0) {
        toast.success(`Refreshed ROI for ${result.successful} clients`);
      }
      if (result.failed > 0) {
        toast.warning(`Failed for ${result.failed} clients`);
      }

      await fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground">
            Financial performance, KPIs, and portfolio insights
          </p>
        </div>
        <Button
          onClick={handleRefreshROI}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh ROI
            </>
          )}
        </Button>
      </div>

      {/* KPI Summary */}
      {data && <KPISummaryCards kpis={data.kpis} />}

      {/* Revenue Trend (full width) */}
      {data && <RevenueChart data={data.monthlyTrends} />}

      {/* Cost Breakdown + Top Clients (side by side) */}
      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          <CostBreakdownChart data={data.costBreakdown} />
          <TopClientsChart data={data.topClientsByMargin} />
        </div>
      )}

      {/* Utilization KPIs Section */}
      {utilizationKPIs && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold tracking-tight">Staff Utilization</h2>
            <Link
              href="/dashboard/utilization"
              className="text-sm text-blue-600 hover:underline"
            >
              View full report →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Org Utilization Rate</CardTitle>
                <Activity className={`h-4 w-4 ${
                  utilizationKPIs.status === 'critical' ? 'text-red-500' :
                  utilizationKPIs.status === 'warning' ? 'text-yellow-500' :
                  'text-green-500'
                }`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  utilizationKPIs.status === 'critical' ? 'text-red-600' :
                  utilizationKPIs.status === 'warning' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {utilizationKPIs.utilization_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: {utilizationKPIs.target_rate}%
                </p>
                <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      utilizationKPIs.status === 'critical' ? 'bg-red-500' :
                      utilizationKPIs.status === 'warning' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(utilizationKPIs.utilization_rate, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bench Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${utilizationKPIs.total_bench_cost.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current period idle cost
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
                  {utilizationKPIs.bench_staff_count}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {utilizationKPIs.active_staff_count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Staff with idle bench hours
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
