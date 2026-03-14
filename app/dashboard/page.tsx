import { requireAuth } from '@/lib/auth/helpers'
import { getOrganizationId } from '@/lib/auth/organization'
import { getOwnerPayDashboardSummary } from '@/app/actions/owner-pay-actions'
import { getAnalyticsData } from '@/app/actions/analytics'
import { getStrategistDashboard } from '@/app/actions/cfo-strategist'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertTriangle, Activity } from 'lucide-react'
import { KPISummaryCards } from '@/components/analytics/KPISummaryCards'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { CostBreakdownChart } from '@/components/analytics/CostBreakdownChart'
import { TopClientsChart } from '@/components/analytics/TopClientsChart'
import { TopRecommendations } from '@/components/cfo-strategist/TopRecommendations'
import { QuickNavCard } from '@/components/dashboard/QuickNavCard'
import { prisma } from '@/lib/prisma'
import { determineUtilizationStatus, SYSTEM_FALLBACK } from '@/lib/calculations/utilization-targets'

/** Fallback utilization shape when the fetch fails. */
const EMPTY_UTILIZATION = {
  orgUtilizationRate: 0,
  totalBenchCost: 0,
  benchStaffCount: 0,
  activeStaffCount: 0,
  status: 'on_target' as const,
}

/**
 * Fetch utilization summary from the most recent monthly snapshots.
 * Uses Prisma directly since this is a server component.
 */
async function getUtilizationSummary(organizationId: string) {
  // Get the most recent period's snapshots
  const latestSnapshot = await prisma.utilizationSnapshot.findFirst({
    where: { organization_id: organizationId },
    orderBy: { period_end: 'desc' },
    select: { period_start: true, period_end: true },
  })

  if (!latestSnapshot) return EMPTY_UTILIZATION

  const snapshots = await prisma.utilizationSnapshot.findMany({
    where: {
      organization_id: organizationId,
      period_start: latestSnapshot.period_start,
      period_end: latestSnapshot.period_end,
    },
    select: {
      available_hours: true,
      billable_hours: true,
      bench_cost: true,
      bench_hours: true,
    },
  })

  if (snapshots.length === 0) return EMPTY_UTILIZATION

  const totalAvailable = snapshots.reduce((sum, s) => sum + Number(s.available_hours), 0)
  const totalBillable = snapshots.reduce((sum, s) => sum + Number(s.billable_hours), 0)
  const totalBenchCost = snapshots.reduce((sum, s) => sum + Number(s.bench_cost), 0)
  const benchStaffCount = snapshots.filter((s) => Number(s.bench_hours) > 0).length

  const orgUtilizationRate = totalAvailable > 0
    ? Math.round((totalBillable / totalAvailable) * 100 * 100) / 100
    : 0

  // Resolve org-level target for status determination
  const orgTarget = await prisma.utilizationTarget.findFirst({
    where: {
      organization_id: organizationId,
      staff_type: null,
      enabled: true,
      deleted_at: null,
    },
    select: { warning_threshold: true, critical_threshold: true },
  })

  const thresholds = orgTarget
    ? { warning_threshold: Number(orgTarget.warning_threshold), critical_threshold: Number(orgTarget.critical_threshold) }
    : { warning_threshold: SYSTEM_FALLBACK.warning_threshold, critical_threshold: SYSTEM_FALLBACK.critical_threshold }

  const status = determineUtilizationStatus(orgUtilizationRate, thresholds)

  return {
    orgUtilizationRate,
    totalBenchCost: Math.round(totalBenchCost * 100) / 100,
    benchStaffCount,
    activeStaffCount: snapshots.length,
    status,
  }
}

/** Fallback analytics shape when the fetch fails. */
const EMPTY_ANALYTICS = {
  monthlyTrends: [],
  costBreakdown: [],
  topClientsByMargin: [],
  kpis: {
    revenue: { value: 0, change: 0 },
    profit: { value: 0, change: 0 },
    margin: { value: 0, change: 0 },
    activeClients: { value: 0, change: 0 },
  },
}

/** Fallback strategist shape when the fetch fails. */
const EMPTY_STRATEGIST = {
  topRecommendations: [] as { id: string; title: string; category: string; estimatedMonthlyImpact: number; confidenceLevel: number; hasTradeOff: boolean }[],
}

