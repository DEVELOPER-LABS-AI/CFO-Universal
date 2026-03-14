'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Calendar, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils/date';
import { endStaffAssignment } from '@/app/actions/staff-management';
import { MonthlyAllocationEditor } from '@/components/staff/MonthlyAllocationEditor';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { useRouter } from 'next/navigation';

// T089: ClientStaffTable component showing staff assigned to client

interface MonthlyOverride {
  id: string;
  month: number;
  year: number;
  allocation_percentage: any;
}

interface StaffAssignment {
  id: string;
  staff_id: string;
  client_id: string;
  assignment_type: 'PROJECT' | 'RETAINER';
  allocation_percentage: any;
  start_date: Date;
  end_date: Date | null;
  staff: {
    id: string;
    name: string;
    staff_type: string;
    rate: any;
    rate_type: string;
    agency_id?: string | null;
  };
  monthly_overrides?: MonthlyOverride[];
}

interface ClientStaffTableProps {
  assignments: StaffAssignment[];
  clientId: string;
  showActive?: boolean;
}

export function ClientStaffTable({ assignments, clientId, showActive = true }: ClientStaffTableProps) {
  const router = useRouter();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endDialogTarget, setEndDialogTarget] = useState<{ id: string; name: string } | null>(null);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredAssignments = showActive
    ? assignments.filter((a) => !a.end_date)
    : assignments.filter((a) => a.end_date);

  const totalAllocation = filteredAssignments.reduce(
    (sum, a) => sum + Number(a.allocation_percentage),
    0
  );

  const openEndDialog = (assignmentId: string, staffName: string) => {
    setEndDialogTarget({ id: assignmentId, name: staffName });
    setEndDate(new Date().toISOString().split('T')[0]);
    setEndDialogOpen(true);
  };

  const handleEndAssignment = async () => {
    if (!endDialogTarget) return;

    setEndingId(endDialogTarget.id);
    setEndDialogOpen(false);
    try {
      await endStaffAssignment({
        assignment_id: endDialogTarget.id,
        end_date: new Date(endDate + 'T00:00:00'),
      });

      toast.success(`Ended assignment for ${endDialogTarget.name}`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to end assignment');
    } finally {
      setEndingId(null);
      setEndDialogTarget(null);
    }
  };

  if (filteredAssignments.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title={showActive ? 'No staff assigned' : 'No past assignments'}
        description={
          showActive
            ? 'This client has no active staff assignments'
            : 'This client has no assignment history'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {showActive && (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div>
            <p className="text-sm text-muted-foreground">Total Staff</p>
            <p className="text-2xl font-bold">{filteredAssignments.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Allocation</p>
            <p className="text-2xl font-bold">{totalAllocation.toFixed(0)}%</p>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assignment</TableHead>
              <TableHead>Allocation %</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Start Date</TableHead>
              {!showActive && <TableHead>End Date</TableHead>}
              {showActive && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map((assignment) => {
              const allocation = Number(assignment.allocation_percentage);
              const rate = Number(assignment.staff.rate);

              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/staff/${assignment.staff_id}`}
                      className="hover:underline font-medium"
                    >
                      {assignment.staff.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{assignment.staff.staff_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={assignment.assignment_type === 'PROJECT'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'}
                    >
                      {assignment.assignment_type === 'PROJECT' ? 'Project' : 'Retainer'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {allocation.toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    ${rate.toFixed(2)}/{assignment.staff.rate_type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(assignment.start_date)}
                  </TableCell>
                  {!showActive && (
                    <TableCell className="text-sm text-muted-foreground">
                      {assignment.end_date ? formatDate(assignment.end_date) : '-'}
                    </TableCell>
                  )}
                  {showActive && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!assignment.staff.agency_id && (
                          <MonthlyAllocationEditor
                            assignmentId={assignment.id}
                            staffName={assignment.staff.name}
                            clientName=""
                            baseAllocation={allocation}
                            overrides={(assignment.monthly_overrides ?? []).map((o) => ({
                              ...o,
                              allocation_percentage: Number(o.allocation_percentage),
                            }))}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEndDialog(assignment.id, assignment.staff.name)}
                          disabled={endingId === assignment.id}
                        >
                          {endingId === assignment.id ? 'Ending...' : 'End'}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filteredAssignments.map((assignment) => {
          const allocation = Number(assignment.allocation_percentage);
          const rate = Number(assignment.staff.rate);

          return (
            <div key={assignment.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/dashboard/staff/${assignment.staff_id}`}
                    className="hover:underline font-medium"
                  >
                    {assignment.staff.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {assignment.staff.staff_type}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${assignment.assignment_type === 'PROJECT'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'}`}
                    >
                      {assignment.assignment_type === 'PROJECT' ? 'Project' : 'Retainer'}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {allocation.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-medium">
                  ${rate.toFixed(2)}/{assignment.staff.rate_type}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(assignment.start_date)}</span>
                </div>
                {assignment.end_date && (
                  <div className="flex items-center gap-1">
                    <span>to</span>
                    <span>{formatDate(assignment.end_date)}</span>
                  </div>
                )}
              </div>

              {showActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openEndDialog(assignment.id, assignment.staff.name)}
                  disabled={endingId === assignment.id}
                >
                  {endingId === assignment.id ? 'Ending...' : 'End Assignment'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* End Assignment Dialog with Date Picker */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>End Assignment</DialogTitle>
            <DialogDescription>
              Set the end date for {endDialogTarget?.name}'s assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use a past date if the assignment ended previously.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndAssignment} disabled={!!endingId}>
              {endingId ? 'Ending...' : 'End Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
