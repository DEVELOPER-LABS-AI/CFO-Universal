'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  removeAgencyStaff,
  removeAgencyBonus,
  removeAgencyReimbursement,
} from '@/app/actions/agency-portal-actions';
import { AddStaffModal } from '@/components/agency-portal/AddStaffModal';
import { EditStaffModal } from '@/components/agency-portal/EditStaffModal';
import { AddBonusModal } from '@/components/agency-portal/AddBonusModal';
import { AddReimbursementPortalModal } from '@/components/agency-portal/AddReimbursementPortalModal';
import { Trash2, Pencil, Plus, Gift, Receipt } from 'lucide-react';

/** Shape of a staff member returned by getAgencyStaff. */
interface StaffMember {
  id: string;
  name: string;
  staff_type: string;
  rate: unknown;
  rate_type: string;
  engagement_type: string;
}

/** Shape of a bonus returned by getAgencyBonuses. */
interface Bonus {
  id: string;
  staff_id: string;
  bonus_type: string;
  amount: unknown;
  description: string | null;
  month: number;
  year: number;
  is_paid: boolean;
  staff: {
    id: string;
    name: string;
    staff_type: string;
  };
}

/** Shape of a reimbursement returned by getAgencyReimbursements. */
interface Reimbursement {
  id: string;
  staff_id: string;
  reimbursement_type: string;
  amount: unknown;
  description: string | null;
  month: number;
  year: number;
  is_approved: boolean;
  is_paid: boolean;
  staff: {
    id: string;
    name: string;
    staff_type: string;
  };
}

interface StaffPageContentProps {
  staff: StaffMember[];
  bonuses: Bonus[];
  reimbursements: Reimbursement[];
}

/**
 * Client component that renders the staff table and bonus section
 * with full CRUD capabilities via server actions.
 */
export function StaffPageContent({ staff, bonuses, reimbursements }: StaffPageContentProps) {
  const router = useRouter();
  const [removingStaffId, setRemovingStaffId] = useState<string | null>(null);
  const [removingBonusId, setRemovingBonusId] = useState<string | null>(null);
  const [removingReimbursementId, setRemovingReimbursementId] = useState<string | null>(null);

  const now = new Date();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();

  /**
   * Handles removing a staff member with confirmation.
   */
  async function handleRemoveStaff(staffId: string, staffName: string) {
    if (!confirm(`Are you sure you want to remove ${staffName}?`)) return;

    setRemovingStaffId(staffId);
    try {
      await removeAgencyStaff(staffId);
      toast.success(`${staffName} has been removed`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove staff member'
      );
    } finally {
      setRemovingStaffId(null);
    }
  }

  /**
   * Handles removing a bonus with confirmation.
   */
  async function handleRemoveBonus(bonusId: string) {
    if (!confirm('Are you sure you want to remove this bonus?')) return;

    setRemovingBonusId(bonusId);
    try {
      await removeAgencyBonus(bonusId);
      toast.success('Bonus has been removed');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove bonus'
      );
    } finally {
      setRemovingBonusId(null);
    }
  }

  /**
   * Handles removing a reimbursement with confirmation.
   */
  async function handleRemoveReimbursement(reimbursementId: string) {
    if (!confirm('Are you sure you want to remove this reimbursement?')) return;

    setRemovingReimbursementId(reimbursementId);
    try {
      await removeAgencyReimbursement(reimbursementId);
      toast.success('Reimbursement has been removed');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove reimbursement'
      );
    } finally {
      setRemovingReimbursementId(null);
    }
  }

  /**
   * Format a currency value for display.
   */
  function formatCurrency(amount: unknown): string {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-8">
      {/* Staff Table Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Staff Members</h2>
          <div className="flex items-center gap-2">
            <AddReimbursementPortalModal
              trigger={
                <Button variant="outline" size="sm">
                  <Receipt className="h-4 w-4 mr-2" />
                  Add Reimbursement
                </Button>
              }
              staffList={staff.map((s) => ({ id: s.id, name: s.name }))}
            />
            <AddBonusModal
              trigger={
                <Button variant="outline" size="sm">
                  <Gift className="h-4 w-4 mr-2" />
                  Add Bonus
                </Button>
              }
              staffList={staff.map((s) => ({ id: s.id, name: s.name }))}
            />
            <AddStaffModal
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              }
            />
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No staff members yet. Add your first staff member to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.staff_type ?? '-'}</TableCell>
                  <TableCell>
                    {member.rate != null ? formatCurrency(member.rate as number) : '-'}
                  </TableCell>
                  <TableCell>{member.rate_type ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <EditStaffModal
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                        staff={{
                          id: member.id,
                          name: member.name,
                          staff_type: member.staff_type ?? '',
                          rate: Number(member.rate ?? 0),
                          rate_type: member.rate_type ?? 'HOURLY',
                          engagement_type: member.engagement_type ?? 'AGENCY',
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removingStaffId === member.id}
                        onClick={() => handleRemoveStaff(member.id, member.name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Current Month Bonuses Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {currentMonthName} {currentYear} Bonuses
          </h2>
        </div>

        {bonuses.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No bonuses recorded for this month.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonuses.map((bonus) => (
                <TableRow key={bonus.id}>
                  <TableCell className="font-medium">
                    {bonus.staff.name}
                  </TableCell>
                  <TableCell>{bonus.bonus_type}</TableCell>
                  <TableCell>{formatCurrency(bonus.amount)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {bonus.description ?? '-'}
                  </TableCell>
                  <TableCell>
                    {bonus.is_paid ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={bonus.is_paid || removingBonusId === bonus.id}
                      onClick={() => handleRemoveBonus(bonus.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Current Month Reimbursements Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {currentMonthName} {currentYear} Reimbursements
          </h2>
        </div>

        {reimbursements.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No reimbursements recorded for this month.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reimbursements.map((reimbursement) => (
                <TableRow key={reimbursement.id}>
                  <TableCell className="font-medium">
                    {reimbursement.staff.name}
                  </TableCell>
                  <TableCell>{reimbursement.reimbursement_type.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{formatCurrency(reimbursement.amount)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {reimbursement.description ?? '-'}
                  </TableCell>
                  <TableCell>
                    {reimbursement.is_paid ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        Paid
                      </span>
                    ) : reimbursement.is_approved ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={reimbursement.is_paid || removingReimbursementId === reimbursement.id}
                      onClick={() => handleRemoveReimbursement(reimbursement.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
