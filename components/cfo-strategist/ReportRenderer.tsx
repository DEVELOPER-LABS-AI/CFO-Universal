'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import type {
  DailyReportContent,
  WeeklyReportContent,
  MonthlyReportContent,
} from '@/lib/cfo-strategist/types';

// ============================================================================
// Props
// ============================================================================

interface ReportRendererProps {
  /** The report cadence determining which sections to render. */
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** Typed report content matching the reportType. */
  content: DailyReportContent | WeeklyReportContent | MonthlyReportContent;
}

// ============================================================================
// Severity helpers
// ============================================================================

/** Badge color classes keyed by alert severity. */
const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  WARNING: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  ERROR: 'bg-red-100 text-red-700 hover:bg-red-100',
};

/** Returns the severity Badge class, falling back to a neutral style. */
function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity.toUpperCase()] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-100';
}

/**
 * Returns a CSS text-color class for a numeric change value.
 * Positive values receive green, negative receive red, and zero stays neutral.
 */
function changeColor(value: number): string {
  if (value > 0) return 'text-green-700';
  if (value < 0) return 'text-red-700';
  return 'text-muted-foreground';
}

/**
 * Formats a number with a leading +/- sign and currency formatting.
 */
function formatSignedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
}

/**
 * Formats a percentage value with a leading +/- sign.
 */
