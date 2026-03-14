'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, TrendingDown, Crosshair, Award } from 'lucide-react';

interface MarginKPICardsProps {
  /** Current margin percentage (e.g. 32.5 for 32.5%). */
  currentMargin: number;
  /** Target margin percentage. */
  targetMargin: number;
  /** Direction of the margin trend. */
  marginTrend: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
  /** Percentage change from previous period. */
  marginChangePercent: number;
  /** Projected margin for next month. */
  projectedMargin: number;
  /** Forecast accuracy score (0-100) or null when unavailable. */
  accuracyScore: number | null;
}

/**
 * Displays 4 KPI cards for CFO Strategist margin overview:
 * Current Margin, Target Margin, Projected Next Month, and Accuracy Score.
 */
export function MarginKPICards({
  currentMargin,
  targetMargin,
  marginTrend,
  marginChangePercent,
  projectedMargin,
  accuracyScore,
}: MarginKPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Margin</CardTitle>
          {marginTrend === 'DOWN' ? (
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currentMargin.toFixed(1)}%</div>
          <div className="mt-1">
            {marginTrend === 'FLAT' || marginTrend === 'NEW' ? (
              <span className="text-xs text-muted-foreground">
                {marginTrend === 'NEW' ? 'New data' : 'No change'}
              </span>
            ) : (
              <Badge
                className={
                  marginTrend === 'UP'
                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                    : 'bg-red-100 text-red-700 hover:bg-red-100'
                }
              >
                {marginTrend === 'UP' ? (
                  <TrendingUp className="mr-1 h-3 w-3" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3" />
                )}
                {marginTrend === 'UP' ? '+' : '-'}
                {marginChangePercent.toFixed(1)}pp
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Target Margin</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{targetMargin.toFixed(1)}%</div>
          <span className="text-xs text-muted-foreground">Organization goal</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projected Next Month</CardTitle>
          <Crosshair className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{projectedMargin.toFixed(1)}%</div>
          <span className="text-xs text-muted-foreground">Forecast estimate</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Accuracy Score</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {accuracyScore !== null ? `${accuracyScore.toFixed(0)}%` : 'N/A'}
          </div>
          <span className="text-xs text-muted-foreground">Forecast reliability</span>
        </CardContent>
      </Card>
    </div>
  );
}
