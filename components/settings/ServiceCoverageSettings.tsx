'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { updateServiceCoverageSettings } from '@/app/actions/payment-settings';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils/error';

interface ServiceCoverageSettingsProps {
  gracePeriodDays: number;
  warningDays: number;
}

/**
 * Configure service coverage rules: grace period and warning days.
 */
export function ServiceCoverageSettings({ gracePeriodDays, warningDays }: ServiceCoverageSettingsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [grace, setGrace] = useState(String(gracePeriodDays));
  const [warning, setWarning] = useState(String(warningDays));

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateServiceCoverageSettings({
          gracePeriodDays: parseInt(grace) || 30,
          warningDays: parseInt(warning) || 7,
        });
        toast({ title: 'Coverage settings updated' });
      } catch (error: unknown) {
        toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Grace Period (days)</label>
          <p className="text-xs text-muted-foreground mb-2">
            Days after coverage ends before service is suspended
          </p>
          <Input
            type="number"
            min="0"
            max="365"
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Warning Period (days)</label>
          <p className="text-xs text-muted-foreground mb-2">
            Days before coverage ends to send a warning notification
          </p>
          <Input
            type="number"
            min="0"
            max="90"
            value={warning}
            onChange={(e) => setWarning(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={handleSave} disabled={isPending} size="sm">
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Coverage Rules
      </Button>
    </div>
  );
}
