'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import type { PaymentMethod } from '@prisma/client';

/**
 * Get fee defaults for the current organization.
 * Returns all payment methods with their configured fee percentage.
 */
export async function getFeeDefaults() {
  const organizationId = await getOrganizationId();

  const defaults = await prisma.paymentMethodFeeDefault.findMany({
    where: { organization_id: organizationId },
    orderBy: { payment_method: 'asc' },
  });

  // Return a complete map with fallback defaults for unconfigured methods
  const defaultFees: Record<string, number> = {
    CREDIT_CARD: 0.03,
    ACH: 0.005,
    DOMESTIC_WIRE: 0,
    INTERNATIONAL_WIRE: 0,
    CHECK: 0,
  };

  for (const d of defaults) {
    defaultFees[d.payment_method] = Number(d.fee_percentage);
  }

  return defaultFees;
}

/**
 * Update fee defaults for the current organization.
 * Upserts each payment method's fee percentage.
 */
export async function updateFeeDefaults(
  data: Array<{ paymentMethod: PaymentMethod; feePercentage: number }>
) {
  const organizationId = await getOrganizationId();

  await prisma.$transaction(
    data.map((d) =>
      prisma.paymentMethodFeeDefault.upsert({
        where: {
          organization_id_payment_method: {
            organization_id: organizationId,
            payment_method: d.paymentMethod,
          },
        },
        create: {
          organization_id: organizationId,
          payment_method: d.paymentMethod,
          fee_percentage: d.feePercentage,
        },
        update: {
          fee_percentage: d.feePercentage,
        },
      })
    )
  );

  revalidatePath('/dashboard/settings');
  return { success: true };
}

/**
 * Get service coverage settings for the current organization.
 */
export async function getServiceCoverageSettings() {
  const organizationId = await getOrganizationId();

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      service_grace_period_days: true,
      service_warning_days: true,
    },
  });

  return {
    gracePeriodDays: org.service_grace_period_days,
    warningDays: org.service_warning_days,
  };
}

/**
 * Update service coverage settings for the current organization.
 */
export async function updateServiceCoverageSettings(data: {
  gracePeriodDays: number;
  warningDays: number;
}) {
  const organizationId = await getOrganizationId();

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      service_grace_period_days: data.gracePeriodDays,
      service_warning_days: data.warningDays,
    },
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

/**
 * Replace all allocations for an existing linked deposit.
 * Deletes old PaymentAllocation rows and creates new ones in a transaction.
 * Validates that allocation sum equals the receipt's net amount (within $0.01).
 */
export async function updateDepositAllocations(
  receiptId: string,
  allocations: { periodMonth: number; periodYear: number; serviceId?: string | null; amount: number; description?: string | null }[]
) {
  const organizationId = await getOrganizationId();

  // Verify receipt belongs to org
  const receipt = await prisma.clientCashReceipt.findFirst({
    where: {
      id: receiptId,
      client: { organization_id: organizationId },
    },
    select: { id: true, amount: true, client_id: true },
  });
  if (!receipt) throw new Error('Receipt not found');

  const netAmount = Number(receipt.amount);
  const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.abs(allocSum - netAmount) > 0.01) {
    throw new Error(`Allocations total ${allocSum.toFixed(2)} but receipt net is ${netAmount.toFixed(2)}`);
  }

  await prisma.$transaction([
    prisma.paymentAllocation.deleteMany({ where: { client_cash_receipt_id: receiptId } }),
    ...allocations.map((a, i) =>
      prisma.paymentAllocation.create({
        data: {
          client_cash_receipt_id: receiptId,
          service_id: a.serviceId || null,
          period_month: a.periodMonth,
          period_year: a.periodYear,
          amount: a.amount,
          description: a.description || null,
          sort_order: i,
        },
      })
    ),
  ]);

  revalidatePath(`/dashboard/clients/${receipt.client_id}`);
  return { success: true, clientId: receipt.client_id };
}

/**
 * Get fee defaults for a specific organization (used by API routes).
 */
export async function getFeeDefaultsForOrg(organizationId: string) {
  const defaults = await prisma.paymentMethodFeeDefault.findMany({
    where: { organization_id: organizationId },
  });

  const defaultFees: Record<string, number> = {
    CREDIT_CARD: 0.03,
    ACH: 0.005,
    DOMESTIC_WIRE: 0,
    INTERNATIONAL_WIRE: 0,
    CHECK: 0,
  };

  for (const d of defaults) {
    defaultFees[d.payment_method] = Number(d.fee_percentage);
  }

  return defaultFees;
}
