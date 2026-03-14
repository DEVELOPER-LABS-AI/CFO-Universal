'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { recordEquityTransaction } from '@/app/actions/cap-table';

/** Supported equity transaction types. */
type TransactionType = 'GRANT' | 'TRANSFER' | 'PURCHASE' | 'CANCELLATION';

/**
 * Props for the RecordTransactionModal component.
 */
interface RecordTransactionModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to control dialog open state. */
  onOpenChange: (open: boolean) => void;
  /** Available share classes to select from. */
  shareClasses: Array<{ id: string; name: string }>;
  /** Available stakeholders to select from. */
  stakeholders: Array<{ id: string; name: string }>;
}

/**
 * Modal component for recording an equity transaction (Grant, Transfer, Purchase, Cancellation).
 * Conditionally shows from/to stakeholder fields based on the selected transaction type.
 */
export function RecordTransactionModal({
  open,
  onOpenChange,
  shareClasses,
  stakeholders,
}: RecordTransactionModalProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [transactionType, setTransactionType] = useState<TransactionType | ''>('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [shareClassId, setShareClassId] = useState('');
  const [fromStakeholderId, setFromStakeholderId] = useState('');
  const [toStakeholderId, setToStakeholderId] = useState('');
  const [sharesAffected, setSharesAffected] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [notes, setNotes] = useState('');

  /**
   * Resets all form fields to their default values.
   */
  function resetForm() {
    setTransactionType('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setShareClassId('');
    setFromStakeholderId('');
    setToStakeholderId('');
    setSharesAffected('');
    setPricePerShare('');
    setNotes('');
  }

  /**
   * Handles dialog open state changes. Resets the form when the dialog closes.
   */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  /** Whether the "From Stakeholder" field should be shown for the current transaction type. */
  const showFrom = transactionType === 'TRANSFER' || transactionType === 'CANCELLATION';

  /** Whether the "To Stakeholder" field should be shown for the current transaction type. */
  const showTo =
    transactionType === 'GRANT' ||
    transactionType === 'TRANSFER' ||
    transactionType === 'PURCHASE';

  /**
   * Returns true if the form has all required fields filled correctly.
   */
  function isFormValid(): boolean {
    if (!transactionType) return false;
    if (!transactionDate) return false;
    if (!shareClassId) return false;
    if (!sharesAffected || parseInt(sharesAffected, 10) <= 0) return false;
    if (showFrom && !fromStakeholderId) return false;
    if (showTo && !toStakeholderId) return false;
    return true;
  }

  /**
   * Submits the transaction form by calling the recordEquityTransaction server action.
   */
  function handleSubmit() {
    if (!isFormValid()) return;

    startTransition(async () => {
      try {
        await recordEquityTransaction({
          transaction_type: transactionType,
          transaction_date: transactionDate,
          share_class_id: shareClassId,
          from_stakeholder_id: showFrom ? fromStakeholderId : undefined,
          to_stakeholder_id: showTo ? toStakeholderId : undefined,
          shares_affected: parseInt(sharesAffected, 10),
          price_per_share: pricePerShare ? parseFloat(pricePerShare) : undefined,
          notes: notes || undefined,
        });

        toast.success('Transaction recorded successfully');
        handleOpenChange(false);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to record transaction';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record Equity Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transaction-type">Transaction Type</Label>
            <Select
              value={transactionType}
              onValueChange={(value) => {
                setTransactionType(value as TransactionType);
                setFromStakeholderId('');
                setToStakeholderId('');
              }}
            >
              <SelectTrigger id="transaction-type">
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GRANT">Grant</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="PURCHASE">Purchase</SelectItem>
                <SelectItem value="CANCELLATION">Cancellation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transaction-date">Transaction Date</Label>
            <Input
              id="transaction-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          {/* Share Class */}
          <div className="space-y-2">
            <Label htmlFor="share-class">Share Class</Label>
            <Select value={shareClassId} onValueChange={setShareClassId}>
              <SelectTrigger id="share-class">
                <SelectValue placeholder="Select share class" />
              </SelectTrigger>
              <SelectContent>
                {shareClasses.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Stakeholder (Transfer, Cancellation) */}
          {showFrom && (
            <div className="space-y-2">
              <Label htmlFor="from-stakeholder">From Stakeholder</Label>
              <Select
                value={fromStakeholderId}
                onValueChange={setFromStakeholderId}
              >
                <SelectTrigger id="from-stakeholder">
                  <SelectValue placeholder="Select source stakeholder" />
                </SelectTrigger>
                <SelectContent>
                  {stakeholders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* To Stakeholder (Grant, Transfer, Purchase) */}
          {showTo && (
            <div className="space-y-2">
              <Label htmlFor="to-stakeholder">To Stakeholder</Label>
              <Select
                value={toStakeholderId}
                onValueChange={setToStakeholderId}
              >
                <SelectTrigger id="to-stakeholder">
                  <SelectValue placeholder="Select recipient stakeholder" />
                </SelectTrigger>
                <SelectContent>
                  {stakeholders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shares Affected */}
          <div className="space-y-2">
            <Label htmlFor="shares-affected">Shares Affected</Label>
            <Input
              id="shares-affected"
              type="number"
              min={1}
              step={1}
              placeholder="Enter number of shares"
              value={sharesAffected}
              onChange={(e) => setSharesAffected(e.target.value)}
            />
          </div>

          {/* Price Per Share (optional) */}
          <div className="space-y-2">
            <Label htmlFor="price-per-share">Price Per Share (optional)</Label>
            <Input
              id="price-per-share"
              type="number"
              min={0}
              step="0.01"
              placeholder="Enter price per share"
              value={pricePerShare}
              onChange={(e) => setPricePerShare(e.target.value)}
            />
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="transaction-notes">Notes (optional)</Label>
            <Textarea
              id="transaction-notes"
              placeholder="Optional notes about this transaction"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || isPending}
          >
            {isPending ? 'Recording...' : 'Record Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
