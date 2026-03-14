/**
 * CFO Strategist alert system.
 *
 * Checks margin health and creates notifications when thresholds are breached.
 * Uses the existing Notification model with source='CFO_STRATEGIST'.
 */

import { prisma } from '@/lib/prisma';
import {
  getCompanyMarginTarget,
  getAllClientMarginTargets,
} from '@/lib/cfo-strategist/margin-goals';

/** Creates a CFO Strategist notification if one doesn't already exist (unread, same source + entity). */
async function createAlertIfNew(params: {
  organizationId: string;
  type: 'WARNING' | 'ERROR' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  actionUrl: string;
  relatedEntityType: string;
  relatedEntityId: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      organization_id: params.organizationId,
      source: 'CFO_STRATEGIST',
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
      read_at: null,
    },
    select: { id: true },
  });

  if (existing) return null;

  return prisma.notification.create({
    data: {
      organization_id: params.organizationId,
      type: params.type,
      priority: params.priority ?? 'MEDIUM',
      title: params.title,
      message: params.message,
      source: 'CFO_STRATEGIST',
      action_url: params.actionUrl,
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
    },
  });
}

/**
 * Checks financial health and creates alerts for:
 * 1. Company margin below target
 * 2. 2+ consecutive months of margin decline
 * 3. Per-client margin below their respective target
 */
export async function checkAndCreateAlerts(
  organizationId: string,
  month: number,
  year: number
): Promise<{ alertsCreated: number }> {
  let alertsCreated = 0;

  const [companyTarget, clientTargets, companyMetrics, activeClients] =
    await Promise.all([
      getCompanyMarginTarget(organizationId),
      getAllClientMarginTargets(organizationId),
      prisma.companyMetrics.findMany({
        where: { organization_id: organizationId },
        orderBy: { period_start: 'desc' },
        take: 3,
        select: {
          period_start: true,
          portfolio_margin: true,
        },
      }),
      prisma.client.findMany({
        where: {
          organization_id: organizationId,
          status: 'ACTIVE',
          is_internal: false,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          roi_metrics: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 1,
            select: { margin_percentage: true },
          },
        },
      }),
    ]);

  // -------------------------------------------------------------------------
  // 1. Company margin below target
  // -------------------------------------------------------------------------
  if (companyMetrics.length > 0) {
    const currentMargin = Number(companyMetrics[0].portfolio_margin);
    if (currentMargin < companyTarget) {
      const gap = (companyTarget - currentMargin).toFixed(1);
      const alert = await createAlertIfNew({
        organizationId,
        type: 'WARNING',
        priority: 'HIGH',
        title: 'Company margin below target',
        message: `Current portfolio margin (${currentMargin.toFixed(1)}%) is ${gap}pp below the ${companyTarget.toFixed(1)}% target.`,
        actionUrl: '/dashboard/strategist',
        relatedEntityType: 'company_margin',
        relatedEntityId: `${year}-${month}`,
      });
      if (alert) alertsCreated++;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Two or more consecutive months of margin decline
  // -------------------------------------------------------------------------
  if (companyMetrics.length >= 3) {
    const margins = companyMetrics.map((m) => Number(m.portfolio_margin));
    // margins[0] is most recent, margins[1] is prior, margins[2] is two months ago
    const declining = margins[0] < margins[1] && margins[1] < margins[2];
    if (declining) {
      const totalDrop = (margins[2] - margins[0]).toFixed(1);
      const alert = await createAlertIfNew({
        organizationId,
        type: 'ERROR',
        priority: 'HIGH',
        title: 'Margin declining for 2+ months',
        message: `Portfolio margin has dropped ${totalDrop}pp over the last 3 months (${margins[2].toFixed(1)}% -> ${margins[0].toFixed(1)}%).`,
        actionUrl: '/dashboard/strategist',
        relatedEntityType: 'margin_decline',
        relatedEntityId: `${year}-${month}`,
      });
      if (alert) alertsCreated++;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Per-client margin below target
  // -------------------------------------------------------------------------
  for (const client of activeClients) {
    const latestRoi = client.roi_metrics[0];
    if (!latestRoi) continue;

    const clientMargin = Number(latestRoi.margin_percentage);
    const target = clientTargets.get(client.id) ?? companyTarget;

    if (clientMargin < target) {
      const gap = (target - clientMargin).toFixed(1);
      const alert = await createAlertIfNew({
        organizationId,
        type: 'WARNING',
        title: `${client.name}: margin below target`,
        message: `${client.name}'s margin (${clientMargin.toFixed(1)}%) is ${gap}pp below the ${target.toFixed(1)}% target.`,
        actionUrl: '/dashboard/strategist',
        relatedEntityType: 'client_margin',
        relatedEntityId: client.id,
      });
      if (alert) alertsCreated++;
    }
  }

  return { alertsCreated };
}
