'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { updateOrganizationSettings } from '@/app/actions/organization-settings';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface CostAllocationSettingsProps {
  includeOwnerPay: boolean;
}

export function CostAllocationSettings({ includeOwnerPay: initial }: CostAllocationSettingsProps) {
  const [includeOwnerPay, setIncludeOwnerPay] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      setIncludeOwnerPay(checked);
      await updateOrganizationSettings({ includeOwnerPay: checked });
      toast.success(
        checked
          ? 'Owner pay will be included in overhead allocation'
          : 'Owner pay excluded from overhead allocation'
      );
    } catch (error: unknown) {
      setIncludeOwnerPay(!checked);
      toast.error(getErrorMessage(error) || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-3 p-4 border rounded-lg">
        <Checkbox
          id="include-owner-pay"
          checked={includeOwnerPay}
          onCheckedChange={(checked) => handleToggle(checked === true)}
          disabled={saving}
        />
        <div className="space-y-1">
          <Label htmlFor="include-owner-pay" className="font-medium cursor-pointer">
            Include Owner Pay in Overhead Allocation
          </Label>
          <p className="text-sm text-muted-foreground">
            When enabled, owner compensation is included when spreading internal/overhead
            costs across active clients. Disable to see operational margins without owner pay.
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Internal client costs (e.g. Developer Labs AI) are distributed across active external
        clients proportionally based on their revenue share. This setting controls whether
        owner salaries are part of that overhead pool. You can also override this per-session
        on the Portfolio page.
      </p>
    </div>
  );
}
