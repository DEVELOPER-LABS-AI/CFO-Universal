'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';

/**
 * Get cost allocation settings for the current organization.
 */
export async function getOrganizationSettings() {
  const organizationId = await getOrganizationId();

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { include_owner_pay: true },
  });

  return { includeOwnerPay: org.include_owner_pay };
}

/**
 * Update cost allocation settings for the current organization.
 */
export async function updateOrganizationSettings(data: { includeOwnerPay: boolean }) {
  const organizationId = await getOrganizationId();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { include_owner_pay: data.includeOwnerPay },
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/portfolio');

  return { success: true };
}
