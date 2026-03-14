'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { requireAuth } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import {
  createStaffBonusSchema,
  updateStaffBonusSchema,
  approveBonusSchema,
  markBonusPaidSchema,
} from '@/lib/validations/bonus';

/**
 * Create a new bonus for a staff member.
 */
export async function createStaffBonus(data: unknown) {
  const validated = createStaffBonusSchema.parse(data);
  const organizationId = await getOrganizationId();
  const user = await requireAuth();

  // Verify staff exists and belongs to organization
  const staff = await prisma.staff.findFirst({
    where: { id: validated.staff_id, organization_id: organizationId, deleted_at: null },
  });
  if (!staff) throw new Error('Staff member not found');

  const bonus = await prisma.staffBonus.create({
    data: {
      staff_id: validated.staff_id,
      bonus_type: validated.bonus_type,
      amount: validated.amount,
      description: validated.description ?? null,
      month: validated.month,
      year: validated.year,
      created_by: user.userId,
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.staff_id}`);
  return bonus;
}

/**
 * Update an existing bonus. Blocked if bonus is already paid.
 */
export async function updateStaffBonus(id: string, data: unknown) {
  const validated = updateStaffBonusSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify bonus exists and staff belongs to org
  const existing = await prisma.staffBonus.findFirst({
    where: { id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Bonus not found');
  }
  if (existing.is_paid) {
    throw new Error('Cannot edit a paid bonus');
  }

  const bonus = await prisma.staffBonus.update({
    where: { id },
    data: validated,
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return bonus;
}

/**
 * Toggle bonus approval status. Cannot unapprove if already paid.
 */
export async function toggleBonusApproval(data: unknown) {
  const validated = approveBonusSchema.parse(data);
  const organizationId = await getOrganizationId();
  const user = await requireAuth();

  const existing = await prisma.staffBonus.findFirst({
    where: { id: validated.bonus_id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Bonus not found');
  }

  // Cannot unapprove a paid bonus
  if (!validated.approved && existing.is_paid) {
    throw new Error('Cannot unapprove a paid bonus');
  }

  const bonus = await prisma.staffBonus.update({
    where: { id: validated.bonus_id },
    data: validated.approved
      ? { is_approved: true, approved_at: new Date(), approved_by: user.userId }
      : { is_approved: false, approved_at: null, approved_by: null },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return bonus;
}

/**
 * Toggle bonus paid status. Requires approval before marking as paid.
 */
export async function toggleBonusPaid(data: unknown) {
  const validated = markBonusPaidSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.staffBonus.findFirst({
    where: { id: validated.bonus_id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Bonus not found');
  }

  // Cannot mark as paid if not approved
  if (validated.paid && !existing.is_approved) {
    throw new Error('Bonus must be approved before marking as paid');
  }

  const bonus = await prisma.staffBonus.update({
    where: { id: validated.bonus_id },
    data: validated.paid
      ? { is_paid: true, paid_at: new Date() }
      : { is_paid: false, paid_at: null },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return bonus;
}

/**
 * Delete a bonus. Blocked if bonus is already paid.
 */
export async function deleteStaffBonus(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.staffBonus.findFirst({
    where: { id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Bonus not found');
  }
  if (existing.is_paid) {
    throw new Error('Cannot delete a paid bonus');
  }

  await prisma.staffBonus.delete({ where: { id } });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
}

/**
 * Get bonus summary for a staff member (all-time totals).
 */
export async function getStaffBonusSummary(staffId: string) {
  const organizationId = await getOrganizationId();

  // Verify staff belongs to org
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, organization_id: organizationId, deleted_at: null },
    select: { rate: true },
  });
  if (!staff) throw new Error('Staff member not found');

  const bonuses = await prisma.staffBonus.findMany({
    where: { staff_id: staffId },
  });

  const totalApproved = bonuses
    .filter((b) => b.is_approved)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const totalPaid = bonuses
    .filter((b) => b.is_paid)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const totalPending = bonuses
    .filter((b) => !b.is_approved)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  return {
    totalApproved,
    totalPaid,
    totalPending,
    bonusCount: bonuses.length,
    baseCost: Number(staff.rate),
    totalCost: Number(staff.rate) + totalApproved,
  };
}
