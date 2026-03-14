'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  recordBDRProductivitySchema,
  updateBDRProductivitySchema,
  getBDRProductivitySchema,
} from '@/lib/validations/productivity';

// T093: recordBDRProductivity server action
export async function recordBDRProductivity(data: unknown) {
  const validated = recordBDRProductivitySchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify BDR exists and is of type BDR
  const bdr = await prisma.staff.findFirst({
    where: {
      id: validated.bdr_id,
      organization_id: organizationId,
      staff_type: 'BDR',
      deleted_at: null,
    },
  });
  if (!bdr) throw new Error('BDR not found or staff member is not a BDR');

  // If client_id provided, verify it exists
  if (validated.client_id) {
    const client = await prisma.client.findFirst({
      where: {
        id: validated.client_id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });
    if (!client) throw new Error('Client not found');
  }

  // Check if productivity metric exists
  const existing = await prisma.bDRProductivityMetric.findFirst({
    where: {
      bdr_id: validated.bdr_id,
      client_id: validated.client_id ?? null,
      month: validated.month,
      year: validated.year,
    },
  });

  // Update or create productivity metric
  const metric = existing
    ? await prisma.bDRProductivityMetric.update({
        where: { id: existing.id },
        data: { meetings_attended: validated.meetings_attended },
        include: {
          bdr: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      })
    : await prisma.bDRProductivityMetric.create({
        data: {
          bdr_id: validated.bdr_id,
          client_id: validated.client_id ?? null,
          month: validated.month,
          year: validated.year,
          meetings_attended: validated.meetings_attended,
        },
        include: {
          bdr: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${validated.bdr_id}`);
  if (validated.client_id) {
    revalidatePath(`/dashboard/clients/${validated.client_id}`);
  }

  return metric;
}

export async function getBDRProductivity(input?: unknown) {
  const validated = input ? getBDRProductivitySchema.parse(input) : getBDRProductivitySchema.parse({});
  const organizationId = await getOrganizationId();

  const where: any = {
    bdr: {
      organization_id: organizationId,
      deleted_at: null,
    },
  };

  if (validated.bdr_id) {
    where.bdr_id = validated.bdr_id;
  }

  if (validated.client_id) {
    where.client_id = validated.client_id;
  }

  // Date range filters
  if (validated.start_year || validated.start_month) {
    where.OR = [
      {
        year: { gt: validated.start_year || 2000 },
      },
      {
        AND: [
          { year: validated.start_year || 2000 },
          { month: { gte: validated.start_month || 1 } },
        ],
      },
    ];
  }

  if (validated.end_year || validated.end_month) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        {
          year: { lt: validated.end_year || 2100 },
        },
        {
          AND: [
            { year: validated.end_year || 2100 },
            { month: { lte: validated.end_month || 12 } },
          ],
        },
      ],
    });
  }

  const metrics = await prisma.bDRProductivityMetric.findMany({
    where,
    include: {
      bdr: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: [
      { year: validated.sort_order || 'desc' },
      { month: validated.sort_order || 'desc' },
    ],
  });

  return metrics;
}

export async function deleteBDRProductivity(bdrId: string, clientId: string | null, month: number, year: number) {
  const organizationId = await getOrganizationId();

  // Verify ownership
  const bdr = await prisma.staff.findFirst({
    where: { id: bdrId, organization_id: organizationId, deleted_at: null },
  });
  if (!bdr) throw new Error('BDR not found');

  // Find the productivity metric first
  const metric = await prisma.bDRProductivityMetric.findFirst({
    where: {
      bdr_id: bdrId,
      client_id: clientId ?? null,
      month,
      year,
    },
  });

  if (!metric) throw new Error('Productivity metric not found');

  // Delete by ID
  await prisma.bDRProductivityMetric.delete({
    where: { id: metric.id },
  });

  revalidatePath('/dashboard/staff');
  revalidatePath(`/dashboard/staff/${bdrId}`);
  if (clientId) {
    revalidatePath(`/dashboard/clients/${clientId}`);
  }

  return { success: true };
}
