import { getSubscriptions } from '@/app/actions/subscription-management';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SubscriptionTable } from '@/components/subscriptions/SubscriptionTable';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { PeriodPicker } from '@/components/subscriptions/PeriodPicker';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const periodMonth = params.month ? parseInt(params.month, 10) : undefined;
  const periodYear = params.year ? parseInt(params.year, 10) : undefined;

  const hasPeriod =
    periodMonth && periodYear && !isNaN(periodMonth) && !isNaN(periodYear);

  const { subscriptions, total, availablePeriods } = await getSubscriptions(
    hasPeriod ? { period_month: periodMonth, period_year: periodYear } : undefined
  );

  const activeCount = subscriptions.filter((s) => s.is_active).length;
  const totalCost = subscriptions
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + (s.effective_cost ?? Number(s.total_cost)), 0);
  const unutilizedCost = subscriptions
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + s.utilization.unutilizedCost, 0);

  const periodLabel = hasPeriod
    ? `${MONTH_NAMES[periodMonth! - 1]} ${periodYear}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage SaaS subscriptions and cost allocation</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodPicker
            availablePeriods={availablePeriods}
            selectedMonth={hasPeriod ? periodMonth : undefined}
            selectedYear={hasPeriod ? periodYear : undefined}
          />
          <AddSubscriptionModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Subscription
              </Button>
            }
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
          <p className="text-2xl font-bold">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{total} total</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">
            {periodLabel ? `Cost for ${periodLabel}` : 'Total Monthly Cost'}
          </p>
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Unutilized Cost</p>
          <p className="text-2xl font-bold text-muted-foreground">${unutilizedCost.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Unallocated subscription costs</p>
        </div>
      </div>

      {/* Subscription Table */}
      <SubscriptionTable subscriptions={subscriptions} />
    </div>
  );
}
