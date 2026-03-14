/**
 * Utilization alert generator for Feature 16 (US5 - Snapshots & Alerts).
 * Creates notification records when staff utilization drops below configured thresholds.
 * Implements deduplication: only alerts on initial breach or worsening (WARNING -> CRITICAL).
 */

import { prisma } from '@/lib/prisma';
import { shouldGenerateAlert } from '@/lib/calculations/utilization-targets';
import type { AlertLevel } from '@/lib/calculations/utilization-targets';

/**
 * Generate alert notifications for snapshots that have breached utilization thresholds.
 * Compares each snapshot's alert_level against the previous snapshot for the same staff
 * member to prevent duplicate alerts.
 *
 * @param params.organizationId - The organization these snapshots belong to
 * @param params.periodStart - Start of the snapshot period (used to find previous snapshots)
 * @param params.periodEnd - End of the snapshot period
 * @param params.snapshots - Array of snapshot summaries with alert levels
 * @returns Count of alert notifications created
 */
export async function generateAlerts(params: {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  snapshots: Array<{
    staff_id: string;
    staff_name: string;
    alert_level: AlertLevel;
    utilization_rate: number;
  }>;
}): Promise<number> {
  const { organizationId, periodStart, snapshots } = params;
  let alertsCreated = 0;

  for (const snapshot of snapshots) {
    // Only process snapshots that have an alert level
    if (snapshot.alert_level === null) {
      continue;
    }

    try {
      // Find the most recent previous snapshot for this staff member
      const previousSnapshot = await prisma.utilizationSnapshot.findFirst({
        where: {
          staff_id: snapshot.staff_id,
          period_start: { lt: periodStart },
        },
        orderBy: { period_start: 'desc' },
        select: { alert_level: true },
      });

      const previousLevel = (previousSnapshot?.alert_level as AlertLevel) ?? null;
      const currentLevel = snapshot.alert_level;

      // Check deduplication rules
      if (!shouldGenerateAlert(currentLevel, previousLevel)) {
        continue;
      }

      // Create the notification
      await prisma.notification.create({
        data: {
          organization_id: organizationId,
          type:
            currentLevel === 'CRITICAL'
              ? 'UTILIZATION_CRITICAL'
              : 'UTILIZATION_WARNING',
          priority: currentLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          status: 'UNREAD',
          title: `Utilization ${currentLevel}: ${snapshot.staff_name}`,
          message: `${snapshot.staff_name} has a utilization rate of ${snapshot.utilization_rate.toFixed(1)}%, which is below the ${currentLevel.toLowerCase()} threshold.`,
          source: 'SYSTEM',
          metadata: {
            staff_id: snapshot.staff_id,
            utilization_rate: snapshot.utilization_rate,
            alert_level: currentLevel,
            period_start: params.periodStart.toISOString(),
            period_end: params.periodEnd.toISOString(),
          },
          related_entity_type: 'staff',
          related_entity_id: snapshot.staff_id,
        },
      });

      alertsCreated++;
    } catch (error) {
      console.error(
        `[alert-generator] Error creating alert for ${snapshot.staff_name} (${snapshot.staff_id}):`,
        error
      );
      // Continue processing other snapshots - don't let one failure stop the batch
    }
  }

  return alertsCreated;
}
