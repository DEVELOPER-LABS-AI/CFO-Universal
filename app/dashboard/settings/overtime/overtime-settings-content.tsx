'use client';

import { OvertimeConfigForm } from '@/components/timesheets/overtime-config-form';
import { upsertOvertimeConfig } from '@/app/actions/timesheet-admin-actions';

interface OvertimeSettingsContentProps {
  /** Initial config values fetched server-side. */
  initialConfig: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  };
}

/**
 * Client wrapper for the platform admin overtime settings.
 * Calls the org-level upsertOvertimeConfig (no agency_id).
 */
export function OvertimeSettingsContent({ initialConfig }: OvertimeSettingsContentProps) {
  async function handleSave(config: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  }) {
    const result = await upsertOvertimeConfig({
      ...config,
      agency_id: null,
    });
    return { success: result.success, error: result.success ? undefined : result.error };
  }

  return (
    <OvertimeConfigForm
      initialConfig={initialConfig}
      onSave={handleSave}
      title="Organization Overtime Rules"
      description="Set default overtime rules for all staff. Agency admins can override these for their agencies."
    />
  );
}
