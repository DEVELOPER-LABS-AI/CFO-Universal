'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2 } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import { EditAgencyModal } from './EditAgencyModal';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteAgency } from '@/app/actions/agency-management';

// T117: AgencyTable component

interface Agency {
  id: string;
  name: string;
  merchant_name: string | null;
  monthly_payment: any;
  avg_monthly_spend: number | null;
  mercury_month_count: number;
  mercury_total_spend: number;
  start_date: Date;
  staff: Array<{
    id: string;
    name: string;
    staff_type: string;
    assignments: any[];
  }>;
  breakdowns: Array<{
    id: string;
    month: number;
    year: number;
    breakdown_total: any;
    variance: any;
  }>;
}

interface AgencyTableProps {
  agencies: Agency[];
}

export function AgencyTable({ agencies }: AgencyTableProps) {
  const router = useRouter();

  if (agencies.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="No agencies found"
        description="Add agency partners to track variable monthly breakdowns."
      />
    );
  }

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agency Name</TableHead>
            <TableHead>Avg Monthly Payment</TableHead>
            <TableHead>Staff</TableHead>
            <TableHead>Recent Breakdown</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agencies.map((agency) => {
            const activeStaff = agency.staff.filter((s) =>
              s.assignments.some((a) => !a.end_date)
            );
            const latestBreakdown = agency.breakdowns[0];
            const hasVariance = latestBreakdown && Math.abs(Number(latestBreakdown.variance)) > 100;

            return (
              <TableRow key={agency.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/agencies/${agency.id}`}
                    className="hover:underline font-medium"
                  >
                    {agency.name}
                  </Link>
                </TableCell>
                <TableCell className="font-semibold">
                  {agency.avg_monthly_spend != null ? (
                    <div>
                      <span>${agency.avg_monthly_spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <p className="text-xs text-muted-foreground font-normal">
                        avg over {agency.mercury_month_count} month{agency.mercury_month_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{agency.staff.length} total</span>
                    <p className="text-xs text-muted-foreground">
                      {activeStaff.length} active assignments
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {latestBreakdown ? (
                    <div className="space-y-1">
                      <p className="text-sm">
                        {latestBreakdown.month}/{latestBreakdown.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: ${Number(latestBreakdown.breakdown_total).toFixed(2)}
                      </p>
                      {hasVariance && (
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          Variance: ${Math.abs(Number(latestBreakdown.variance)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No breakdowns yet</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(agency.start_date)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditAgencyModal
                      agency={agency}
                      trigger={
                        <Button variant="ghost" size="icon" title="Edit agency">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DeleteConfirmModal
                      entityName="agency"
                      displayName={agency.name}
                      onConfirm={async () => {
                        await softDeleteAgency(agency.id);
                        router.refresh();
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" title="Delete agency" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
