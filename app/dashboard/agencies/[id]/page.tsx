import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgencies } from '@/app/actions/agency-management';
import { getAllInvoices } from '@/app/actions/agency-invoice-actions';
import { EditAgencyModal } from '@/components/agencies/EditAgencyModal';
import { AgencyInvoiceSection } from '@/components/agencies/AgencyInvoiceSection';
import { formatDate } from '@/lib/utils/date';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, TrendingUp } from 'lucide-react';
import { toMonthlyCost } from '@/lib/utils/currency';

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [result, invoices] = await Promise.all([
    getAgencies({ limit: 100 }),
    getAllInvoices({ agency_id: id }),
  ]);

  const agency = result.agencies.find((a) => a.id === id);

  if (!agency) {
    notFound();
  }

  // Find latest approved/paid invoice for header cost display
  const latestCostInvoice = invoices
    .filter((inv) => inv.status === 'APPROVED' || inv.status === 'PAID')
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/agencies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Agencies
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{agency.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {agency.merchant_name && (
              <span>Mercury: <span className="font-medium text-foreground">{agency.merchant_name}</span></span>
            )}
            <span>Since {formatDate(agency.start_date)}</span>
            {latestCostInvoice && (
              <span>
                Latest Invoice:{' '}
                <span className="font-medium text-foreground">
                  ${Number(latestCostInvoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="ml-1">
                  ({new Date(latestCostInvoice.year, latestCostInvoice.month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })})
                </span>
              </span>
            )}
          </div>
        </div>
        <EditAgencyModal
          agency={{ ...agency, markup_value: agency.markup_value != null ? Number(agency.markup_value) : null }}
          trigger={
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Agency
            </Button>
          }
        />
      </div>

      {/* Feature 14: Agency Margin Summary */}
      {(() => {
        const staffWithCost = agency.staff.filter((s: any) => s.true_cost != null && s.deleted_at == null);
        if (staffWithCost.length === 0) return null;
        const totalTrueCost = staffWithCost.reduce((sum: number, s: any) => sum + toMonthlyCost(Number(s.true_cost), s.true_cost_rate_type ?? s.rate_type), 0);
        const totalBilled = staffWithCost.reduce((sum: number, s: any) => sum + toMonthlyCost(Number(s.rate), s.rate_type), 0);
        const totalMargin = totalBilled - totalTrueCost;
        const avgMarginPct = totalTrueCost > 0 ? (totalMargin / totalTrueCost) * 100 : 0;
        return (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total True Cost</CardDescription>
                <CardTitle className="text-2xl">${totalTrueCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">monthly, {staffWithCost.length} staff with cost data</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Billed</CardDescription>
                <CardTitle className="text-2xl">${totalBilled.toLocaleString('en-US', { maximumFractionDigits: 0 })}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">monthly bill rate total</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Margin</CardDescription>
                <CardTitle className={`text-2xl ${totalMargin < 0 ? 'text-red-600' : ''}`}>${totalMargin.toLocaleString('en-US', { maximumFractionDigits: 0 })}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">monthly</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <CardDescription>Avg Margin</CardDescription>
                </div>
                <CardTitle className={`text-2xl ${avgMarginPct < 0 ? 'text-red-600' : ''}`}>{avgMarginPct.toFixed(1)}%</CardTitle>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">weighted average</p></CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Staff</CardTitle>
          <CardDescription>Staff members associated with this agency</CardDescription>
        </CardHeader>
        <CardContent>
          {agency.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No staff members yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>True Cost</TableHead>
                  <TableHead>Bill Rate</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Assignments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agency.staff.map((member: any) => {
                  const activeAssignments = member.assignments.filter((a: any) => !a.end_date);
                  const hasTrueCost = member.true_cost != null;
                  const trueCost = hasTrueCost ? Number(member.true_cost) : null;
                  const billRate = member.rate != null ? Number(member.rate) : null;
                  const rateAbbr = member.rate_type?.toLowerCase() === 'monthly' ? 'mo' : member.rate_type?.toLowerCase() === 'hourly' ? 'hr' : member.rate_type?.toLowerCase() === 'daily' ? 'day' : 'mo';
                  let marginDollar: number | null = null;
                  let marginPct: number | null = null;
                  if (hasTrueCost && billRate != null && trueCost != null) {
                    const monthlyBill = toMonthlyCost(billRate, member.rate_type);
                    const monthlyTrue = toMonthlyCost(trueCost, member.true_cost_rate_type ?? member.rate_type);
                    marginDollar = monthlyBill - monthlyTrue;
                    marginPct = monthlyTrue > 0 ? (marginDollar / monthlyTrue) * 100 : 0;
                  }
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/staff/${member.id}`} className="hover:underline">{member.name}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{member.staff_type.replace(/_/g, ' ').toLowerCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        {hasTrueCost ? (
                          <span>${trueCost!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-muted-foreground">/{rateAbbr}</span></span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {billRate != null && billRate > 0 ? (
                          <span className="font-medium">${billRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-muted-foreground font-normal">/{rateAbbr}</span></span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {marginDollar != null ? (
                          <span className={marginDollar < 0 ? 'text-red-600 font-medium' : ''}>
                            ${marginDollar.toFixed(0)}/mo ({marginPct!.toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {activeAssignments.length > 0 ? (
                          <span className="text-sm">{activeAssignments.length} active</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
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

      {/* Invoices - agencies submit via portal, admin reviews here */}
      <AgencyInvoiceSection invoices={invoices} />
    </div>
  );
}
