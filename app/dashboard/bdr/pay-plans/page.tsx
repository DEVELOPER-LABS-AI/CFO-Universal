'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PayPlanForm } from '@/components/bdr-admin/PayPlanForm';
import { getPayPlans, assignPayPlan, getBDRStaff } from '@/app/actions/bdr-admin-actions';
import { toast } from 'sonner';

interface PayPlan {
  id: string;
  name: string;
  description: string | null;
  baseMetric: string;
  effectiveStart: string;
  effectiveEnd: string | null;
  isActive: boolean;
  tierCount: number;
  assignedBDRCount: number;
  tiers: { minThreshold: number; maxThreshold: number | null; payoutRate: number }[];
  assignedBDRs: { staffId: string; name: string }[];
}

interface BDRStaff {
  id: string;
  name: string;
}

/**
 * Admin page for managing BDR pay plans.
 */
export default function PayPlansPage() {
  const [plans, setPlans] = useState<PayPlan[]>([]);
  const [bdrs, setBdrs] = useState<BDRStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editPlan, setEditPlan] = useState<PayPlan | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ planId: string; planName: string } | null>(null);
  const [selectedBDR, setSelectedBDR] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [plansResult, bdrsResult] = await Promise.all([getPayPlans(), getBDRStaff()]);
    if (plansResult.success) setPlans(plansResult.data);
    if (bdrsResult.success) setBdrs(bdrsResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async () => {
    if (!assignDialog || !selectedBDR) return;
    setIsAssigning(true);

    const result = await assignPayPlan({
      pay_plan_id: assignDialog.planId,
      staff_id: selectedBDR,
      effective_from: new Date().toISOString().split('T')[0],
    });

    if (result.success) {
      toast.success(`Assigned ${result.data.staffName} to ${result.data.planName}`);
      setAssignDialog(null);
      setSelectedBDR('');
      loadData();
    } else {
      toast.error(result.error);
    }
    setIsAssigning(false);
  };

  const formatMetric = (metric: string) =>
    metric === 'MEETINGS_SHOWED' ? 'Meetings Showed' : 'Meetings Booked';

  const formatTiers = (tiers: PayPlan['tiers']) =>
    tiers
      .map((t) => {
        const range = t.maxThreshold !== null ? `${t.minThreshold}-${t.maxThreshold}` : `${t.minThreshold}+`;
        return `${range}: $${t.payoutRate}`;
      })
      .join(' | ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BDR Pay Plans</h1>
          <p className="text-muted-foreground">Configure tiered bonus structures for BDRs</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Pay Plan
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading pay plans...</CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pay plans yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Pay Plans</CardTitle>
            <CardDescription>{plans.length} plan{plans.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Assigned BDRs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        {plan.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {plan.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatMetric(plan.baseMetric)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{formatTiers(plan.tiers)}</div>
                    </TableCell>
                    <TableCell>
                      {plan.assignedBDRs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {plan.assignedBDRs.map((bdr) => (
                            <Badge key={bdr.staffId} variant="secondary" className="text-xs">
                              {bdr.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditPlan(plan)}
                          title="Edit plan"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignDialog({ planId: plan.id, planName: plan.name })}
                          title="Assign BDR"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Form */}
      <PayPlanForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={loadData}
      />
      {editPlan && (
        <PayPlanForm
          key={editPlan.id}
          open={!!editPlan}
          onOpenChange={(open) => !open && setEditPlan(null)}
          onSuccess={loadData}
          editData={editPlan}
        />
      )}

      {/* Assign BDR Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign BDR to Plan</DialogTitle>
            <DialogDescription>
              Assign a BDR to &quot;{assignDialog?.planName}&quot;. This will close any existing active assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select BDR</Label>
              <Select value={selectedBDR} onValueChange={setSelectedBDR}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a BDR..." />
                </SelectTrigger>
                <SelectContent>
                  {bdrs.map((bdr) => (
                    <SelectItem key={bdr.id} value={bdr.id}>
                      {bdr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedBDR || isAssigning}>
              {isAssigning ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
