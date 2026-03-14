'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MerchantLinkModalProps {
  subscriptionId: string;
  subscriptionName: string;
  /** If provided, rendered as the dialog trigger; otherwise caller controls open state */
  trigger?: React.ReactNode;
  /** Called after a successful link so the parent can refresh */
  onSuccess?: (merchantName: string, transactionsLinked: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MerchantLinkModal({
  subscriptionId,
  subscriptionName,
  trigger,
  onSuccess,
}: MerchantLinkModalProps) {
  const [open, setOpen] = useState(false);
  const [merchantName, setMerchantName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    transactionsLinked: number;
    computedPeriodCost: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!merchantName.trim()) {
      toast.error('Enter a merchant name');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch('/api/mercury/merchants/map-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, merchantName: merchantName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'MERCHANT_ALREADY_MAPPED') {
          toast.error('This merchant is already mapped to a subscription');
        } else {
          toast.error(data.message ?? data.error ?? 'Failed to link merchant');
        }
        return;
      }

      setResult({ transactionsLinked: data.transactionsLinked, computedPeriodCost: data.computedPeriodCost });
      toast.success(
        `Linked "${merchantName.trim()}" — ${data.transactionsLinked} historical transaction${data.transactionsLinked !== 1 ? 's' : ''} imported`
      );
      onSuccess?.(merchantName.trim(), data.transactionsLinked);
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setMerchantName('');
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Mercury Merchant</DialogTitle>
          <DialogDescription>
            Link a Mercury merchant name to <span className="font-medium">{subscriptionName}</span>.
            All historical transactions will be imported automatically.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transactions imported</span>
                <Badge variant="default">{result.transactionsLinked}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current period cost</span>
                <span className="font-semibold">${result.computedPeriodCost.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Future syncs will automatically link new transactions from this merchant.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchantName">Mercury Merchant Name</Label>
              <Input
                id="merchantName"
                placeholder="e.g. GitHub, Figma, AWS"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact merchant name as it appears in Mercury transactions.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !merchantName.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Link Merchant
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {result && (
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
