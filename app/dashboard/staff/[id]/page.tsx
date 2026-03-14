import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStaffById } from '@/app/actions/staff-management';
import { getClients } from '@/app/actions/client-management';
import { getAgencies } from '@/app/actions/agency-management';
import { getContractors } from '@/app/actions/contractor-management';
import { getStaffRoles } from '@/app/actions/staff-role-management';
import { formatDate } from '@/lib/utils/date';
import { calculateMargin, getEffectiveMarkup } from '@/lib/calculations/markup-calculations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, UserPlus, UserX, UserCheck, AlertTriangle, DollarSign, Receipt, History, TrendingUp } from 'lucide-react';
import { StaffAssignmentTable } from '@/components/staff/StaffAssignmentTable';
import { AssignBDRModal } from '@/components/staff/AssignBDRModal';
import { EditStaffModal } from '@/components/staff/EditStaffModal';
import { DeleteStaffButton } from '@/components/staff/DeleteStaffButton';
import { TerminateStaffModal } from '@/components/staff/TerminateStaffModal';
import { RehireStaffButton } from '@/components/staff/RehireStaffButton';
import { ProductivityEntryModal } from '@/components/staff/ProductivityEntryModal';
import { AddBonusModal } from '@/components/staff/AddBonusModal';
import { BonusHistoryTable } from '@/components/staff/BonusHistoryTable';
import { AddReimbursementModal } from '@/components/staff/AddReimbursementModal';
import { ReimbursementHistoryTable } from '@/components/staff/ReimbursementHistoryTable';
import { getStaffBonusSummary } from '@/app/actions/bonus-management';
import { getStaffReimbursementSummary } from '@/app/actions/reimbursement-management';
import { getStaffPaymentHistory } from '@/app/actions/staff-management';
import { PaymentHistoryTable } from '@/components/staff/PaymentHistoryTable';

