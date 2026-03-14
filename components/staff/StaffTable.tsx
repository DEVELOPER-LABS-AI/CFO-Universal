'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { EditStaffModal } from './EditStaffModal';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteStaff } from '@/app/actions/staff-management';

// T083: StaffTable component showing utilization percentage
// T091: Warning badge if utilization >100%

interface StaffMember {
  id: string;
  name: string;
  staff_type: string;
  rate: any;
  rate_type: string;
  engagement_type: string;
  status?: string;
  terminated_at?: Date | null;
  agency?: { id: string; name: string } | null;
  contractor?: { id: string; name: string } | null;
  assignments: Array<{
    id: string;
    allocation_percentage: any;
    end_date: Date | null;
    client: { id: string; name: string };
  }>;
}

interface StaffTableProps {
  staff: StaffMember[];
  agencies?: Array<{ id: string; name: string }>;
  contractors?: Array<{ id: string; name: string }>;
  roles?: Array<{ name: string; display_name: string }>;
}

function calculateUtilization(assignments: StaffMember['assignments']): number {
  return assignments
    .filter((a) => !a.end_date)
    .reduce((sum, a) => sum + Number(a.allocation_percentage), 0);
}

function formatStaffType(type: string, roles: Array<{ name: string; display_name: string }> = []): string {
  const role = roles.find((r) => r.name === type);
  if (role) return role.display_name;
  // Fallback for roles not yet in config
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StaffTable({ staff, agencies = [], contractors = [], roles = [] }: StaffTableProps) {
  const router = useRouter();
  if (staff.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No staff found"
        description="Add staff members to get started."
      />
    );
  }

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Engagement</TableHead>
            <TableHead>Utilization</TableHead>
            <TableHead>Active Clients</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => {
            const utilization = calculateUtilization(member.assignments);
            const activeClients = member.assignments.filter((a) => !a.end_date);
            const isOverAllocated = utilization > 100;

            const isTerminated = member.status === 'TERMINATED';

            return (
              <TableRow key={member.id} className={isTerminated ? 'opacity-60' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/staff/${member.id}`} className="hover:underline font-medium">
                      {member.name}
                    </Link>
                    {isTerminated && (
                      <Badge variant="destructive" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  {member.agency && (
                    <p className="text-xs text-muted-foreground mt-1">
                      via {member.agency.name}
                    </p>
                  )}
                  {member.contractor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      via {member.contractor.name}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatStaffType(member.staff_type, roles)}</Badge>
                </TableCell>
                <TableCell>
                  ${Number(member.rate).toFixed(2)}/{member.rate_type.toLowerCase()}
                </TableCell>
                <TableCell className="capitalize">
                  {member.engagement_type.replace(/_/g, ' ').toLowerCase()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={isOverAllocated ? 'font-semibold text-destructive' : ''}>
                      {utilization}%
                    </span>
                    {isOverAllocated && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Over
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {activeClients.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None</span>
                    ) : (
                      activeClients.slice(0, 2).map((assignment) => (
                        <Badge key={assignment.id} variant="secondary" className="text-xs">
                          {assignment.client.name} ({Number(assignment.allocation_percentage)}%)
                        </Badge>
                      ))
                    )}
                    {activeClients.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{activeClients.length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <EditStaffModal
                      staff={member}
                      agencies={agencies}
                      contractors={contractors}
                      roles={roles}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DeleteConfirmModal
                      entityName="staff member"
                      displayName={member.name}
                      onConfirm={async () => {
                        await softDeleteStaff(member.id);
                        router.refresh();
                      }}
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
