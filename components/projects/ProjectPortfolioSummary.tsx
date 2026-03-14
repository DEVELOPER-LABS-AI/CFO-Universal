import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderKanban, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface ProjectPortfolioSummaryProps {
  summary: {
    total_projects: number;
    active_projects: number;
    total_investment: number;
    total_revenue: number;
    overall_roi: number | null;
    projects_over_budget: number;
    projects_negative_roi: number;
  };
}

/**
 * Server component that displays KPI summary cards for the project portfolio.
 * Shows total projects, investment, revenue, ROI, and warning indicators.
 */
export function ProjectPortfolioSummary({ summary }: ProjectPortfolioSummaryProps) {
  const {
    total_projects,
    active_projects,
    total_investment,
    total_revenue,
    overall_roi,
    projects_over_budget,
    projects_negative_roi,
  } = summary;

  const roiDisplay =
    overall_roi !== null ? `${(overall_roi * 100).toFixed(1)}%` : 'N/A';

  const roiColor =
    overall_roi === null
      ? 'text-muted-foreground'
      : overall_roi >= 0
        ? 'text-green-600'
        : 'text-red-600';

  const currentMonth = new Date().toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const hasWarnings = projects_over_budget > 0 || projects_negative_roi > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total_projects}</div>
            <p className="text-xs text-muted-foreground">
              {active_projects} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(total_investment)}
            </div>
            <p className="text-xs text-muted-foreground">
              As of {currentMonth}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(total_revenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${roiColor}`}>{roiDisplay}</div>
          </CardContent>
        </Card>
      </div>

      {hasWarnings && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {projects_over_budget > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              {projects_over_budget} project{projects_over_budget !== 1 ? 's' : ''} over budget
            </span>
          )}
          {projects_negative_roi > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {projects_negative_roi} project{projects_negative_roi !== 1 ? 's' : ''} with negative ROI
            </span>
          )}
        </div>
      )}
    </div>
  );
}
