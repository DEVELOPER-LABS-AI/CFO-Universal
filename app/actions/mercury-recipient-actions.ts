'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/helpers';
import { getMercuryClient } from '@/lib/mercury/client-factory';
import { revalidatePath } from 'next/cache';
import {
  linkMercuryRecipientSchema,
  createMercuryRecipientSchema,
} from '@/lib/validations/contractor-invoice';
import type { CreateMercuryRecipientInput } from '@/lib/validations/contractor-invoice';

/**
 * Fetch all Mercury recipients for the current user's organization.
 * Requires admin role.
 */
export async function getMercuryRecipients() {
  try {
    const user = await requireAdmin();

    const userOrg = await prisma.userOrganization.findFirst({
      where: { user_id: user.userId },
      select: { organization_id: true },
    });

    if (!userOrg) {
      return { success: false as const, error: 'No organization found for user' };
    }

    const client = await getMercuryClient(userOrg.organization_id);
    const data = await client.getRecipients();

    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to fetch Mercury recipients',
    };
  }
}

/**
 * Link an existing Mercury recipient to a contractor.
 * Validates that the contractor belongs to the user's organization.
 * Requires admin role.
 *
 * @param contractorId - Contractor ID to link
 * @param recipientId - Mercury recipient ID to associate
 */
export async function linkMercuryRecipient(contractorId: string, recipientId: string) {
  try {
    const user = await requireAdmin();

    const validated = linkMercuryRecipientSchema.parse({
      contractor_id: contractorId,
      recipient_id: recipientId,
    });

    const userOrg = await prisma.userOrganization.findFirst({
      where: { user_id: user.userId },
      select: { organization_id: true },
    });

    if (!userOrg) {
      return { success: false as const, error: 'No organization found for user' };
    }

    // Verify contractor belongs to user's organization
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: validated.contractor_id,
        organization_id: userOrg.organization_id,
        deleted_at: null,
      },
    });

    if (!contractor) {
      return { success: false as const, error: 'Contractor not found' };
    }

    await prisma.contractor.updateMany({
      where: {
        id: validated.contractor_id,
        organization_id: userOrg.organization_id,
        deleted_at: null,
      },
      data: { mercury_recipient_id: validated.recipient_id },
    });

    revalidatePath('/dashboard/contractors');
    return { success: true as const, data: { contractorId: validated.contractor_id, recipientId: validated.recipient_id } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to link Mercury recipient',
    };
  }
}

/**
 * Create a new Mercury recipient and link it to a contractor.
 * Validates that the contractor belongs to the user's organization.
 * Requires admin role.
 *
 * @param data - Recipient creation input including contractor_id, name, emails, defaultPaymentMethod
 */
export async function createMercuryRecipient(data: CreateMercuryRecipientInput) {
  try {
    const user = await requireAdmin();

    const validated = createMercuryRecipientSchema.parse(data);

    const userOrg = await prisma.userOrganization.findFirst({
      where: { user_id: user.userId },
      select: { organization_id: true },
    });

    if (!userOrg) {
      return { success: false as const, error: 'No organization found for user' };
    }

    // Verify contractor belongs to user's organization
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: validated.contractor_id,
        organization_id: userOrg.organization_id,
        deleted_at: null,
      },
    });

    if (!contractor) {
      return { success: false as const, error: 'Contractor not found' };
    }

    const client = await getMercuryClient(userOrg.organization_id);

    const payload = {
      name: validated.name,
      emails: validated.emails ?? [],
      defaultPaymentMethod: validated.defaultPaymentMethod,
    };

    const recipient = await client.createRecipient(payload);

    // Link the newly created recipient to the contractor
    await prisma.contractor.updateMany({
      where: {
        id: validated.contractor_id,
        organization_id: userOrg.organization_id,
        deleted_at: null,
      },
      data: { mercury_recipient_id: recipient.id },
    });

    revalidatePath('/dashboard/contractors');
    return { success: true as const, data: recipient };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create Mercury recipient',
    };
  }
}
