'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createStaffAssignment } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AvailableStaff {
  id: string;
  name: string;
  staff_type: string;
  assignments: Array<{
    allocation_percentage: any;
    end_date: Date | null;
  }>;
}

interface AssignStaffToClientModalProps {
  trigger: React.ReactNode;
  clientId: string;
  clientName: string;
  availableStaff: AvailableStaff[];
}

/**
 * Modal to assign a staff member to a specific client (client -> staff direction).
 * Counterpart to AssignBDRModal which works in the staff -> clients direction.
 */
export function AssignStaffToClientModal({
  trigger,
  clientId,
  clientName,
  availableStaff,
}: AssignStaffToClientModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignmentType, setAssignmentType] = useState<'PROJECT' | 'RETAINER'>('RETAINER');
  const [allocationPercentage, setAllocationPercentage] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedStaff = availableStaff.find((s) => s.id === selectedStaffId);
  const currentUtilization = selectedStaff
    ? selectedStaff.assignments
        .filter((a) => !a.end_date)
        .reduce((sum, a) => sum + Number(a.allocation_percentage), 0)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStaffId) {
      toast.error('Please select a staff member');
      return;
    }

    const allocation = parseFloat(allocationPercentage);
    if (!allocation || allocation <= 0 || allocation > 100) {
      toast.error('Allocation must be between 1 and 100');
      return;
    }

    setIsSubmitting(true);
    try {
      await createStaffAssignment({
        staff_id: selectedStaffId,
        client_id: clientId,
        assignment_type: assignmentType,
        allocation_percentage: allocation,
        start_date: new Date(startDate + 'T00:00:00'),
      });

      toast.success(`Assigned ${selectedStaff?.name} to ${clientName}`);
      setOpen(false);
      setSelectedStaffId('');
      setAssignmentType('RETAINER');
      setAllocationPercentage('');
      setStartDate(new Date().toISOString().split('T')[0]);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign Staff to {clientName}</DialogTitle>
            <DialogDescription>
              Select a staff member and set their allocation percentage for this client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Staff Selection */}
            <div className="space-y-2">
              <Label htmlFor="staff-select">Staff Member *</Label>
              {availableStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All staff members are already assigned to this client.
                </p>
              ) : (
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger id="staff-select">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStaff.map((staff) => {
                      const util = staff.assignments
                        .filter((a) => !a.end_date)
                        .reduce((sum, a) => sum + Number(a.allocation_percentage), 0);
                      return (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name} ({staff.staff_type}) - {util}% utilized
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Current Utilization Info */}
            {selectedStaff && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Current utilization:</span>
                <Badge variant={currentUtilization > 100 ? 'destructive' : 'secondary'}>
                  {currentUtilization}%
                </Badge>
              </div>
            )}

            {/* Assignment Type */}
            <div className="space-y-2">
              <Label htmlFor="assignment-type">Assignment Type *</Label>
              <Select
                value={assignmentType}
                onValueChange={(v) => setAssignmentType(v as 'PROJECT' | 'RETAINER')}
              >
                <SelectTrigger id="assignment-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAINER">Retainer</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Retainer = ongoing monthly work. Project = specific deliverable with defined scope.
              </p>
            </div>

            {/* Allocation Percentage */}
            <div className="space-y-2">
              <Label htmlFor="allocation">Allocation Percentage *</Label>
              <Input
                id="allocation"
                type="number"
                min="1"
                max="100"
                step="5"
                placeholder="e.g. 50"
                value={allocationPercentage}
                onChange={(e) => setAllocationPercentage(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Percentage of this staff member's time allocated to {clientName}
              </p>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                When this assignment begins. Use a past date for historical assignments.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedStaffId || availableStaff.length === 0}
            >
              {isSubmitting ? 'Assigning...' : 'Assign Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
