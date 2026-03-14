import { getStaff } from '@/app/actions/staff-management';
import { getAgencies } from '@/app/actions/agency-management';
import { getContractors } from '@/app/actions/contractor-management';
import { getClients } from '@/app/actions/client-management';
import { getStaffRoles } from '@/app/actions/staff-role-management';
import { getClientROIDashboard } from '@/app/actions/roi-calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, DollarSign, Users, TrendingUp, AlertTriangle, Building2 } from 'lucide-react';
import { StaffTable } from '@/components/staff/StaffTable';
import { AddStaffModal } from '@/components/staff/AddStaffModal';
import { ManageRolesModal } from '@/components/staff/ManageRolesModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toMonthlyCost } from '@/lib/utils/currency';

function sumMonthlyCost(staff: any[]): number {
  return staff.reduce((sum: number, s: any) => sum + toMonthlyCost(Number(s.rate), s.rate_type), 0);
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  try {
  const params = await searchParams;
  const staffType = params.type;

  const [
    { staff: allStaff },
    { staff: agencyStaff },
    { agencies: agenciesRaw },
    contractorsRaw,
    roles,
    { summary: roiSummary },
    { clients: clientsRaw },
  ] = await Promise.all([
    getStaff(),
    getStaff({ has_agency: true }),
    getAgencies(),
    getContractors(),
    getStaffRoles(),
    getClientROIDashboard(),
    getClients({ limit: 100 }),
  ]);

  const agencies = agenciesRaw.map((a: any) => ({ id: a.id, name: a.name }));
  const contractors = contractorsRaw.map((c: any) => ({ id: c.id, name: c.name }));
  const roleOptions = roles.map((r: any) => ({ name: r.name, display_name: r.display_name }));

  // Separate active from terminated staff
  const activeStaff = allStaff.filter((s: any) => s.status !== 'TERMINATED');
  const terminatedStaff = allStaff.filter((s: any) => s.status === 'TERMINATED');

  // Build set of internal client IDs for utilization classification
  const internalClientIds = new Set(
    clientsRaw.filter((c: any) => c.is_internal).map((c: any) => c.id)
  );

  // --- Financial metrics (active staff only) ---

  // Total Monthly Payroll (active staff only)
  const totalMonthlyPayroll = sumMonthlyCost(activeStaff);

  // Separate owners from operational staff for utilization metrics (active only)
  const ownerStaff = activeStaff.filter((s: any) => s.engagement_type === 'OWNER');
  const operationalStaff = activeStaff.filter((s: any) => s.engagement_type !== 'OWNER');

  // Classify operational staff into: billable / internal-only / bench
  const billableStaff = operationalStaff.filter((s: any) =>
    s.assignments.some((a: any) => !a.end_date && !internalClientIds.has(a.client.id))
  );
  const internalOnlyStaff = operationalStaff.filter((s: any) => {
    const active = s.assignments.filter((a: any) => !a.end_date);
    return active.length > 0 && active.every((a: any) => internalClientIds.has(a.client.id));
  });
  const benchStaff = operationalStaff.filter((s: any) =>
    !s.assignments.some((a: any) => !a.end_date)
  );

  // Billable Utilization Rate (excludes owners)
  const billableUtilizationRate = operationalStaff.length > 0
    ? (billableStaff.length / operationalStaff.length) * 100
    : 0;

  // Unassigned Staff Cost (true bench only — not internal)
  const unassignedCost = sumMonthlyCost(benchStaff);

  // Internal staff cost
  const internalCost = sumMonthlyCost(internalOnlyStaff);

  // Cost by Role Category (active staff only)
  const roleCounts: Record<string, number> = {};
  const costByRole: Record<string, number> = {};
  for (const member of activeStaff) {
    const rt = (member as any).staff_type || 'UNKNOWN';
    roleCounts[rt] = (roleCounts[rt] || 0) + 1;
    costByRole[rt] = (costByRole[rt] || 0) + toMonthlyCost(Number((member as any).rate), (member as any).rate_type);
  }

  // Revenue per Staff Dollar
  const revenuePerStaffDollar = totalMonthlyPayroll > 0
    ? roiSummary.totalRevenue / totalMonthlyPayroll
    : 0;

  // Cost-to-Revenue Ratio
  const costToRevenueRatio = roiSummary.totalRevenue > 0
    ? (totalMonthlyPayroll / roiSummary.totalRevenue) * 100
    : 0;

  // Build filtered lists per role (active staff only for role tabs)
  const staffByRole: Record<string, typeof allStaff> = {};
  for (const role of roles) {
    staffByRole[role.name] = activeStaff.filter((s: any) => s.staff_type === role.name);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage your team and assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <ManageRolesModal
            roles={roles}
            trigger={
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Manage Roles
              </Button>
            }
          />
          <AddStaffModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            }
            agencies={agencies}
            contractors={contractors}
            roles={roleOptions}
          />
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalMonthlyPayroll)}</div>
            <p className="text-xs text-muted-foreground">{activeStaff.length} active staff{terminatedStaff.length > 0 ? `, ${terminatedStaff.length} terminated` : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Utilization</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{billableUtilizationRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {billableStaff.length} billable, {internalOnlyStaff.length} internal, {benchStaff.length} bench
              {ownerStaff.length > 0 && ` (excl. ${ownerStaff.length} owner${ownerStaff.length > 1 ? 's' : ''})`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Staff Cost</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${unassignedCost > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${unassignedCost > 0 ? 'text-destructive' : ''}`}>
              {fmt(unassignedCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              {benchStaff.length} staff on bench
            </p>
          </CardContent>
        </Card>

        {internalOnlyStaff.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Internal Staff Cost</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(internalCost)}</div>
              <p className="text-xs text-muted-foreground">
                {internalOnlyStaff.length} on internal projects
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue per Staff $</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenuePerStaffDollar > 0 ? `${revenuePerStaffDollar.toFixed(2)}x` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {roiSummary.totalRevenue > 0 ? `${fmt(roiSummary.totalRevenue)} total revenue` : 'No ROI data yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost-to-Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costToRevenueRatio > 0 ? `${costToRevenueRatio.toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {costToRevenueRatio > 0 && costToRevenueRatio <= 40 ? 'Healthy range' : costToRevenueRatio > 40 ? 'Above target (40%)' : 'No ROI data yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {roles.map((role: any) => (
          <div key={role.name} className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">{role.display_name}</p>
            <p className="text-2xl font-bold">{roleCounts[role.name] || 0}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(costByRole[role.name] || 0)}/mo
            </p>
          </div>
        ))}
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Agency Staff</p>
          <p className="text-2xl font-bold">{agencyStaff.filter((s: any) => s.status !== 'TERMINATED').length}</p>
          <p className="text-xs text-muted-foreground">
            {fmt(sumMonthlyCost(agencyStaff.filter((s: any) => s.status !== 'TERMINATED')))}/mo
          </p>
        </div>
      </div>

      {/* Tabs for filtering by role */}
      <Tabs defaultValue={staffType || 'all'} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All Staff</TabsTrigger>
          {roles.map((role: any) => (
            <TabsTrigger key={role.name} value={role.name}>
              {role.display_name}
            </TabsTrigger>
          ))}
          <TabsTrigger value="AGENCY">Agency Staff</TabsTrigger>
          {terminatedStaff.length > 0 && (
            <TabsTrigger value="TERMINATED">
              Terminated ({terminatedStaff.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <StaffTable staff={activeStaff} agencies={agencies} contractors={contractors} roles={roleOptions} />
        </TabsContent>

        {roles.map((role: any) => (
          <TabsContent key={role.name} value={role.name} className="space-y-4">
            <StaffTable
              staff={staffByRole[role.name] || []}
              agencies={agencies}
              contractors={contractors}
              roles={roleOptions}
            />
          </TabsContent>
        ))}

        <TabsContent value="AGENCY" className="space-y-4">
          <StaffTable staff={agencyStaff} agencies={agencies} contractors={contractors} roles={roleOptions} />
        </TabsContent>

        {terminatedStaff.length > 0 && (
          <TabsContent value="TERMINATED" className="space-y-4">
            <StaffTable staff={terminatedStaff} agencies={agencies} contractors={contractors} roles={roleOptions} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
  } catch (error) {
    console.error('[staff] Page render error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Staff</h1>
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error loading staff</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    );
  }
}
