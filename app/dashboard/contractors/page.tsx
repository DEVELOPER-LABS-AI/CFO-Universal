import { getContractors } from '@/app/actions/contractor-management';
import { getClients } from '@/app/actions/client-management';
import { AddContractorModal } from '@/components/contractors/AddContractorModal';
import { ContractorTableRow } from '@/components/contractors/ContractorTableRow';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign, Users, TrendingUp, AlertTriangle, UserCheck } from 'lucide-react';
import { toMonthlyCost } from '@/lib/utils/currency';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  PROJECT: 'Project-Based',
  OWNER: 'Owner',
  AGENCY: 'Agency',
};

export default async function ContractorsPage() {
  try {
    const [contractors, { clients: clientsRaw }] = await Promise.all([
      getContractors(),
      getClients({ limit: 100 }),
    ]);
    const clientOptions = clientsRaw
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => ({ id: c.id, name: c.name }));

    // --- Financial metrics (exclude INACTIVE contractors) ---

    const activeStatusContractors = contractors.filter((c) => c.status === 'ACTIVE');

    // Total Monthly Contractor Cost (active only)
    const totalMonthlyCost = activeStatusContractors.reduce((sum, c) => {
      if (!c.rate || !c.rate_type) return sum;
      return sum + toMonthlyCost(c.rate, c.rate_type);
    }, 0);

    // Separate owners from operational contractors for utilization metrics (active only)
    const ownerContractors = activeStatusContractors.filter((c) => c.engagement_type === 'OWNER');
    const operationalContractors = activeStatusContractors.filter((c) => c.engagement_type !== 'OWNER');

    // Active vs bench contractors (excludes owners)
    const activeContractors = operationalContractors.filter((c) => c.utilization > 0);
    const benchContractors = operationalContractors.filter((c) => c.utilization === 0);

    // Average utilization across operational contractors (excludes owners)
    const avgUtilization = operationalContractors.length > 0
      ? operationalContractors.reduce((sum, c) => sum + c.utilization, 0) / operationalContractors.length
      : 0;

    // Unassigned contractor cost (bench, excludes owners)
    const benchCost = benchContractors.reduce((sum, c) => {
      if (!c.rate || !c.rate_type) return sum;
      return sum + toMonthlyCost(c.rate, c.rate_type);
    }, 0);

    // Fully utilized contractors (excludes owners)
    const fullyUtilized = operationalContractors.filter((c) => c.utilization >= 100);

    // Engagement type breakdown
    const engagementCounts: Record<string, number> = {};
    const engagementCost: Record<string, number> = {};
    for (const c of contractors) {
      const type = c.engagement_type || 'UNKNOWN';
      engagementCounts[type] = (engagementCounts[type] || 0) + 1;
      if (c.rate && c.rate_type) {
        engagementCost[type] = (engagementCost[type] || 0) + toMonthlyCost(c.rate, c.rate_type);
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contractors</h1>
            <p className="text-muted-foreground">Manage contractors and assignments</p>
          </div>
          <AddContractorModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Contractor
              </Button>
            }
          />
        </div>

        {/* Financial Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Monthly Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totalMonthlyCost)}</div>
              <p className="text-xs text-muted-foreground">{contractors.length} contractor{contractors.length !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Contractors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeContractors.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeContractors.length} assigned, {benchContractors.length} on bench
                {ownerContractors.length > 0 && ` (excl. ${ownerContractors.length} owner${ownerContractors.length > 1 ? 's' : ''})`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgUtilization.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground">
                {fullyUtilized.length} fully utilized
                {ownerContractors.length > 0 && ` (excl. ${ownerContractors.length} owner${ownerContractors.length > 1 ? 's' : ''})`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned Cost</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${benchCost > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${benchCost > 0 ? 'text-destructive' : ''}`}>
                {fmt(benchCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {benchContractors.length} contractor{benchContractors.length !== 1 ? 's' : ''} on bench
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fully Utilized</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {operationalContractors.length > 0
                  ? `${((fullyUtilized.length / operationalContractors.length) * 100).toFixed(0)}%`
                  : '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                {fullyUtilized.length} of {operationalContractors.length} at 100%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Engagement Type Breakdown */}
        {Object.keys(engagementCounts).length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Object.entries(engagementCounts).map(([type, count]) => (
              <div key={type} className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {ENGAGEMENT_LABELS[type] || type}
                </p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(engagementCost[type] || 0)}/mo
                </p>
              </div>
            ))}
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Utilization</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contractors.map((contractor) => (
              <ContractorTableRow key={contractor.id} contractor={contractor} clients={clientOptions} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  } catch (error) {
    console.error('[contractors] Page render error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Contractors</h1>
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error loading contractors</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    );
  }
}
