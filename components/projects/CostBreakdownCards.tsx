import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Users, Package, Calculator, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface SnapshotData {
  subscription_costs: number;
  staff_costs: number;
  contractor_costs: number;
  other_costs: number;
  total_costs: number;
  revenue: number;
}

interface CostBreakdownCardsProps {
  /** Current month snapshot (may be null if no data yet). */
  snapshot: SnapshotData | null;
  /** All historical snapshots for cumulative calculation. */
  allSnapshots: SnapshotData[];
  /** Optional budget target for utilization display. */
  budgetTarget: number | null;
}

/**
 * Displays a grid of cost category cards for a project.
 * Shows current month costs per category plus a cumulative total
 * across all months the project has been active.
 */
export function CostBreakdownCards({
  snapshot,
  allSnapshots,
  budgetTarget,
}: CostBreakdownCardsProps) {
  const subscriptionCosts = snapshot?.subscription_costs ?? 0;
  const staffCosts = snapshot?.staff_costs ?? 0;
  const contractorCosts = snapshot?.contractor_costs ?? 0;
  const otherCosts = snapshot?.other_costs ?? 0;
  const totalCosts = snapshot?.total_costs ?? 0;

  // Cumulative totals across all active months
  const cumulative = allSnapshots.reduce(
    (acc, s) => ({
      subscription_costs: acc.subscription_costs + s.subscription_costs,
      staff_costs: acc.staff_costs + s.staff_costs,
      contractor_costs: acc.contractor_costs + s.contractor_costs,
      other_costs: acc.other_costs + s.other_costs,
      total_costs: acc.total_costs + s.total_costs,
      revenue: acc.revenue + s.revenue,
    }),
    { subscription_costs: 0, staff_costs: 0, contractor_costs: 0, other_costs: 0, total_costs: 0, revenue: 0 },
  );

  const budgetUtilization =
    budgetTarget && budgetTarget > 0
      ? (cumulative.total_costs / budgetTarget) * 100
      : null;

  const getBudgetColor = (utilization: number): string => {
    if (utilization > 100) return 'text-red-600';
    if (utilization >= 80) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {/* Subscriptions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
          <CreditCard className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(subscriptionCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </CardContent>
      </Card>

      {/* Staff */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Staff</CardTitle>
          <Users className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(staffCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </CardContent>
      </Card>

      {/* Contractors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contractors</CardTitle>
          <Users className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(contractorCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </CardContent>
      </Card>

      {/* Other */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Other</CardTitle>
          <Package className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-600">
            {formatCurrency(otherCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </CardContent>
      </Card>

      {/* Monthly Total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Total</CardTitle>
          <Calculator className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalCosts)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </CardContent>
      </Card>

      {/* Cumulative Total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cumulative Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(cumulative.total_costs)}
          </div>
          {budgetUtilization !== null && (
            <p className={`text-xs mt-1 ${getBudgetColor(budgetUtilization)}`}>
              {budgetUtilization.toFixed(1)}% of budget
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {allSnapshots.length} month{allSnapshots.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