const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  PROJECT: 'Project Based',
};

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [staff, { clients }, { agencies: agenciesRaw }, contractorsRaw, roles] = await Promise.all([
    getStaffById(id),
    getClients({ limit: 100 }),
    getAgencies(),
    getContractors(),
    getStaffRoles(),
  ]);

  if (!staff) {
    notFound();
  }

  // Fetch bonus/reimbursement summaries and payment history after staff confirmed
  const [bonusSummary, reimbursementSummary, paymentHistory] = await Promise.all([
    getStaffBonusSummary(id),
    getStaffReimbursementSummary(id),
    getStaffPaymentHistory(id),
  ]);

  const agencies = agenciesRaw.map((a: any) => ({ id: a.id, name: a.name }));
  const contractors = contractorsRaw.map((c: any) => ({ id: c.id, name: c.name }));
  const roleOptions = roles.map((r: any) => ({ name: r.name, display_name: r.display_name }));

  /** Resolve display name for the staff member's role */
  function getRoleLabel(staffType: string): string {
    const role = roleOptions.find((r) => r.name === staffType);
    return role?.display_name || staffType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const activeAssignments = staff.assignments.filter((a) => !a.end_date);
  const utilization = activeAssignments.reduce(
    (sum, a) => sum + Number(a.allocation_percentage),
    0
  );

  // Filter out clients already actively assigned to this staff member
  const assignedClientIds = new Set(activeAssignments.map((a) => a.client_id));
  const availableClients = clients
    .filter((c) => !assignedClientIds.has(c.id) && c.status === 'ACTIVE')
    .map((c) => ({ id: c.id, name: c.name, status: c.status }));

  const rate = staff.rate != null ? Number(staff.rate) : null;
  const rateDisplay = rate !== null
    ? `$${rate.toFixed(2)}/${staff.rate_type.toLowerCase()}`
    : 'Not set';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/dashboard/staff">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Staff
        </Link>
      </Button>

      {/* Termination Banner */}
      {staff.status === 'TERMINATED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Terminated Staff Member</p>
              <p className="text-sm text-red-700">
                Terminated on {staff.terminated_at ? formatDate(staff.terminated_at) : 'Unknown date'}
                {staff.termination_reason && ` \u2014 ${staff.termination_reason}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{staff.name}</h1>
            {staff.status === 'TERMINATED' && (
              <Badge variant="destructive">Terminated</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {getRoleLabel(staff.staff_type)}
            </Badge>
            {staff.agency && (
              <span className="text-sm text-muted-foreground">
                via{' '}
                <Link href={`/dashboard/agencies/${staff.agency.id}`} className="hover:underline">
                  {staff.agency.name}
                </Link>
              </span>
            )}
            {staff.contractor && (
              <span className="text-sm text-muted-foreground">
                via{' '}
                <Link href={`/dashboard/contractors/${staff.contractor.id}`} className="hover:underline">
                  {staff.contractor.name}
                </Link>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {staff.status === 'ACTIVE' && (
            <>
              <AssignBDRModal
                staffId={staff.id}
                staffName={staff.name}
                currentUtilization={utilization}
                clients={availableClients}
                trigger={
                  <Button variant="outline">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign to Client
                  </Button>
                }
              />
              <TerminateStaffModal
                staffId={staff.id}
                staffName={staff.name}
                activeAssignmentCount={activeAssignments.length}
                trigger={
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    <UserX className="mr-2 h-4 w-4" />
                    Terminate
                  </Button>
                }
              />
            </>
          )}
          {staff.status === 'TERMINATED' && (
            <RehireStaffButton staffId={staff.id} staffName={staff.name} />
          )}
          <EditStaffModal
            staff={staff}
            agencies={agencies}
            contractors={contractors}
            roles={roleOptions}
            trigger={
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            }
          />
          <DeleteStaffButton staffId={staff.id} staffName={staff.name} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Role</CardDescription>
            <CardTitle className="text-2xl">
              {getRoleLabel(staff.staff_type)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {ENGAGEMENT_LABELS[staff.engagement_type] || staff.engagement_type}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate</CardDescription>
            <CardTitle className="text-2xl">{rateDisplay}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cost</CardDescription>
            <CardTitle className="text-2xl">
              ${bonusSummary.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Base: ${bonusSummary.baseCost.toFixed(2)} + Bonuses: ${bonusSummary.totalApproved.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Utilization</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {utilization.toFixed(0)}%
              {utilization > 100 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Over-allocated
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feature 14: Margin Card (agency staff with true cost only) */}
      {staff.agency && staff.true_cost != null && (
        (() => {
          const margin = calculateMargin({
            billRate: Number(staff.rate),
            billRateType: staff.rate_type as 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE',
            trueCost: Number(staff.true_cost),
            trueCostRateType: (staff.true_cost_rate_type ?? staff.rate_type) as 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE',
          });
          const effectiveMarkup = getEffectiveMarkup(
            {
              rate_locked: staff.rate_locked ?? false,
              markup_override_type: staff.markup_override_type,
              markup_override_value: staff.markup_override_value != null ? Number(staff.markup_override_value) : null,
            },
            staff.agency ? {
              markup_type: staff.agency.markup_type,
              markup_value: staff.agency.markup_value != null ? Number(staff.agency.markup_value) : null,
              markup_basis: staff.agency.markup_basis,
            } : null
          );
          const sourceLabel = effectiveMarkup.rateLocked
            ? 'Locked Rate'
            : effectiveMarkup.source === 'staff_override'
              ? 'Staff Override'
              : effectiveMarkup.source === 'agency_default'
                ? 'Agency Default'
                : 'No Markup';
          return (
            <Card className={margin.isNegative ? 'border-red-200' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Monthly Margin
                  </CardDescription>
                  <Badge variant={effectiveMarkup.rateLocked ? 'secondary' : 'outline'} className="text-xs">
                    {sourceLabel}
                  </Badge>
                </div>
                <CardTitle className={`text-2xl ${margin.isNegative ? 'text-red-600' : ''}`}>
                  ${margin.marginDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({margin.marginPercentage.toFixed(1)}%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  True Cost: ${Number(staff.true_cost).toFixed(2)}/{(staff.true_cost_rate_type ?? staff.rate_type).toLowerCase()}
                  {' '}&middot; Bill Rate: ${Number(staff.rate).toFixed(2)}/{staff.rate_type.toLowerCase()}
                </p>
                {margin.isNegative && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Negative margin — bill rate is below true cost
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Active Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Active Client Assignments</CardTitle>
          <CardDescription>Clients this staff member is currently assigned to</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffAssignmentTable
            assignments={staff.assignments}
            staffId={staff.id}
            showActive={true}
          />
        </CardContent>
      </Card>

      {/* Past Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Past Assignments</CardTitle>
          <CardDescription>Historical client assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffAssignmentTable
            assignments={staff.assignments}
            staffId={staff.id}
            showActive={false}
          />
        </CardContent>
      </Card>

      {/* BDR Productivity Metrics (conditional) */}
      {staff.staff_type === 'BDR' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Productivity Metrics</CardTitle>
              <CardDescription>Monthly BDR performance tracking</CardDescription>
            </div>
            <ProductivityEntryModal
              bdrId={staff.id}
              bdrName={staff.name}
              clients={activeAssignments.map((a) => ({ id: a.client.id, name: a.client.name }))}
              trigger={
                <Button size="sm" variant="outline">
                  Log Metrics
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {staff.productivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No productivity data recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {staff.productivity.map((entry: any) => (
                  <div
                    key={`${entry.year}-${entry.month}-${entry.client_id || 'all'}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(entry.year, entry.month - 1).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.client_id ? 'Client-specific' : 'All clients'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.meetings_attended} meetings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bonuses & Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bonuses & Payments</CardTitle>
            <CardDescription>Bonus history and payment tracking</CardDescription>
          </div>
          <AddBonusModal
            staffId={staff.id}
            staffName={staff.name}
            trigger={
              <Button size="sm" variant="outline">
                <DollarSign className="mr-2 h-4 w-4" />
                Add Bonus
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-lg font-semibold text-green-600">
                ${bonusSummary.totalApproved.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Paid Out</p>
              <p className="text-lg font-semibold">
                ${bonusSummary.totalPaid.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-lg font-semibold text-yellow-600">
                ${bonusSummary.totalPending.toFixed(2)}
              </p>
            </div>
          </div>

          <BonusHistoryTable
            bonuses={staff.bonuses}
            staffId={staff.id}
          />
        </CardContent>
      </Card>

      {/* Reimbursements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Reimbursements</CardTitle>
            <CardDescription>Expense reimbursement tracking</CardDescription>
          </div>
          <AddReimbursementModal
            staffId={staff.id}
            staffName={staff.name}
            trigger={
              <Button size="sm" variant="outline">
                <Receipt className="mr-2 h-4 w-4" />
                Add Reimbursement
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-lg font-semibold text-green-600">
                ${reimbursementSummary.totalApproved.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Paid Out</p>
              <p className="text-lg font-semibold">
                ${reimbursementSummary.totalPaid.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-lg font-semibold text-yellow-600">
                ${reimbursementSummary.totalPending.toFixed(2)}
              </p>
            </div>
          </div>

          <ReimbursementHistoryTable
            reimbursements={staff.reimbursements}
            staffId={staff.id}
          />
        </CardContent>
      </Card>

      {/* Payment History (from approved/paid invoices) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Month-by-month payouts from approved agency invoices</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PaymentHistoryTable payments={paymentHistory} />
        </CardContent>
      </Card>
    </div>
  );
}
