/**
 * Margin goal resolution logic.
 *
 * Hierarchy: client custom_margin_target -> FinancialTarget GLOBAL -> default 25%.
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_MARGIN_TARGET = 25;

/**
 * Get the company-wide margin target for an organization.
 * Falls back to 25% if no FinancialTarget with scope=GLOBAL exists.
 */
export async function getCompanyMarginTarget(
  organizationId: string
): Promise<number> {
  const globalTarget = await prisma.financialTarget.findFirst({
    where: {
      organization_id: organizationId,
      scope: 'GLOBAL',
    },
    orderBy: { created_at: 'desc' },
    select: { target_margin: true },
  });

  return globalTarget ? Number(globalTarget.target_margin) : DEFAULT_MARGIN_TARGET;
}

/**
 * Get the effective margin target for a specific client.
 *
 * Resolution order:
 *   1. Client.custom_margin_target (if set)
 *   2. FinancialTarget with scope=GLOBAL
 *   3. Default 25%
 */
export async function getEffectiveMarginTarget(
  organizationId: string,
  clientId?: string
): Promise<number> {
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { custom_margin_target: true },
    });

    if (client?.custom_margin_target != null) {
      return Number(client.custom_margin_target);
    }
  }

  return getCompanyMarginTarget(organizationId);
}

/**
 * Get effective margin targets for all active clients in an organization.
 * Returns a map of clientId -> effective target percentage.
 */
export async function getAllClientMarginTargets(
  organizationId: string
): Promise<Map<string, number>> {
  const companyTarget = await getCompanyMarginTarget(organizationId);

  const clients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
      status: 'ACTIVE',
      deleted_at: null,
    },
    select: {
      id: true,
      custom_margin_target: true,
    },
  });

  const targets = new Map<string, number>();
  for (const client of clients) {
    targets.set(
      client.id,
      client.custom_margin_target != null
        ? Number(client.custom_margin_target)
        : companyTarget
    );
  }

  return targets;
}
