'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { updateFeeDefaults } from '@/app/actions/payment-settings';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils/error';

const PAYMENT_METHODS = [
  { key: 'CREDIT_CARD', label: 'Credit Card' },
  { key: 'ACH', label: 'ACH' },
  { key: 'DOMESTIC_WIRE', label: 'Wire (Domestic)' },
  { key: 'INTERNATIONAL_WIRE', label: 'Wire (International)' },
  { key: 'CHECK', label: 'Check' },
] as const;

interface PaymentFeeSettingsProps {
  defaults: Record<string, number>;
}

/**
 * Inline-editable fee defaults per payment method.
 */
export function PaymentFeeSettings({ defaults }: PaymentFeeSettingsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const pm of PAYMENT_METHODS) {
      initial[pm.key] = ((defaults[pm.key] ?? 0) * 100).toFixed(2);
    }
    return initial;
  });

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateFeeDefaults(
          PAYMENT_METHODS.map((pm) => ({
            paymentMethod: pm.key as any,
            feePercentage: (parseFloat(values[pm.key]) || 0) / 100,
          }))
        );
        toast({ title: 'Fee defaults updated' });
      } catch (error: unknown) {
        toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {PAYMENT_METHODS.map((pm) => (
          <div key={pm.key} className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium min-w-[160px]">{pm.label}</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="50"
                className="w-24 text-right"
                value={values[pm.key]}
                onChange={(e) => setValues({ ...values, [pm.key]: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={isPending} size="sm">
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Fee Defaults
      </Button>
    </div>
  );
}
