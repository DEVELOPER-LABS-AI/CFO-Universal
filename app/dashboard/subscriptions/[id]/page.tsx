import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { getSubscriptionTrend } from '@/lib/calculations/trend-reporter';
import { SubscriptionTrendChart } from '@/components/subscriptions/SubscriptionTrendChart';
import { AllocationSummaryCard } from '@/components/subscriptions/AllocationSummaryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MerchantLinkModal } from '@/components/subscriptions/MerchantLinkModal';
import { AllocateSubscriptionModal } from '@/components/subscriptions/AllocateSubscriptionModal';
import { SubscriptionSettingsModal } from '@/components/subscriptions/SubscriptionSettingsModal';
import { SubscriptionTransactionsTable } from '@/components/subscriptions/SubscriptionTransactionsTable';
import { ArrowLeft, Link2, PieChart, Settings } from 'lucide-react';

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizationId = await getOrganizationId();

  const subscription = await prisma.subscription.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
    include: {
      allocations: {
        include: {
          client: { select: { id: true, name: true, status: true } },
          staff: { select: { id: true, name: true, staff_type: true } },
        },
      },
    },
  });

  if (!subscription) {
    notFound();
  }

  // Fetch trend data server-side
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const trendData = await getSubscriptionTrend(id, currentMonth, currentYear, 6).catch(() => null);

  // Compute effective cost from linked Mercury transactions (latest month),
  // falling back to static total_cost if no transactions exist
  const latestPeriodCost = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['period_month', 'period_year'],
    where: { subscription_id: id },
    _sum: { amount: true },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    take: 1,
  });
  const transactionCost = latestPeriodCost.length > 0
    ? Number(latestPeriodCost[0]._sum.amount || 0)
    : 0;
  const rawCost = transactionCost > 0
    ? transactionCost
    : Number(subscription.total_cost);

  // Normalize to monthly cost based on billing frequency
  const billingDivisor = subscription.billing_frequency === 'QUARTERLY' ? 3
    : subscription.billing_frequency === 'ANNUAL' ? 12
    : 1;
  const effectiveCost = rawCost / billingDivisor;

  // Fetch clients and staff for allocation modal
  const [clients, staffMembers] = await Promise.all([
    prisma.client.findMany({
      where: { organization_id: organizationId, deleted_at: null, status: 'ACTIVE' },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    }),
    prisma.staff.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      select: { id: true, name: true, staff_type: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const allocationData = subscription.allocations.map((a) => ({
    ...a,
    client: a.client ?? undefined,
    staff: a.staff ?? undefined,
  }));

  // Per-pool data for modal
  const existingClientIds = subscription.allocations
    .filter((a) => a.client_id)
    .map((a) => a.client_id!);
  const existingStaffIds = subscription.allocations
    .filter((a) => a.staff_id)
    .map((a) => a.staff_id!);

  const allocateModalProps = {
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    totalCost: effectiveCost,
    currentClientAllocationCount: existingClientIds.length,
    currentStaffAllocationCount: existingStaffIds.length,
    existingClientIds,
    existingStaffIds,
    clients,
    staff: staffMembers,
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/subscriptions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Subscriptions
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{subscription.name}</h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Monthly cost:{' '}
              <span className="font-medium text-foreground">
                ${effectiveCost.toFixed(2)}
              </span>
            </span>
            {subscription.total_seats && (
              <span>
                Seats:{' '}
                <span className="font-medium text-foreground">{subscription.total_seats}</span>
              </span>
            )}
            <span>{subscription.billing_frequency}</span>
            <Badge variant={subscription.is_active ? 'default' : 'secondary'}>
              {subscription.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {subscription.is_enrichment && (
              <Badge variant="outline" className="border-purple-300 text-purple-700">
                Enrichment
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AllocateSubscriptionModal
            {...allocateModalProps}
            trigger={
              <Button>
                <PieChart className="mr-2 h-4 w-4" />
                Allocate
              </Button>
            }
          />
          <SubscriptionSettingsModal
            subscriptionId={subscription.id}
            currentSettings={{
              name: subscription.name,
              total_cost: Number(subscription.total_cost),
              total_seats: subscription.total_seats,
              allocation_type: subscription.allocation_type,
              billing_frequency: subscription.billing_frequency,
              is_active: subscription.is_active,
              is_enrichment: subscription.is_enrichment,
              total_credits: subscription.total_credits,
              credit_cost_email: subscription.credit_cost_email ? Number(subscription.credit_cost_email) : null,
              credit_cost_phone: subscription.credit_cost_phone ? Number(subscription.credit_cost_phone) : null,
            }}
            trigger={
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            }
          />
          <MerchantLinkModal
            subscriptionId={subscription.id}
            subscriptionName={subscription.name}
            trigger={
              <Button variant="outline">
                <Link2 className="mr-2 h-4 w-4" />
                Link Mercury Merchant
              </Button>
            }
          />
        </div>
      </div>

      {/* Cost trend chart */}
      {trendData && (
        <SubscriptionTrendChart
          subscriptionName={subscription.name}
          history={trendData.history}
          trend={trendData.trend}
          currentPeriod={trendData.currentPeriod}
          priorPeriod={trendData.priorPeriod}
        />
      )}

      {/* Allocation summary */}
      <AllocationSummaryCard
        subscriptionName={subscription.name}
        totalCost={effectiveCost}
        rawBillingCost={rawCost}
        billingFrequency={subscription.billing_frequency}
        allocations={allocationData as any}
        action={
          <AllocateSubscriptionModal
            {...allocateModalProps}
            trigger={
              <Button size="sm">
                <PieChart className="mr-2 h-4 w-4" />
                Allocate
              </Button>
            }
          />
        }
      />

      {/* Enrichment Credits Summary */}
      {subscription.is_enrichment && subscription.total_credits && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Enrichment Credits</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="text-xl font-bold">{subscription.total_credits.toLocaleString()}</p>
            </div>
            {subscription.credit_cost_email && (
              <div>
                <p className="text-xs text-muted-foreground">Credits / Email</p>
                <p className="text-xl font-bold">{Number(subscription.credit_cost_email)}</p>
              </div>
            )}
            {subscription.credit_cost_phone && (
              <div>
                <p className="text-xs text-muted-foreground">Credits / Phone</p>
                <p className="text-xl font-bold">{Number(subscription.credit_cost_phone)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Max Capacity</p>
              <p className="text-sm font-medium">
                {subscription.credit_cost_email
                  ? `${Math.floor(subscription.total_credits / Number(subscription.credit_cost_email)).toLocaleString()} emails`
                  : '—'}
                {subscription.credit_cost_email && subscription.credit_cost_phone && ' / '}
                {subscription.credit_cost_phone
                  ? `${Math.floor(subscription.total_credits / Number(subscription.credit_cost_phone)).toLocaleString()} phones`
                  : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction history (paginated, client-side) */}
      <SubscriptionTransactionsTable subscriptionId={id} subscriptionName={subscription.name} />
    </div>
  );
}
