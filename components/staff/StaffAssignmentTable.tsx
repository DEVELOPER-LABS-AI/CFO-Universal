'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import { endStaffAssignment } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { useRouter } from 'next/navigation';

// T088: StaffAssignmentTable component showing assignments per staff

interface StaffAssignment {
  id: string;
  staff_id: string;
  client_id: string;
  assignment_type?: 'PROJECT' | 'RETAINER';
  allocation_percentage: any;
  start_date: Date;
  end_date: Date | null;
  client: {
    id: string;
    name: string;
    status: string;
  };
}

interface StaffAssignmentTableProps {
  assignments: StaffAssignment[];
  staffId: string;
  showActive?: boolean;
}

export function StaffAssignmentTable({ assignments, staffId, showActive = true }: StaffAssignmentTableProps) {
  const router = useRouter();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<{ id: string; clientName: string } | null>(null);

  const filteredAssignments = showActive
    ? assignments.filter((a) => !a.end_date)
    : assignments.filter((a) => a.end_date);

  const handleConfirmEnd = async () => {
    if (!confirmEnd) return;
    const { id, clientName } = confirmEnd;
    setConfirmEnd(null);
    setEndingId(id);
    try {
      await endStaffAssignment({
        assignment_id: id,
        end_date: new Date(),
      });
      toast.success(`Ended assignment to ${clientName}`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to end assignment');
    } finally {
      setEndingId(null);
    }
  };

  if (filteredAssignments.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title={showActive ? 'No active assignments' : 'No past assignments'}
        description={
          showActive
            ? 'This staff member has no active client assignments'
            : 'This staff member has no assignment history'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Allocation %</TableHead>
              <TableHead>Start Date</TableHead>
              {!showActive && <TableHead>End Date</TableHead>}
              <TableHead>Status</TableHead>
              {showActive && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map((assignment) => {
              const allocation = Number(assignment.allocation_percentage);

              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${assignment.client_id}`}
                      className="hover:underline font-medium"
                    >
                      {assignment.client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {assignment.assignment_type && (
                      <Badge
                        variant="secondary"
                        className={assignment.assignment_type === 'PROJECT'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'}
                      >
                        {assignment.assignment_type === 'PROJECT' ? 'Project' : 'Retainer'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {allocation.toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(assignment.start_date)}
                  </TableCell>
                  {!showActive && (
                    <TableCell className="text-sm text-muted-foreground">
                      {assignment.end_date ? formatDate(assignment.end_date) : '-'}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={assignment.client.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {assignment.client.status}
                    </Badge>
                  </TableCell>
                  {showActive && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmEnd({ id: assignment.id, clientName: assignment.client.name })}
                        disabled={endingId === assignment.id}
                      >
                        {endingId === assignment.id ? 'Ending...' : 'End Assignment'}
                      </Button>
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

          return (
            <div key={assignment.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/dashboard/clients/${assignment.client_id}`}
                    className="hover:underline font-medium"
                  >
                    {assignment.client.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    {assignment.assignment_type && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${assignment.assignment_type === 'PROJECT'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'}`}
                      >
                        {assignment.assignment_type === 'PROJECT' ? 'Project' : 'Retainer'}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="font-mono text-xs">
                      {allocation.toFixed(0)}%
                    </Badge>
                    <Badge
                      variant={assignment.client.status === 'ACTIVE' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {assignment.client.status}
                    </Badge>
                  </div>
                </div>
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
                  onClick={() => setConfirmEnd({ id: assignment.id, clientName: assignment.client.name })}
                  disabled={endingId === assignment.id}
                >
                  {endingId === assignment.id ? 'Ending...' : 'End Assignment'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* End Assignment Confirmation Dialog */}
      <Dialog open={!!confirmEnd} onOpenChange={(open) => !open && setConfirmEnd(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End Assignment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to end the assignment to{' '}
            <span className="font-semibold text-foreground">{confirmEnd?.clientName}</span>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmEnd(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmEnd}>
              End Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
