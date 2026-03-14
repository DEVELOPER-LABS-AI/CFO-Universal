'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import { createContractorSchema, createAssignmentSchema } from '@/lib/validations/contractor';
import type { ContractorWithUtilization } from '@/types/contractor';

export async function createContractor(data: unknown) {
  const validated = createContractorSchema.parse(data);
  const organizationId = await getOrganizationId();

  const contractor = await prisma.contractor.create({
    data: { organization_id: organizationId, ...validated },
  });

  revalidatePath('/dashboard/contractors');
  return contractor;
}

export async function getContractors(): Promise<ContractorWithUtilization[]> {
  const organizationId = await getOrganizationId();

  const contractors = await prisma.contractor.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    include: {
      assignments: {
        where: { OR: [{ end_date: null }, { end_date: { gte: new Date() } }] },
        include: { client: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Convert Prisma Decimal fields to plain numbers for RSC serialization
  // Inactive contractors show 0 utilization so they don't skew metrics
  return contractors.map((contractor) => ({
    ...contractor,
    rate: contractor.rate ? Number(contractor.rate) : null,
    utilization: contractor.status === 'INACTIVE'
      ? 0
      : contractor.assignments.reduce((sum, a) => sum + a.allocation_percentage, 0),
    active_assignments: contractor.status === 'INACTIVE' ? [] : contractor.assignments,
    assignments_count: contractor.status === 'INACTIVE' ? 0 : contractor.assignments.length,
  }));
}

/**
 * Lightweight query returning only id and name for dropdown pickers.
 * Avoids serialization issues with Decimal/Date fields across the
 * server-action → client boundary.
 */
export async function getContractorsForSelect(): Promise<Array<{ id: string; name: string }>> {
  const organizationId = await getOrganizationId();

  const contractors = await prisma.contractor.findMany({
    where: { organization_id: organizationId, deleted_at: null, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return contractors;
}

export async function updateContractor(id: string, data: unknown) {
  const validated = createContractorSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check ownership
  const existing = await prisma.contractor.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Contractor not found');

  // Use updateMany directly — soft-delete middleware converts update→updateMany
  await prisma.contractor.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: validated,
  });

  revalidatePath('/dashboard/contractors');
  return { id };
}

export async function softDeleteContractor(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.contractor.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Contractor not found');

  await prisma.contractor.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/contractors');
  return { id };
}

export async function assignContractorToClient(data: unknown) {
  const validated = createAssignmentSchema.parse(data);

  // Prevent assigning inactive contractors
  const contractor = await prisma.contractor.findFirst({
    where: { id: validated.contractor_id, deleted_at: null },
  });
  if (!contractor) throw new Error('Contractor not found');
  if (contractor.status === 'INACTIVE') {
    throw new Error('Cannot assign an inactive contractor to a client');
  }

  const overlapping = await prisma.contractorAssignment.findMany({
    where: {
      contractor_id: validated.contractor_id,
      OR: [{ end_date: null }, { end_date: { gte: validated.start_date } }],
      ...(validated.end_date && { start_date: { lte: validated.end_date } }),
    },
  });

  const currentUtilization = overlapping.reduce((sum, a) => sum + a.allocation_percentage, 0);
  const newUtilization = currentUtilization + validated.allocation_percentage;

  if (newUtilization > 100) {
    throw new Error(
      `Contractor already allocated ${currentUtilization}%. Cannot add ${validated.allocation_percentage}%`
    );
  }

  const assignment = await prisma.contractorAssignment.create({ data: validated });

  revalidatePath('/dashboard/contractors');
  revalidatePath('/dashboard/clients');
  return assignment;
}

export async function endContractorAssignment(assignmentId: string) {
  const organizationId = await getOrganizationId();

  const assignment = await prisma.contractorAssignment.findUnique({
    where: { id: assignmentId },
    include: { contractor: true },
  });

  if (!assignment) throw new Error('Assignment not found');
  if (assignment.contractor.organization_id !== organizationId) {
    throw new Error('Assignment not found');
  }

  const updated = await prisma.contractorAssignment.update({
    where: { id: assignmentId },
    data: { end_date: new Date() },
  });

  revalidatePath('/dashboard/contractors');
  revalidatePath(`/dashboard/contractors/${updated.contractor_id}`);
  revalidatePath(`/dashboard/clients/${updated.client_id}`);

  return updated;
}

/**
 * Toggle a contractor's status between ACTIVE and INACTIVE.
 */
export async function toggleContractorStatus(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.contractor.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Contractor not found');

  const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  await prisma.contractor.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: { status: newStatus },
  });

  revalidatePath('/dashboard/contractors');
  revalidatePath(`/dashboard/contractors/${id}`);
  return { id, status: newStatus };
}
