'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAgencyMonthlyBreakdown } from '@/app/actions/agency-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

// T119: MonthlyBreakdownForm component with dynamic staff entry
// T120: "Add Staff Member" button to append to breakdown array

interface MonthlyBreakdownFormProps {
  agencyId: string;
  agencyName: string;
  monthlyPayment: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  cost: number;
}

const STAFF_ROLES = ['BDR', 'Admin', 'Manager', 'Designer', 'Developer', 'Marketing Specialist', 'Other'];

const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_YEAR = new Date().getFullYear();

export function MonthlyBreakdownForm({ agencyId, agencyName, monthlyPayment }: MonthlyBreakdownFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);

  // T119: Dynamic staff entry
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([
    { id: '1', name: '', role: 'BDR', cost: 0 },
  ]);

  const breakdownTotal = staffMembers.reduce((sum, member) => sum + member.cost, 0);
  const variance = breakdownTotal - monthlyPayment;
  const variancePercent = (Math.abs(variance) / monthlyPayment) * 100;
  const hasSignificantVariance = Math.abs(variance) > 100 || variancePercent > 10;

  // T120: Add Staff Member button
  const addStaffMember = () => {
    const newId = (staffMembers.length + 1).toString();
    setStaffMembers([...staffMembers, { id: newId, name: '', role: 'BDR', cost: 0 }]);
  };

  const removeStaffMember = (id: string) => {
    if (staffMembers.length === 1) {
      toast.error('Must have at least one staff member');
      return;
    }
    setStaffMembers(staffMembers.filter((member) => member.id !== id));
  };

  const updateStaffMember = (id: string, field: keyof StaffMember, value: string | number) => {
    setStaffMembers(
      staffMembers.map((member) => {
        if (member.id === id) {
          return { ...member, [field]: value };
        }
        return member;
      })
    );
  };

  const distributeEvenly = () => {
    const perMember = monthlyPayment / staffMembers.length;
    setStaffMembers(
      staffMembers.map((member) => ({
        ...member,
        cost: Math.floor(perMember * 100) / 100, // Round to 2 decimal places
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validStaff = staffMembers.filter((member) => member.name.trim() && member.cost > 0);

      if (validStaff.length === 0) {
        toast.error('Please add at least one staff member with name and cost');
        return;
      }

      // Build JSONB breakdown object
      const breakdown = {
        staff: validStaff.map((member) => ({
          name: member.name,
          role: member.role,
          cost: member.cost,
        })),
        notes: `${validStaff.length} staff members for ${month}/${year}`,
      };

      await createAgencyMonthlyBreakdown({
        agency_id: agencyId,
        month,
        year,
        breakdown,
      });

      toast.success(`Monthly breakdown for ${month}/${year} saved successfully`);

      // Reset form
      setStaffMembers([{ id: '1', name: '', role: 'BDR', cost: 0 }]);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to save monthly breakdown');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Breakdown for {agencyName}</CardTitle>
        <CardDescription>
          Record the detailed staff breakdown for this agency's monthly payment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Month/Year Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger id="month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Payment</p>
              <p className="text-lg font-bold">${monthlyPayment.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Breakdown Total</p>
              <p className={`text-lg font-bold ${breakdownTotal === monthlyPayment ? 'text-green-600' : 'text-orange-600'}`}>
                ${breakdownTotal.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variance</p>
              <div className="flex items-center gap-1">
                <p className={`text-lg font-bold ${Math.abs(variance) < 1 ? 'text-green-600' : 'text-orange-600'}`}>
                  {variance >= 0 ? '+' : ''}${variance.toFixed(2)}
                </p>
                {hasSignificantVariance && (
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                )}
              </div>
            </div>
          </div>

          {/* Staff Members */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Staff Members</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={distributeEvenly}>
                  Distribute Evenly
                </Button>
                {/* T120: Add Staff Member button */}
                <Button type="button" variant="outline" size="sm" onClick={addStaffMember}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Staff Member
                </Button>
              </div>
            </div>

            {/* T119: Dynamic staff entry */}
            <div className="space-y-3">
              {staffMembers.map((member, index) => (
                <div key={member.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    {index === 0 && (
                      <Label htmlFor={`name-${member.id}`} className="text-xs mb-1 block">
                        Name
                      </Label>
                    )}
                    <Input
                      id={`name-${member.id}`}
                      placeholder="Staff member name"
                      value={member.name}
                      onChange={(e) => updateStaffMember(member.id, 'name', e.target.value)}
                    />
                  </div>

                  <div className="col-span-3">
                    {index === 0 && (
                      <Label htmlFor={`role-${member.id}`} className="text-xs mb-1 block">
                        Role
                      </Label>
                    )}
                    <Select
                      value={member.role}
                      onValueChange={(v) => updateStaffMember(member.id, 'role', v)}
                    >
                      <SelectTrigger id={`role-${member.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3">
                    {index === 0 && (
                      <Label htmlFor={`cost-${member.id}`} className="text-xs mb-1 block">
                        Cost
                      </Label>
                    )}
                    <Input
                      id={`cost-${member.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={member.cost || ''}
                      onChange={(e) =>
                        updateStaffMember(member.id, 'cost', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="col-span-1 flex items-end">
                    {index === 0 && <div className="h-5" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStaffMember(member.id)}
                      disabled={staffMembers.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Variance Warning */}
          {hasSignificantVariance && (
            <div className="flex items-start gap-2 p-3 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-orange-900 dark:text-orange-200">
                  Significant Variance Detected
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Breakdown is {variance > 0 ? 'over' : 'under'} budget by $
                  {Math.abs(variance).toFixed(2)} ({variancePercent.toFixed(1)}%)
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Breakdown'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
