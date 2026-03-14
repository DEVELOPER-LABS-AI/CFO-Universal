'use client';

import { useState, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  upsertUtilizationTarget,
  updateUtilizationTarget,
} from '@/app/actions/utilization-targets';

/** Shape of an existing utilization target passed in for editing. */
interface ExistingTarget {
  id: string;
  staff_type: string | null;
  target_rate: number;
  warning_threshold: number;
  critical_threshold: number;
  standard_daily_hours: number;
  enabled: boolean;
}

/** Props for the TargetForm component. */
export interface TargetFormProps {
  /** Staff types available to assign (from StaffRole names). */
  availableStaffTypes: string[];
  /** If provided, the form is in edit mode for this target. */
  existingTarget?: ExistingTarget;
  /** Called after a successful save so the parent can refresh / close dialog. */
  onSuccess?: () => void;
}

/** Sentinel value to represent "Organization Default" (null staff_type). */
const ORG_DEFAULT_VALUE = '__ORG_DEFAULT__';

/**
 * Client form component for creating or editing utilization targets.
 * Handles client-side validation and calls the appropriate server action.
 */
export function TargetForm({
  availableStaffTypes,
  existingTarget,
  onSuccess,
}: TargetFormProps) {
  const isEditing = !!existingTarget;

  // Form state
  const [staffType, setStaffType] = useState<string>(
    existingTarget?.staff_type ?? ORG_DEFAULT_VALUE,
  );
  const [targetRate, setTargetRate] = useState<string>(
    String(existingTarget?.target_rate ?? 80),
  );
  const [warningThreshold, setWarningThreshold] = useState<string>(
    String(existingTarget?.warning_threshold ?? 70),
  );
  const [criticalThreshold, setCriticalThreshold] = useState<string>(
    String(existingTarget?.critical_threshold ?? 50),
  );
  const [standardDailyHours, setStandardDailyHours] = useState<string>(
    String(existingTarget?.standard_daily_hours ?? 8),
  );
  const [enabled, setEnabled] = useState<boolean>(
    existingTarget?.enabled ?? true,
  );

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Validate form fields client-side before submitting.
   * Returns true if valid, false if not (and sets error messages).
   */
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    const rate = parseFloat(targetRate);
    const warning = parseFloat(warningThreshold);
    const critical = parseFloat(criticalThreshold);
    const hours = parseFloat(standardDailyHours);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      newErrors.target_rate = 'Target rate must be between 0 and 100';
    }
    if (isNaN(warning) || warning < 0 || warning > 100) {
      newErrors.warning_threshold = 'Warning threshold must be between 0 and 100';
    }
    if (isNaN(critical) || critical < 0 || critical > 100) {
      newErrors.critical_threshold =
        'Critical threshold must be between 0 and 100';
    }
    if (isNaN(hours) || hours < 1 || hours > 24) {
      newErrors.standard_daily_hours = 'Standard daily hours must be between 1 and 24';
    }

    // Cross-field validation
    if (!isNaN(warning) && !isNaN(rate) && warning >= rate) {
      newErrors.warning_threshold =
        'Warning threshold must be less than target rate';
    }
    if (!isNaN(critical) && !isNaN(warning) && critical >= warning) {
      newErrors.critical_threshold =
        'Critical threshold must be less than warning threshold';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [targetRate, warningThreshold, criticalThreshold, standardDailyHours]);

  /**
   * Handle form submission.
   * Calls upsertUtilizationTarget for new targets or updateUtilizationTarget for edits.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const staffTypeValue =
        staffType === ORG_DEFAULT_VALUE ? null : staffType;

      if (isEditing && existingTarget) {
        // Partial update for existing target
        const result = await updateUtilizationTarget(existingTarget.id, {
          staff_type: staffTypeValue,
          target_rate: parseFloat(targetRate),
          warning_threshold: parseFloat(warningThreshold),
          critical_threshold: parseFloat(criticalThreshold),
          standard_daily_hours: parseFloat(standardDailyHours),
          enabled,
        });

        if (!result.success) {
          setSubmitError(result.error);
          return;
        }
      } else {
        // Create/upsert new target
        const result = await upsertUtilizationTarget({
          staff_type: staffTypeValue,
          target_rate: parseFloat(targetRate),
          warning_threshold: parseFloat(warningThreshold),
          critical_threshold: parseFloat(criticalThreshold),
          standard_daily_hours: parseFloat(standardDailyHours),
          enabled,
        });

        if (!result.success) {
          setSubmitError(result.error);
          return;
        }
      }

      onSuccess?.();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Staff Type */}
      <div className="space-y-2">
        <Label htmlFor="staff_type">Staff Type</Label>
        <Select
          value={staffType}
          onValueChange={setStaffType}
          disabled={isEditing && existingTarget?.staff_type === null}
        >
          <SelectTrigger id="staff_type">
            <SelectValue placeholder="Select staff type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ORG_DEFAULT_VALUE}>
              Organization Default
            </SelectItem>
            {availableStaffTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEditing && existingTarget?.staff_type === null && (
          <p className="text-xs text-muted-foreground">
            The organization default target type cannot be changed.
          </p>
        )}
      </div>

      {/* Target Rate */}
      <div className="space-y-2">
        <Label htmlFor="target_rate">Target Rate (%)</Label>
        <Input
          id="target_rate"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={targetRate}
          onChange={(e) => setTargetRate(e.target.value)}
          placeholder="e.g. 80"
        />
        {errors.target_rate && (
          <p className="text-sm text-destructive">{errors.target_rate}</p>
        )}
      </div>

      {/* Warning Threshold */}
      <div className="space-y-2">
        <Label htmlFor="warning_threshold">Warning Threshold (%)</Label>
        <Input
          id="warning_threshold"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={warningThreshold}
          onChange={(e) => setWarningThreshold(e.target.value)}
          placeholder="e.g. 70"
        />
        <p className="text-xs text-muted-foreground">
          Utilization below this triggers a warning alert.
        </p>
        {errors.warning_threshold && (
          <p className="text-sm text-destructive">{errors.warning_threshold}</p>
        )}
      </div>

      {/* Critical Threshold */}
      <div className="space-y-2">
        <Label htmlFor="critical_threshold">Critical Threshold (%)</Label>
        <Input
          id="critical_threshold"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={criticalThreshold}
          onChange={(e) => setCriticalThreshold(e.target.value)}
          placeholder="e.g. 50"
        />
        <p className="text-xs text-muted-foreground">
          Utilization below this triggers a critical alert.
        </p>
        {errors.critical_threshold && (
          <p className="text-sm text-destructive">
            {errors.critical_threshold}
          </p>
        )}
      </div>

      {/* Standard Daily Hours */}
      <div className="space-y-2">
        <Label htmlFor="standard_daily_hours">Standard Daily Hours</Label>
        <Input
          id="standard_daily_hours"
          type="number"
          min={1}
          max={24}
          step={0.5}
          value={standardDailyHours}
          onChange={(e) => setStandardDailyHours(e.target.value)}
          placeholder="e.g. 8"
        />
        <p className="text-xs text-muted-foreground">
          Expected working hours per day for utilization calculations.
        </p>
        {errors.standard_daily_hours && (
          <p className="text-sm text-destructive">
            {errors.standard_daily_hours}
          </p>
        )}
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="enabled">Enabled</Label>
          <p className="text-xs text-muted-foreground">
            When disabled, this target will not be used for utilization alerts.
          </p>
        </div>
        <Switch
          id="enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting
          ? 'Saving...'
          : isEditing
            ? 'Update Target'
            : 'Save Target'}
      </Button>
    </form>
  );
}
