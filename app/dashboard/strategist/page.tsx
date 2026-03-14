'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, AlertTriangle, Zap, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import {
  getStrategistDashboard,
  refreshRecommendations,
} from '@/app/actions/cfo-strategist';
import { MarginKPICards } from '@/components/cfo-strategist/MarginKPICards';
import { MarginTrendChart } from '@/components/cfo-strategist/MarginTrendChart';
import { RecommendationCategoryCounts } from '@/components/cfo-strategist/RecommendationCategoryCounts';
import { TopRecommendations } from '@/components/cfo-strategist/TopRecommendations';
import { ClientMarginTable } from '@/components/cfo-strategist/ClientMarginTable';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

export default function StrategistPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getStrategistDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStrategistDashboard();
      setData(result);
    } catch (error: unknown) {
      console.error('Failed to fetch strategist dashboard:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** T045: Manual refresh - runs the recommendation engine and reloads dashboard. */
  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshRecommendations();
      toast.success(
        `Refreshed: ${result.generated} new, ${result.updated} updated, ${result.conflictsTagged} conflicts`
      );
      await fetchData();
    } catch (error: unknown) {
      console.error('Failed to refresh recommendations:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // T046: Empty state - no data at all (no integrations or no metrics)
  const hasNoData = !data || (data.marginHistory.length === 0 && data.clientMargins.length === 0);
  const hasLimitedData = data && data.marginHistory.length > 0 && data.marginHistory.length < 2;
  const hasNoRecommendations = data && data.recommendationCounts.total === 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CFO Strategist</h1>
          <p className="text-muted-foreground">
            Financial health overview and optimization recommendations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* T046: No data empty state */}
      {hasNoData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Zap className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Connect an integration to get started</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Connect Mercury or Xero in Settings to import financial data.
              The CFO Strategist will then analyze your margins and generate recommendations.
            </p>
            <Link href="/dashboard/settings">
              <Button variant="outline" className="mt-2">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* T046: Limited data banner */}
      {!hasNoData && hasLimitedData && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Limited data available &mdash; recommendations will improve with more historical data.
          </p>
        </div>
      )}

      {!hasNoData && data && (
        <>
          {/* KPI Cards */}
          <MarginKPICards
            currentMargin={data.currentMargin}
            targetMargin={data.targetMargin}
            marginTrend={data.marginTrend}
            marginChangePercent={data.marginChangePercent}
            projectedMargin={data.projectedMargin}
            accuracyScore={data.accuracyScore}
          />

          {/* Margin Trend Chart (full width) */}
          <MarginTrendChart data={data.marginHistory} />

          {/* Category Counts + Top Recommendations (side by side) */}
          <div className="grid gap-6 md:grid-cols-2">
            <RecommendationCategoryCounts counts={data.recommendationCounts} />
            {hasNoRecommendations ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-full py-8 gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <h3 className="text-sm font-semibold">Your margins are healthy!</h3>
                  <p className="text-xs text-muted-foreground text-center">
                    No optimization recommendations at this time.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <TopRecommendations recommendations={data.topRecommendations} />
            )}
          </div>

          {/* Client Margin Table */}
          <ClientMarginTable clients={data.clientMargins} />
        </>
      )}
    </div>
  );
}
