import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { getContractorTrend } from '@/lib/calculations/trend-reporter';
import { ContractorTrendChart } from '@/components/contractors/ContractorTrendChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import { Button } from '@/components/ui/button';
import { getClients } from '@/app/actions/client-management';
import { AssignContractorToClientModal } from '@/components/contractors/AssignContractorToClientModal';
import { EndContractorAssignmentButton } from '@/components/contractors/EndContractorAssignmentButton';
import { ContractorStatusBadge } from '@/components/contractors/ContractorStatusBadge';

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizationId = await getOrganizationId();

  const contractor = await prisma.contractor.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
    include: {
      assignments: {
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { start_date: 'desc' },
      },
    },
  });

  if (!contractor) {
    notFound();
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [trendData, recentExpenses, clientOptions, totalPaidResult] = await Promise.all([
    getContractorTrend(id, currentMonth, currentYear, 6).catch(() => null),
    prisma.expenseRecord.findMany({
      where: { contractor_id: id },
      orderBy: { transaction_date: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        transaction_date: true,
        category: true,
        merchant_name: true,
        description: true,
      },
    }),
    getClients({ limit: 100 }).then((r) => r.clients),
    prisma.expenseRecord.aggregate({
      where: { contractor_id: id },
      _sum: { amount: true },
    }),
  ]);

  const totalPaid = totalPaidResult._sum.amount
    ? Number(totalPaidResult._sum.amount)
    : 0;

  const isInactive = contractor.status === 'INACTIVE';

  const activeAssignments = isInactive
    ? []
    : contractor.assignments.filter(
        (a) => !a.end_date || new Date(a.end_date) >= new Date()
      );

  const currentUtilization = activeAssignments.reduce(
    (sum, a) => sum + a.allocation_percentage,
    0
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/contractors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Contractors
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{contractor.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Rate:{' '}
              <span className="font-medium text-foreground">
                {contractor.rate != null && contractor.rate_type ? `$${Number(contractor.rate).toFixed(2)} / ${contractor.rate_type.toLowerCase()}` : 'Not set'}
              </span>
            </span>
            <ContractorStatusBadge status={contractor.status} />
            {contractor.engagement_type && (
              <Badge variant="outline" className="capitalize">
                {contractor.engagement_type.replace(/_/g, ' ').toLowerCase()}
              </Badge>
            )}
            <Badge variant={currentUtilization > 100 ? 'destructive' : currentUtilization > 0 ? 'default' : 'secondary'}>
              {currentUtilization}% utilized
            </Badge>
            {activeAssignments.length > 0 && (
              <span>
                {activeAssignments.length} active assignment
                {activeAssignments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid (All Time)</CardDescription>
            <CardTitle className="text-2xl">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Sum of all linked expenses since onboarding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Utilization</CardDescription>
            <CardTitle className="text-2xl">{currentUtilization}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''} across clients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost trend chart */}
      {trendData && (
        <ContractorTrendChart
          contractorName={contractor.name}
          history={trendData.history}
          trend={trendData.trend}
          currentPeriod={trendData.currentPeriod}
          priorPeriod={trendData.priorPeriod}
        />
      )}

      {/* Client Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Client Assignments</CardTitle>
            <CardDescription>Clients this contractor is assigned to</CardDescription>
          </div>
          {!isInactive && (
            <AssignContractorToClientModal
              contractorId={contractor.id}
              contractorName={contractor.name}
              currentUtilization={currentUtilization}
              clients={clientOptions.map((c) => ({ id: c.id, name: c.name }))}
              trigger={
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign to Client
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent>
          {contractor.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assignments yet. Assign this contractor to a client to start tracking utilization.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Allocation</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractor.assignments.map((a) => {
                  const isActive = !a.end_date || new Date(a.end_date) >= new Date();
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.client?.name ?? '—'}</TableCell>
                      <TableCell>{a.allocation_percentage}%</TableCell>
                      <TableCell>{formatDate(a.start_date)}</TableCell>
                      <TableCell>{a.end_date ? formatDate(a.end_date) : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {isActive ? 'Active' : 'Ended'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isActive && (
                          <EndContractorAssignmentButton
                            assignmentId={a.id}
                            contractorName={contractor.name}
                            clientName={a.client?.name ?? 'Unknown'}
                          />
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

      {/* Recent expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No expenses linked yet. Link this contractor to a Mercury merchant to start
              tracking costs automatically.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant / Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.transaction_date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.merchant_name ?? expense.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {expense.category.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(expense.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
