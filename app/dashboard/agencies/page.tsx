import { getAgencies } from '@/app/actions/agency-management';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign, Users, TrendingUp, AlertTriangle, Building2, UserCheck, BarChart3 } from 'lucide-react';
import { AgencyTable } from '@/components/agencies/AgencyTable';
import { AddAgencyModal } from '@/components/agencies/AddAgencyModal';
import { toMonthlyCost } from '@/lib/utils/currency';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function AgenciesPage() {
  const { agencies } = await getAgencies();

  // --- Financial metrics ---

  // Total Monthly Agency Spend (avg monthly from Mercury data)
  const totalMonthlySpend = agencies.reduce((sum, a) => {
    return sum + (a.avg_monthly_spend ?? 0);
  }, 0);

  // Total lifetime Mercury spend
  const totalLifetimeSpend = agencies.reduce((sum, a) => {
    return sum + (a.mercury_total_spend ?? 0);
  }, 0);

  // Staff counts
  const totalStaff = agencies.reduce((sum, a) => sum + a.staff.length, 0);

  // Active staff (have at least one active assignment) vs bench (no active assignments)
  const allAgencyStaff = agencies.flatMap((a) => a.staff);
  const activeStaff = allAgencyStaff.filter((s) =>
    s.assignments.some((a: any) => !a.end_date)
  );
  const benchStaff = allAgencyStaff.filter((s) =>
    !s.assignments.some((a: any) => !a.end_date)
  );

  // Staff utilization rate
  const staffUtilizationRate = totalStaff > 0
    ? (activeStaff.length / totalStaff) * 100
    : 0;

  // Average cost per agency staff member
  const avgCostPerStaff = totalStaff > 0 && totalMonthlySpend > 0
    ? totalMonthlySpend / totalStaff
    : 0;

  // Variance alerts - agencies with latest breakdown variance > $100
  const agenciesWithVariance = agencies.filter((a) => {
    const latest = a.breakdowns[0];
    return latest && Math.abs(Number(latest.variance)) > 100;
  });

  // Feature 14: Aggregate margin metrics
  const staffWithTrueCost = allAgencyStaff.filter((s: any) => s.true_cost != null && s.deleted_at == null);
  const totalTrueCost = staffWithTrueCost.reduce((sum: number, s: any) => {
    return sum + toMonthlyCost(Number(s.true_cost), s.true_cost_rate_type ?? s.rate_type);
  }, 0);
  const totalBilled = staffWithTrueCost.reduce((sum: number, s: any) => {
    return sum + toMonthlyCost(Number(s.rate), s.rate_type);
  }, 0);
  const totalMargin = totalBilled - totalTrueCost;
  const avgMarginPct = totalTrueCost > 0 ? (totalMargin / totalTrueCost) * 100 : 0;

  // Per-agency breakdown for secondary cards
  const agencyBreakdown = agencies.map((a) => {
    const staffCount = a.staff.length;
    const activeCount = a.staff.filter((s) =>
      s.assignments.some((asn: any) => !asn.end_date)
    ).length;
    // Feature 14: per-agency margin
    const agencyStaffWithCost = a.staff.filter((s: any) => s.true_cost != null);
    const agencyTrueCost = agencyStaffWithCost.reduce((sum: number, s: any) => sum + toMonthlyCost(Number(s.true_cost), s.true_cost_rate_type ?? s.rate_type), 0);
    const agencyBilled = agencyStaffWithCost.reduce((sum: number, s: any) => sum + toMonthlyCost(Number(s.rate), s.rate_type), 0);
    const agencyMarginPct = agencyTrueCost > 0 ? ((agencyBilled - agencyTrueCost) / agencyTrueCost) * 100 : null;
    return {
      name: a.name,
      staffCount,
      activeCount,
      monthlySpend: a.avg_monthly_spend ?? 0,
      marginPct: agencyMarginPct,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agency Partners</h1>
          <p className="text-muted-foreground">Manage agency partnerships and monthly breakdowns</p>
        </div>
        <AddAgencyModal
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Agency
            </Button>
          }
        />
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMonthlySpend > 0 ? fmt(totalMonthlySpend) : '\u2014'}
            </div>
            <p className="text-xs text-muted-foreground">
              {agencies.length} agency partner{agencies.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agency Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff}</div>
            <p className="text-xs text-muted-foreground">
              {activeStaff.length} assigned, {benchStaff.length} on bench
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Utilization</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStaff > 0 ? `${staffUtilizationRate.toFixed(0)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeStaff.length} of {totalStaff} on client work
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost per Staff</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgCostPerStaff > 0 ? fmt(avgCostPerStaff) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              monthly per agency member
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance Alerts</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${agenciesWithVariance.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${agenciesWithVariance.length > 0 ? 'text-destructive' : ''}`}>
              {agenciesWithVariance.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {agenciesWithVariance.length > 0
                ? `${agenciesWithVariance.map(a => a.name).join(', ')}`
                : 'No discrepancies'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Spend</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLifetimeSpend > 0 ? fmt(totalLifetimeSpend) : '\u2014'}
            </div>
            <p className="text-xs text-muted-foreground">
              total Mercury payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feature 14: Margin Metrics */}
      {staffWithTrueCost.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total True Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totalTrueCost)}</div>
              <p className="text-xs text-muted-foreground">{staffWithTrueCost.length} staff with cost data</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalMargin < 0 ? 'text-red-600' : ''}`}>{fmt(totalMargin)}</div>
              <p className="text-xs text-muted-foreground">billed {fmt(totalBilled)} - cost {fmt(totalTrueCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Margin %</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${avgMarginPct < 0 ? 'text-red-600' : ''}`}>{avgMarginPct.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">weighted across all agencies</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-Agency Breakdown */}
      {agencyBreakdown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agencyBreakdown.map((agency) => (
            <div key={agency.name} className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">{agency.name}</p>
              <p className="text-2xl font-bold">{agency.staffCount} staff</p>
              <p className="text-xs text-muted-foreground">
                {agency.activeCount} active &middot; {agency.monthlySpend > 0 ? `${fmt(agency.monthlySpend)}/mo` : 'No spend data'}
                {agency.marginPct != null && (
                  <span className={agency.marginPct < 0 ? ' text-red-600' : ''}> &middot; {agency.marginPct.toFixed(1)}% margin</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Agency Table */}
      <AgencyTable agencies={agencies} />
    </div>
  );
}
