'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CategoryCounts {
  /** Number of subscription-related recommendations. */
  subscription: number;
  /** Number of staffing-related recommendations. */
  staffing: number;
  /** Number of revenue-related recommendations. */
  revenue: number;
  /** Number of overhead-related recommendations. */
  overhead: number;
  /** Total active recommendations across all categories. */
  total: number;
}

interface RecommendationCategoryCountsProps {
  /** Counts broken down by recommendation category. */
  counts: CategoryCounts;
}

/** Color map for each recommendation category. */
const CATEGORY_COLORS: Record<keyof Omit<CategoryCounts, 'total'>, { bg: string; text: string }> = {
  subscription: { bg: 'bg-violet-100', text: 'text-violet-700' },
  staffing: { bg: 'bg-amber-100', text: 'text-amber-700' },
  revenue: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  overhead: { bg: 'bg-red-100', text: 'text-red-700' },
};

/** Human-readable labels for each category. */
const CATEGORY_LABELS: Record<keyof Omit<CategoryCounts, 'total'>, string> = {
  subscription: 'Subscription',
  staffing: 'Staffing',
  revenue: 'Revenue',
  overhead: 'Overhead',
};

/**
 * Displays category-level recommendation counts as colored badges alongside a
 * prominent total count.
 */
export function RecommendationCategoryCounts({ counts }: RecommendationCategoryCountsProps) {
  const categories = ['subscription', 'staffing', 'revenue', 'overhead'] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-3xl font-bold">{counts.total}</span>
          <span className="text-sm text-muted-foreground">total active</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => {
            const colors = CATEGORY_COLORS[category];
            return (
              <div key={category} className="flex items-center gap-2">
                <Badge
                  className={`${colors.bg} ${colors.text} hover:${colors.bg} font-semibold`}
                >
                  {counts[category]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
