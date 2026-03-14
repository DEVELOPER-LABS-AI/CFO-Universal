'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  createAllocation,
  getAvailableAllocationPercentage,
} from '@/app/actions/project-allocation';

/**
 * Props for the AddAllocationModal component.
 */
interface AddAllocationModalProps {
  /** The project ID to create the allocation for. */
  projectId: string;
  /** The trigger element that opens the modal. */
  trigger: React.ReactNode;
  /** List of staff members available for allocation. */
  staffList: Array<{ id: string; name: string }>;
  /** List of contractors available for allocation. */
  contractorList: Array<{ id: string; name: string }>;
  /** List of subscriptions available for allocation. */
  subscriptionList: Array<{ id: string; name: string }>;
}

type CostSourceType = 'STAFF' | 'CONTRACTOR' | 'SUBSCRIPTION' | 'OTHER';

/**
 * Modal component for adding a cost allocation to a project.
 * Provides a multi-step flow: select source type, pick source, set allocation percentage.
 */
export function AddAllocationModal({
  projectId,
  trigger,
  staffList,
  contractorList,
  subscriptionList,
}: AddAllocationModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [sourceType, setSourceType] = useState<CostSourceType>('STAFF');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  const [percentage, setPercentage] = useState<number | ''>('');
  const [fixedAmount, setFixedAmount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Available percentage state
  const [availablePercentage, setAvailablePercentage] = useState<number | null>(
    null
  );
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  /**
   * Resets the entire form to its default state.
   */
  function resetForm() {
    setSourceType('STAFF');
    setSelectedSourceId('');
    setOtherDescription('');
    setPercentage('');
    setFixedAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setAvailablePercentage(null);
    setLoadingAvailable(false);
    setSubmitting(false);
  }

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  // Reset selected source and available percentage when source type changes
  useEffect(() => {
    setSelectedSourceId('');
    setOtherDescription('');
    setAvailablePercentage(null);
  }, [sourceType]);

  // Fetch available allocation percentage when a source is selected
  useEffect(() => {
    if (!selectedSourceId || sourceType === 'OTHER') {
      setAvailablePercentage(null);
      return;
    }

    let cancelled = false;

    async function fetchAvailable() {
      setLoadingAvailable(true);
      try {
        const result = await getAvailableAllocationPercentage(
          sourceType,
          selectedSourceId
        );
        if (!cancelled) {
          setAvailablePercentage(result.available);
        }
      } catch {
        if (!cancelled) {
          setAvailablePercentage(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingAvailable(false);
        }
      }
    }

    fetchAvailable();

    return () => {
      cancelled = true;
    };
  }, [sourceType, selectedSourceId]);

  /**
   * Returns the list of sources for the currently selected source type.
   */
  function getSourceList(): Array<{ id: string; name: string }> {
    switch (sourceType) {
      case 'STAFF':
        return staffList;
      case 'CONTRACTOR':
        return contractorList;
      case 'SUBSCRIPTION':
        return subscriptionList;
      default:
        return [];
    }
  }

  /**
   * Validates form inputs and returns true if the form is ready for submission.
   */
  function isFormValid(): boolean {
    if (sourceType === 'OTHER') {
      if (!otherDescription.trim()) return false;
      if (!fixedAmount || fixedAmount <= 0) return false;
    } else {
      if (!selectedSourceId) return false;
    }

    if (!percentage || percentage < 1 || percentage > 100) return false;
    if (!startDate) return false;

    return true;
  }

  /**
   * Handles form submission by calling the createAllocation server action.
   */
  async function handleSubmit() {
    if (!isFormValid()) return;

    setSubmitting(true);

    try {
      const costSourceId =
        sourceType === 'OTHER' ? projectId : selectedSourceId;

      const result = await createAllocation({
        project_id: projectId,
        cost_source_type: sourceType,
        cost_source_id: costSourceId,
        allocation_percentage: Number(percentage),
        fixed_amount: sourceType === 'OTHER' ? Number(fixedAmount) : undefined,
        effective_start_date: startDate,
        notes: notes || undefined,
      });

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Allocation added successfully' });
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create allocation';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const currentSourceList = getSourceList();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Cost Allocation</DialogTitle>
          <DialogDescription>
            Allocate a cost source to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source Type Selection */}
          <div className="space-y-2">
            <Label>Source Type</Label>
            <Tabs
              value={sourceType}
              onValueChange={(value) => setSourceType(value as CostSourceType)}
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="STAFF">Staff</TabsTrigger>
                <TabsTrigger value="CONTRACTOR">Contractor</TabsTrigger>
                <TabsTrigger value="SUBSCRIPTION">Subscription</TabsTrigger>
                <TabsTrigger value="OTHER">Other</TabsTrigger>
              </TabsList>

              {/* Staff / Contractor / Subscription source picker */}
              <TabsContent value="STAFF" className="mt-3">
                <SourceSelect
                  sources={staffList}
                  value={selectedSourceId}
                  onChange={setSelectedSourceId}
                  placeholder="Select staff member"
                />
              </TabsContent>
              <TabsContent value="CONTRACTOR" className="mt-3">
                <SourceSelect
                  sources={contractorList}
                  value={selectedSourceId}
                  onChange={setSelectedSourceId}
                  placeholder="Select contractor"
                />
              </TabsContent>
              <TabsContent value="SUBSCRIPTION" className="mt-3">
                <SourceSelect
                  sources={subscriptionList}
                  value={selectedSourceId}
                  onChange={setSelectedSourceId}
                  placeholder="Select subscription"
                />
              </TabsContent>

              {/* OTHER type: description text input */}
              <TabsContent value="OTHER" className="mt-3">
                <div className="space-y-2">
                  <Label htmlFor="other-description">Description</Label>
                  <Input
                    id="other-description"
                    placeholder="Describe the cost source"
                    value={otherDescription}
                    onChange={(e) => setOtherDescription(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Available percentage helper text */}
            {sourceType !== 'OTHER' && selectedSourceId && (
              <p className="text-sm text-muted-foreground">
                {loadingAvailable
                  ? 'Loading available percentage...'
                  : availablePercentage !== null
                    ? `${availablePercentage}% available`
                    : ''}
              </p>
            )}
          </div>

          {/* Allocation Percentage */}
          <div className="space-y-2">
            <Label htmlFor="allocation-percentage">Allocation %</Label>
            <Input
              id="allocation-percentage"
              type="number"
              min={1}
              max={100}
              placeholder="Enter percentage (1-100)"
              value={percentage}
              onChange={(e) => {
                const val = e.target.value;
                setPercentage(val === '' ? '' : Number(val));
              }}
            />
          </div>

          {/* Fixed Amount (only for OTHER type) */}
          {sourceType === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="fixed-amount">Fixed Amount</Label>
              <Input
                id="fixed-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter fixed amount"
                value={fixedAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setFixedAmount(val === '' ? '' : Number(val));
                }}
              />
            </div>
          )}

          {/* Effective Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Effective Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="allocation-notes">Notes</Label>
            <Textarea
              id="allocation-notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!isFormValid() || submitting}
          >
            {submitting ? 'Adding...' : 'Add Allocation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Props for the SourceSelect sub-component.
 */
interface SourceSelectProps {
  /** List of sources to display in the dropdown. */
  sources: Array<{ id: string; name: string }>;
  /** Currently selected source ID. */
  value: string;
  /** Callback when a source is selected. */
  onChange: (value: string) => void;
  /** Placeholder text for the select trigger. */
  placeholder: string;
}

/**
 * Reusable select dropdown for picking a cost source (staff, contractor, or subscription).
 */
function SourceSelect({
  sources,
  value,
  onChange,
  placeholder,
}: SourceSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sources.map((source) => (
          <SelectItem key={source.id} value={source.id}>
            {source.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
