'use client';

import { OvertimeConfigForm } from '@/components/timesheets/overtime-config-form';
import { upsertAgencyOvertimeConfig } from '@/app/actions/agency-portal-actions';

interface AgencySettingsContentProps {
  /** Initial config values fetched server-side. */
  initialConfig: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  };
  /** True when no agency-specific config exists and org defaults are shown. */
  usingOrgDefaults: boolean;
}

/**
 * Client wrapper for the agency portal overtime settings.
 * Calls upsertAgencyOvertimeConfig which auto-scopes to the user's agency.
 */
export function AgencySettingsContent({
  initialConfig,
  usingOrgDefaults,
}: AgencySettingsContentProps) {
  async function handleSave(config: {
    weekly_hours_threshold: number;
    overtime_multiplier: number;
    is_enabled: boolean;
  }) {
    const result = await upsertAgencyOvertimeConfig(config);
    return { success: result.success, error: result.success ? undefined : result.error };
  }

  return (
    <OvertimeConfigForm
      initialConfig={initialConfig}
      onSave={handleSave}
      title="Agency Overtime Rules"
      description="Override organization-wide overtime rules for your agency's staff."
      note={
        usingOrgDefaults
          ? 'Currently using organization defaults. Save to create agency-specific rules.'
          : undefined
      }
    />
  );
}
