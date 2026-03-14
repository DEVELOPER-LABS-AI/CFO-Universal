'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateAnalyzerThresholds } from '@/app/actions/cfo-strategist';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import type { ThresholdConfig } from '@/lib/cfo-strategist/types';

interface ThresholdSettingsProps {
  thresholds: ThresholdConfig;
  defaults: ThresholdConfig;
}

const THRESHOLD_FIELDS: Array<{
  key: keyof ThresholdConfig;
  label: string;
  description: string;
  unit: string;
  step: number;
}> = [
  {
    key: 'subscription_allocation_pct',
    label: 'Subscription Allocation Threshold',
    description: 'Subscriptions below this % of cost allocated are flagged as potential waste.',
    unit: '%',
    step: 1,
  },
  {
    key: 'subscription_cost_increase_pct',
    label: 'Subscription Cost Increase Threshold',
    description: 'MoM cost increases above this % trigger a recommendation.',
    unit: '%',
    step: 1,
  },
  {
    key: 'staffing_utilization_min_assignments',
    label: 'Staffing Utilization Threshold',
    description: 'Staff with fewer active client assignments than this are flagged as low utilization.',
    unit: 'assignments',
    step: 1,
  },
  {
    key: 'staffing_cost_ratio_multiplier',
    label: 'Cost-to-Revenue Outlier Multiplier',
    description: 'Staff whose cost-to-revenue ratio exceeds the company average by this multiplier are flagged.',
    unit: 'x',
    step: 0.1,
  },
  {
    key: 'revenue_margin_gap_pts',
    label: 'Revenue Margin Gap Threshold',
    description: 'Clients whose margin falls below target by more than this many percentage points are flagged.',
    unit: 'pts',
    step: 1,
  },
  {
    key: 'revenue_decline_months',
    label: 'Revenue Decline Duration',
    description: 'Consecutive months of declining revenue before a recommendation is generated.',
    unit: 'months',
    step: 1,
  },
];

export function ThresholdSettings({ thresholds: initial, defaults }: ThresholdSettingsProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      THRESHOLD_FIELDS.map((f) => [f.key, String(initial[f.key])])
    )
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<ThresholdConfig> = {};
      for (const field of THRESHOLD_FIELDS) {
        const parsed = parseFloat(values[field.key]);
        if (!isNaN(parsed)) {
          (updates as Record<string, number>)[field.key] = parsed;
        }
      }

      const result = await updateAnalyzerThresholds(updates);
      if (result.success) {
        toast.success('Analyzer thresholds updated');
      } else {
        toast.error(result.error || 'Failed to update thresholds');
      }
    } catch {
      toast.error('Failed to update thresholds');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {THRESHOLD_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={field.key}
                type="number"
                step={field.step}
                value={values[field.key]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={String(defaults[field.key])}
                className="w-28 h-8"
              />
              <span className="text-xs text-muted-foreground">{field.unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">{field.description}</p>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Save Thresholds
      </Button>
    </div>
  );
}
