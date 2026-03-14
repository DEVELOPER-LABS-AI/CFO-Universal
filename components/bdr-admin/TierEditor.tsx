'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface TierInput {
  min_threshold: number;
  max_threshold: number | null;
  payout_rate: number;
}

interface TierEditorProps {
  tiers: TierInput[];
  onChange: (tiers: TierInput[]) => void;
}

/**
 * Inline editor for bonus tier configuration.
 * Handles add/remove/reorder of tiers with threshold validation.
 */
export function TierEditor({ tiers, onChange }: TierEditorProps) {
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier ? (lastTier.max_threshold ?? lastTier.min_threshold) + 1 : 1;
    onChange([
      // Set max on the old last tier if it was uncapped
      ...tiers.map((t, i) =>
        i === tiers.length - 1 && t.max_threshold === null
          ? { ...t, max_threshold: newMin - 1 }
          : t
      ),
      { min_threshold: newMin, max_threshold: null, payout_rate: 0 },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    const newTiers = tiers.filter((_, i) => i !== index);
    // Make the last tier uncapped
    if (newTiers.length > 0) {
      newTiers[newTiers.length - 1] = {
        ...newTiers[newTiers.length - 1],
        max_threshold: null,
      };
    }
    onChange(newTiers);
  };

  const updateTier = (index: number, field: keyof TierInput, value: number | null) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };

    // Auto-adjust next tier's min if max changed
    if (field === 'max_threshold' && value !== null && index < newTiers.length - 1) {
      newTiers[index + 1] = { ...newTiers[index + 1], min_threshold: value + 1 };
    }

    onChange(newTiers);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Bonus Tiers</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTier}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 && (
        <p className="text-sm text-muted-foreground">No tiers defined. Add at least one tier.</p>
      )}

      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-end gap-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                min={1}
                value={tier.min_threshold}
                onChange={(e) => updateTier(index, 'min_threshold', parseInt(e.target.value) || 1)}
                className="h-8"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                min={tier.min_threshold}
                value={tier.max_threshold ?? ''}
                placeholder="No limit"
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  updateTier(index, 'max_threshold', val);
                }}
                className="h-8"
                disabled={index === tiers.length - 1} // Last tier is always uncapped
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">$/meeting</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tier.payout_rate}
                onChange={(e) => updateTier(index, 'payout_rate', parseFloat(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeTier(index)}
              disabled={tiers.length <= 1}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {tiers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Last tier is always uncapped (no maximum). Meetings are counted cumulatively across tiers.
        </p>
      )}
    </div>
  );
}
