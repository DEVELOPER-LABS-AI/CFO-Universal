/**
 * Utilization target resolution and alert level determination for Feature 16.
 * Resolves the effective target for a staff member and determines alert status.
 */

// System fallback values when no UtilizationTarget is configured
export const SYSTEM_FALLBACK = {
  target_rate: 80,
  warning_threshold: 70,
  critical_threshold: 50,
  standard_daily_hours: 8,
  source: 'system_fallback' as const,
};

export type TargetSource = 'staff_type_override' | 'organization_default' | 'system_fallback';
export type AlertLevel = 'WARNING' | 'CRITICAL' | null;

export interface EffectiveTarget {
  target_rate: number;
  warning_threshold: number;
  critical_threshold: number;
  standard_daily_hours: number;
  source: TargetSource;
}

/**
 * Resolve the effective utilization target for a staff member.
 * Priority: staff_type-specific override > organization default > system fallback.
 *
 * @param targets - All active targets for the organization (pre-fetched)
 * @param staffType - The staff member's staff_type string
 * @returns The applicable target configuration
 */
export function resolveEffectiveTarget(
  targets: Array<{
    staff_type: string | null;
    target_rate: number;
    warning_threshold: number;
    critical_threshold: number;
    standard_daily_hours: number;
    enabled: boolean;
  }>,
  staffType: string
): EffectiveTarget {
  // Filter to enabled targets only
  const enabledTargets = targets.filter(t => t.enabled);

  // 1. Look for staff_type-specific override
  const staffTypeOverride = enabledTargets.find(
    t => t.staff_type !== null && t.staff_type === staffType
  );
  if (staffTypeOverride) {
    return {
      target_rate: Number(staffTypeOverride.target_rate),
      warning_threshold: Number(staffTypeOverride.warning_threshold),
      critical_threshold: Number(staffTypeOverride.critical_threshold),
      standard_daily_hours: Number(staffTypeOverride.standard_daily_hours),
      source: 'staff_type_override',
    };
  }

  // 2. Look for organization default (staff_type is null)
  const orgDefault = enabledTargets.find(t => t.staff_type === null);
  if (orgDefault) {
    return {
      target_rate: Number(orgDefault.target_rate),
      warning_threshold: Number(orgDefault.warning_threshold),
      critical_threshold: Number(orgDefault.critical_threshold),
      standard_daily_hours: Number(orgDefault.standard_daily_hours),
      source: 'organization_default',
    };
  }

  // 3. System fallback
  return { ...SYSTEM_FALLBACK };
}

/**
 * Determine the alert level for a given utilization rate against a target.
 * Returns null if utilization is at or above the warning threshold (on target).
 */
export function determineAlertLevel(
  utilizationRate: number,
  target: { warning_threshold: number; critical_threshold: number }
): AlertLevel {
  if (utilizationRate < Number(target.critical_threshold)) {
    return 'CRITICAL';
  }
  if (utilizationRate < Number(target.warning_threshold)) {
    return 'WARNING';
  }
  return null; // On target
}

/**
 * Determine the display status for a utilization rate.
 * Used for UI color coding: green (on_target), yellow (warning), red (critical).
 */
export function determineUtilizationStatus(
  utilizationRate: number,
  target: { warning_threshold: number; critical_threshold: number }
): 'on_target' | 'warning' | 'critical' {
  const alertLevel = determineAlertLevel(utilizationRate, target);
  if (alertLevel === 'CRITICAL') return 'critical';
  if (alertLevel === 'WARNING') return 'warning';
  return 'on_target';
}

/**
 * Check if an alert should be generated based on the current and previous alert levels.
 * Implements deduplication: only alerts on initial breach or worsening.
 *
 * @param currentLevel - The alert level from the current snapshot
 * @param previousLevel - The alert level from the previous snapshot (null if none)
 * @returns Whether a new alert notification should be created
 */
export function shouldGenerateAlert(
  currentLevel: AlertLevel,
  previousLevel: AlertLevel
): boolean {
  // No alert if currently on target
  if (currentLevel === null) return false;

  // Alert on initial breach (no previous snapshot or was on target)
  if (previousLevel === null) return true;

  // Alert on worsening (WARNING -> CRITICAL)
  if (currentLevel === 'CRITICAL' && previousLevel === 'WARNING') return true;

  // Don't alert on same level (already notified) or improvement (CRITICAL -> WARNING)
  return false;
}
