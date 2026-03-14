'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { requireAuth } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import {
  createStaffReimbursementSchema,
  updateStaffReimbursementSchema,
  approveReimbursementSchema,
  markReimbursementPaidSchema,
} from '@/lib/validations/reimbursement';

/**
 * Create a new reimbursement for a staff member.
 */
export async function createStaffReimbursement(data: unknown) {
  const validated = createStaffReimbursementSchema.parse(data);
  const organizationId = await getOrganizationId();
  const user = await requireAuth();

  // Verify staff exists and belongs to organization
  const staff = await prisma.staff.findFirst({
    where: { id: validated.staff_id, organization_id: organizationId, deleted_at: null },
  });
  if (!staff) throw new Error('Staff member not found');

  const reimbursement = await prisma.staffReimbursement.create({
    data: {
      staff_id: validated.staff_id,
      reimbursement_type: validated.reimbursement_type,
      amount: validated.amount,
      description: validated.description ?? null,
      receipt_url: validated.receipt_url ?? null,
      month: validated.month,
      year: validated.year,
      created_by: user.userId,
    },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.staff_id}`);
  return reimbursement;
}

/**
 * Update an existing reimbursement. Blocked if already paid.
 */
export async function updateStaffReimbursement(id: string, data: unknown) {
  const validated = updateStaffReimbursementSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.staffReimbursement.findFirst({
    where: { id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Reimbursement not found');
  }
  if (existing.is_paid) {
    throw new Error('Cannot edit a paid reimbursement');
  }

  const reimbursement = await prisma.staffReimbursement.update({
    where: { id },
    data: validated,
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return reimbursement;
}

/**
 * Toggle reimbursement approval status. Cannot unapprove if already paid.
 */
export async function toggleReimbursementApproval(data: unknown) {
  const validated = approveReimbursementSchema.parse(data);
  const organizationId = await getOrganizationId();
  const user = await requireAuth();

  const existing = await prisma.staffReimbursement.findFirst({
    where: { id: validated.reimbursement_id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Reimbursement not found');
  }

  // Cannot unapprove a paid reimbursement
  if (!validated.approved && existing.is_paid) {
    throw new Error('Cannot unapprove a paid reimbursement');
  }

  const reimbursement = await prisma.staffReimbursement.update({
    where: { id: validated.reimbursement_id },
    data: validated.approved
      ? { is_approved: true, approved_at: new Date(), approved_by: user.userId }
      : { is_approved: false, approved_at: null, approved_by: null },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return reimbursement;
}

/**
 * Toggle reimbursement paid status. Requires approval before marking as paid.
 */
export async function toggleReimbursementPaid(data: unknown) {
  const validated = markReimbursementPaidSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.staffReimbursement.findFirst({
    where: { id: validated.reimbursement_id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Reimbursement not found');
  }

  // Cannot mark as paid if not approved
  if (validated.paid && !existing.is_approved) {
    throw new Error('Reimbursement must be approved before marking as paid');
  }

  const reimbursement = await prisma.staffReimbursement.update({
    where: { id: validated.reimbursement_id },
    data: validated.paid
      ? { is_paid: true, paid_at: new Date() }
      : { is_paid: false, paid_at: null },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
  return reimbursement;
}

/**
 * Delete a reimbursement. Blocked if already paid.
 */
export async function deleteStaffReimbursement(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.staffReimbursement.findFirst({
    where: { id },
    include: { staff: { select: { id: true, organization_id: true } } },
  });
  if (!existing || existing.staff.organization_id !== organizationId) {
    throw new Error('Reimbursement not found');
  }
  if (existing.is_paid) {
    throw new Error('Cannot delete a paid reimbursement');
  }

  await prisma.staffReimbursement.delete({ where: { id } });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${existing.staff_id}`);
}

/**
 * Get reimbursement summary for a staff member (all-time totals).
 */
export async function getStaffReimbursementSummary(staffId: string) {
  const organizationId = await getOrganizationId();

  // Verify staff belongs to org
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, organization_id: organizationId, deleted_at: null },
    select: { id: true },
  });
  if (!staff) throw new Error('Staff member not found');

  const reimbursements = await prisma.staffReimbursement.findMany({
    where: { staff_id: staffId },
  });

  const totalApproved = reimbursements
    .filter((r) => r.is_approved)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const totalPaid = reimbursements
    .filter((r) => r.is_paid)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const totalPending = reimbursements
    .filter((r) => !r.is_approved)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    totalApproved,
    totalPaid,
    totalPending,
    reimbursementCount: reimbursements.length,
  };
}
