'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface OvertimeConfigFormProps {
  /** Current config values to populate the form. */
  initialConfig: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  };
  /** Async save handler. Returns success/error. */
  onSave: (config: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  /** Card title override. */
  title?: string;
  /** Card description override. */
  description?: string;
  /** Optional informational note rendered below the description. */
  note?: string;
}

/**
 * Reusable overtime configuration form.
 * Used by both platform admin (org-level) and agency admin (agency-level) settings.
 */
export function OvertimeConfigForm({
  initialConfig,
  onSave,
  title = 'Overtime Rules',
  description,
  note,
}: OvertimeConfigFormProps) {
  const [threshold, setThreshold] = useState(initialConfig.weekly_hours_threshold);
  const [multiplier, setMultiplier] = useState(initialConfig.overtime_multiplier);
  const [enabled, setEnabled] = useState(initialConfig.is_enabled);
  const [saving, setSaving] = useState(false);

  /** Example rate preview at $100/hr for illustration. */
  const exampleRate = 100;
  const effectiveRate = (exampleRate * multiplier).toFixed(2);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await onSave({
        weekly_hours_threshold: threshold,
        overtime_multiplier: multiplier,
        is_enabled: enabled,
      });

      if (result.success) {
        toast.success('Overtime configuration saved');
      } else {
        toast.error(result.error ?? 'Failed to save overtime configuration');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {note && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{note}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable / Disable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ot-enabled">Enable overtime tracking</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, hours exceeding the weekly threshold are flagged as overtime.
            </p>
          </div>
          <Switch
            id="ot-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Weekly hours threshold */}
        <div className="space-y-2">
          <Label htmlFor="ot-threshold">Weekly hours threshold</Label>
          <Input
            id="ot-threshold"
            type="number"
            min={1}
            max={168}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Hours per week before overtime applies (1 &ndash; 168).
          </p>
        </div>

        {/* Overtime multiplier */}
        <div className="space-y-2">
          <Label htmlFor="ot-multiplier">Overtime multiplier</Label>
          <Input
            id="ot-multiplier"
            type="number"
            min={1.0}
            max={5.0}
            step={0.05}
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Rate multiplier for overtime hours (1.0 &ndash; 5.0).
            {' '}e.g., at ${exampleRate}/hr: overtime = ${effectiveRate}/hr
          </p>
        </div>

        {/* Save */}
        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