function formatSignedPercent(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

// ============================================================================
// Empty-state helper
// ============================================================================

/** Renders a centered "No data" message used when a section has no entries. */
function NoData({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
      No {label} available
    </div>
  );
}

// ============================================================================
// Daily Sections
// ============================================================================

/** Renders a list of severity-tagged alert messages. */
function AlertsSection({
  alerts,
}: {
  alerts: DailyReportContent['alerts'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <NoData label="alerts" />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <Badge className={severityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders a list of top recommended actions with impact and category. */
function TopActionsSection({
  actions,
}: {
  actions: DailyReportContent['topActions'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Top Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <NoData label="actions" />
        ) : (
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-medium text-sm truncate">{action.title}</p>
                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 shrink-0">
                    {action.category}
                  </Badge>
                </div>
                <span className="text-sm font-semibold text-green-700 shrink-0">
                  {formatCurrency(action.impact)}/mo
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Weekly Sections
// ============================================================================

/** Renders margin trend data as a simple date/margin table. */
function MarginTrendSection({
  marginTrend,
}: {
  marginTrend: WeeklyReportContent['marginTrend'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Margin Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {marginTrend.length === 0 ? (
          <NoData label="margin trend data" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marginTrend.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell className="text-right font-medium">
                    {entry.margin.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders acted-upon recommendations with their expected impact. */
function ActedRecommendationsSection({
  actedRecommendations,
  newRecommendations,
}: {
  actedRecommendations: WeeklyReportContent['actedRecommendations'];
  newRecommendations: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acted Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {newRecommendations > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {newRecommendations} new recommendation{newRecommendations !== 1 ? 's' : ''} this week
          </div>
        )}
        {actedRecommendations.length === 0 ? (
          <NoData label="acted recommendations" />
        ) : (
          <div className="space-y-2">
            {actedRecommendations.map((rec, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{rec.title}</p>
                <span className="text-sm font-semibold text-green-700 shrink-0">
                  {formatCurrency(rec.expectedImpact)}/mo
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders a comparison table of cost categories vs. the prior period. */
function CostBreakdownSection({
  costBreakdownChanges,
}: {
  costBreakdownChanges: WeeklyReportContent['costBreakdownChanges'];
}) {
  const entries = Object.entries(costBreakdownChanges);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown Changes</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <NoData label="cost breakdown data" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Prior</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([category, data]) => (
                <TableRow key={category}>
                  <TableCell className="font-medium">{category}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.current)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.prior)}</TableCell>
                  <TableCell className={`text-right font-medium ${changeColor(data.change)}`}>
                    {formatSignedCurrency(data.change)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Monthly Sections
// ============================================================================

/** Renders four mini stat cards for month-over-month changes. */
function MonthOverMonthSection({
  monthOverMonth,
}: {
  monthOverMonth: MonthlyReportContent['monthOverMonth'];
}) {
  const stats: Array<{ label: string; value: number; isPercent: boolean }> = [
    { label: 'Revenue', value: monthOverMonth.revenue, isPercent: false },
    { label: 'Expenses', value: monthOverMonth.expenses, isPercent: false },
    { label: 'Margin', value: monthOverMonth.margin, isPercent: true },
    { label: 'Profit', value: monthOverMonth.profit, isPercent: false },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const TrendIcon = stat.value >= 0 ? TrendingUp : TrendingDown;
        return (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={`flex items-center gap-1.5 mt-1 font-semibold ${changeColor(stat.value)}`}>
                <TrendIcon className="h-4 w-4" />
                <span>
                  {stat.isPercent
                    ? formatSignedPercent(stat.value)
                    : formatSignedCurrency(stat.value)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** Renders an impact review table comparing expected vs realized savings. */
function ImpactReviewSection({
  impactReview,
}: {
  impactReview: MonthlyReportContent['impactReview'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Impact Review</CardTitle>
      </CardHeader>
      <CardContent>
        {impactReview.length === 0 ? (
          <NoData label="impact review data" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recommendation</TableHead>
                <TableHead className="text-right">Expected Savings</TableHead>
                <TableHead className="text-right">Realized Savings</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impactReview.map((item, idx) => {
                const realized = item.realizedSavings !== null;
                const metTarget = realized && item.realizedSavings! >= item.expectedSavings;
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.expectedSavings)}
                    </TableCell>
                    <TableCell className="text-right">
                      {realized ? formatCurrency(item.realizedSavings!) : '--'}
                    </TableCell>
                    <TableCell className="text-center">
                      {metTarget ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 inline-block" />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {realized ? 'Below target' : 'Pending'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders projected margin, revenue, and expenses for the next period. */
function ForecastSection({
  forecast,
}: {
  forecast: MonthlyReportContent['forecast'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Next Month Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Projected Margin</p>
            <p className="text-lg font-semibold">{forecast.projectedMargin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected Revenue</p>
            <p className="text-lg font-semibold">{formatCurrency(forecast.projectedRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected Expenses</p>
            <p className="text-lg font-semibold">{formatCurrency(forecast.projectedExpenses)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders collapsible category sections with total cost, percentage share,
 * change indicator, and nested recommendations.
 */
function CategoryDeepDiveSection({
  categoryDeepDive,
}: {
  categoryDeepDive: MonthlyReportContent['categoryDeepDive'];
}) {
  const entries = Object.entries(categoryDeepDive);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  /** Toggles visibility of a single category section. */
  function toggleCategory(category: string) {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Deep Dive</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <NoData label="category data" />
        ) : (
          <div className="space-y-2">
            {entries.map(([category, data]) => {
              const isOpen = openCategories[category] ?? false;
              return (
                <div key={category} className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{category}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(data.totalCost)} ({data.percentOfTotal.toFixed(1)}%)
                      </span>
                      <span className={`text-sm font-medium ${changeColor(data.change)}`}>
                        {formatSignedPercent(data.change)}
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t px-4 py-3">
                      {data.recommendations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No recommendations for this category
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {data.recommendations.map((rec, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <p className="text-sm">{rec.title}</p>
                              <span className="text-sm font-semibold text-green-700 shrink-0">
                                {formatCurrency(rec.impact)}/mo
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Renders CFO Strategist report content based on report type.
 *
 * Daily reports render alerts and top actions. Weekly reports extend daily with
 * margin trend, acted recommendations, and cost breakdown changes. Monthly
 * reports extend weekly with month-over-month stats, impact review, forecast,
 * and a category deep dive.
 */
export function ReportRenderer({ reportType, content }: ReportRendererProps) {
  const weeklyContent = content as WeeklyReportContent;
  const monthlyContent = content as MonthlyReportContent;

  return (
    <div className="space-y-6">
      {/* Daily sections -- always rendered */}
      <AlertsSection alerts={content.alerts} />
      <TopActionsSection actions={content.topActions} />

      {/* Weekly sections */}
      {(reportType === 'WEEKLY' || reportType === 'MONTHLY') && (
        <>
          <MarginTrendSection marginTrend={weeklyContent.marginTrend} />
          <ActedRecommendationsSection
            actedRecommendations={weeklyContent.actedRecommendations}
            newRecommendations={weeklyContent.newRecommendations}
          />
          <CostBreakdownSection costBreakdownChanges={weeklyContent.costBreakdownChanges} />
        </>
      )}

      {/* Monthly sections */}
      {reportType === 'MONTHLY' && (
        <>
          <MonthOverMonthSection monthOverMonth={monthlyContent.monthOverMonth} />
          <ImpactReviewSection impactReview={monthlyContent.impactReview} />
          <ForecastSection forecast={monthlyContent.forecast} />
          <CategoryDeepDiveSection categoryDeepDive={monthlyContent.categoryDeepDive} />
        </>
      )}
    </div>
  );
}