export default async function DashboardPage() {
  const user = await requireAuth()

  let organizationId: string | null = null
  try {
    organizationId = await getOrganizationId()
  } catch {
    // User may not have an organization yet
  }

  const [ownerPaySummary, analyticsResult, strategistResult, utilizationSummary] = await Promise.all([
    getOwnerPayDashboardSummary(),
    getAnalyticsData().catch(() => EMPTY_ANALYTICS),
    getStrategistDashboard().catch(() => EMPTY_STRATEGIST),
    organizationId
      ? getUtilizationSummary(organizationId).catch(() => EMPTY_UTILIZATION)
      : Promise.resolve(EMPTY_UTILIZATION),
  ])

  const analytics = analyticsResult ?? EMPTY_ANALYTICS
  const strategist = strategistResult ?? EMPTY_STRATEGIST
  const utilization = utilizationSummary ?? EMPTY_UTILIZATION

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$${value.toFixed(2)}`
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.fullName}
        </h1>
        <p className="text-muted-foreground">
          DevLabs CFO - Profit Optimization Dashboard
        </p>
      </div>

      {/* KPI Summary Cards with MoM trends */}
      <div className="mb-6">
        <KPISummaryCards kpis={analytics.kpis} />
      </div>

      {/* Owner Compensation Alert (conditional) */}
      {ownerPaySummary.ownerCount > 0 && (
        <div className="mb-6">
          <Card className={ownerPaySummary.totalDeferred > 0 ? 'border-red-200 bg-red-50/30' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Owner Deferred Compensation</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${ownerPaySummary.totalDeferred > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className={`text-2xl font-bold ${ownerPaySummary.totalDeferred > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(ownerPaySummary.totalDeferred))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ownerPaySummary.totalDeferred > 0 ? 'Total deferred balance' : 'No deferred balance'}
                  </p>
                </div>
                {ownerPaySummary.totalShortfall > 0 && (
                  <div className="border-l pl-4">
                    <div className="text-lg font-semibold text-red-600">
                      {formatCurrency(ownerPaySummary.totalShortfall)}
                    </div>
                    <p className="text-xs text-muted-foreground">Shortfall this month</p>
                  </div>
                )}
                <div className="ml-auto">
                  <Link href="/dashboard/compensation">
                    <Button size="sm" variant="outline">View Details</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Utilization Summary Widget */}
      {utilization.activeStaffCount > 0 && (
        <div className="mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Utilization</CardTitle>
              <Activity className={`h-4 w-4 ${
                utilization.status === 'critical' ? 'text-red-500' :
                utilization.status === 'warning' ? 'text-yellow-500' :
                'text-green-500'
              }`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Utilization Rate */}
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12">
                    <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={
                          utilization.status === 'critical' ? '#ef4444' :
                          utilization.status === 'warning' ? '#eab308' :
                          '#22c55e'
                        }
                        strokeWidth="3"
                        strokeDasharray={`${utilization.orgUtilizationRate}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                      {utilization.orgUtilizationRate.toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${
                      utilization.status === 'critical' ? 'text-red-600' :
                      utilization.status === 'warning' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {utilization.orgUtilizationRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Org Utilization</p>
                  </div>
                </div>

                {/* Bench Cost */}
                <div className="border-l pl-6">
                  <div className="text-lg font-semibold">
                    {formatCurrency(utilization.totalBenchCost)}
                  </div>
                  <p className="text-xs text-muted-foreground">Bench Cost (Current Period)</p>
                </div>

                {/* Bench Staff Count */}
                <div className="border-l pl-6">
                  <div className="text-lg font-semibold">
                    {utilization.benchStaffCount} <span className="text-sm font-normal text-muted-foreground">/ {utilization.activeStaffCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Staff on Bench</p>
                </div>

                {/* View Details Link */}
                <div className="ml-auto">
                  <Link href="/dashboard/utilization">
                    <Button size="sm" variant="outline">View Details</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue & Profit Trend Chart (full width) */}
      <div className="mb-6">
        <RevenueChart data={analytics.monthlyTrends} />
      </div>

      {/* Cost Breakdown + Top Clients */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <CostBreakdownChart data={analytics.costBreakdown} />
        <TopClientsChart data={analytics.topClientsByMargin} />
      </div>

      {/* CFO Recommendations + Quick Navigation */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopRecommendations recommendations={strategist.topRecommendations} />
        <QuickNavCard userRole={user.role} />
      </div>
    </div>
  )
}
