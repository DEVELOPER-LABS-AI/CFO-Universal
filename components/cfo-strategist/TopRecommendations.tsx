'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/currency';
import { ArrowRight } from 'lucide-react';

interface Recommendation {
  /** Unique recommendation identifier. */
  id: string;
  /** Short recommendation title. */
  title: string;
  /** Category key (subscription, staffing, revenue, overhead). */
  category: string;
  /** Estimated monthly dollar impact. */
  estimatedMonthlyImpact: number;
  /** Confidence score between 0 and 1. */
  confidenceLevel: number;
  /** Whether the recommendation involves a trade-off. */
  hasTradeOff: boolean;
}

interface TopRecommendationsProps {
  /** Top recommendations to display (up to 3). */
  recommendations: Recommendation[];
}

/** Color map for each recommendation category badge. */
const CATEGORY_BADGE_COLORS: Record<string, string> = {
  SUBSCRIPTION_OPTIMIZATION: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  STAFFING_EFFICIENCY: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  REVENUE_OPPORTUNITY: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  OVERHEAD_REDUCTION: 'bg-red-100 text-red-700 hover:bg-red-100',
};

/** Human-readable labels for each category. */
const CATEGORY_LABELS: Record<string, string> = {
  SUBSCRIPTION_OPTIMIZATION: 'Subscription',
  STAFFING_EFFICIENCY: 'Staffing',
  REVENUE_OPPORTUNITY: 'Revenue',
  OVERHEAD_REDUCTION: 'Overhead',
};

/**
 * Returns a confidence label and color class based on the numeric confidence
 * level.
 */
function getConfidenceDisplay(level: number): { label: string; className: string } {
  if (level >= 0.7) {
    return { label: 'High', className: 'bg-green-100 text-green-700 hover:bg-green-100' };
  }
  if (level >= 0.4) {
    return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' };
  }
  return { label: 'Low', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' };
}

/**
 * Displays the top 3 recommendations as linked cards with category, impact,
 * confidence, and trade-off indicators. Falls back to an empty state when no
 * recommendations exist.
 */
export function TopRecommendations({ recommendations }: TopRecommendationsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            No active recommendations
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((rec) => {
              const confidence = getConfidenceDisplay(rec.confidenceLevel);
              const categoryColors =
                CATEGORY_BADGE_COLORS[rec.category] ??
                'bg-gray-100 text-gray-700 hover:bg-gray-100';

              return (
                <Link
                  key={rec.id}
                  href="/dashboard/strategist/recommendations"
                  className="block"
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="font-medium text-sm leading-tight">{rec.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={categoryColors}>
                              {CATEGORY_LABELS[rec.category] ?? rec.category}
                            </Badge>
                            <Badge className={confidence.className}>{confidence.label}</Badge>
                            {rec.hasTradeOff && (
                              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                Trade-off
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-green-700">
                            {formatCurrency(rec.estimatedMonthlyImpact)}/mo
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
