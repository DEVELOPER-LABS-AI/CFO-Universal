'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import { createClientSchema, updateClientSchema, getClientsSchema } from '@/lib/validations/client';
import { Prisma } from '@prisma/client';

export async function createClient(data: unknown) {
  const validated = createClientSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.client.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
    },
  });

  if (existing) throw new Error('A client with this name already exists');

  const client = await prisma.$transaction(async (tx) => {
    const newClient = await tx.client.create({
      data: {
        organization_id: organizationId,
        name: validated.name,
        relationship_type: validated.relationship_type,
        status: validated.status,
        custom_margin_target: validated.custom_margin_target,
        start_date: validated.start_date,
        churn_date: validated.churn_date,
        is_internal: validated.is_internal ?? false,
      },
    });

    if (validated.service_ids.length > 0) {
      await tx.clientService.createMany({
        data: validated.service_ids.map((service_id) => ({
          client_id: newClient.id,
          service_id,
        })),
      });
    }

    return tx.client.findUnique({
      where: { id: newClient.id },
      include: { client_services: { include: { service: true } } },
    });
  });

  revalidatePath('/dashboard/clients');
  return client;
}

// T057: getClients with pagination and filters using GetClientsSchema
export async function getClients(input?: unknown) {
  const validated = input ? getClientsSchema.parse(input) : getClientsSchema.parse({});
  const organizationId = await getOrganizationId();

  const where: Prisma.ClientWhereInput = {
    organization_id: organizationId,
    deleted_at: null,
  };

  // T072: Client search by name (partial match, case-insensitive)
  if (validated.search) {
    where.name = { contains: validated.search, mode: 'insensitive' };
  }

  // T073: Client filters (status, relationship type, margin range)
  if (validated.status) {
    where.status = validated.status as any;
  }

  if (validated.relationship_type) {
    where.relationship_type = validated.relationship_type as any;
  }

  if (validated.min_margin !== undefined || validated.max_margin !== undefined) {
    where.custom_margin_target = {};
    if (validated.min_margin !== undefined) {
      where.custom_margin_target.gte = validated.min_margin;
    }
    if (validated.max_margin !== undefined) {
      where.custom_margin_target.lte = validated.max_margin;
    }
  }

  const page = validated.page || 1;
  const limit = validated.limit || 20;
  const skip = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { client_services: { include: { service: { select: { id: true, name: true } } } } },
      orderBy: { [validated.sort_by || 'created_at']: validated.sort_order || 'desc' },
      skip,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  // Aggregate total revenue collected per client from Mercury deposits (actual cash received)
  const clientIds = clients.map((c) => c.id);
  const revenueAggregations = clientIds.length > 0
    ? await prisma.clientCashReceipt.groupBy({
        by: ['client_id'],
        where: {
          client_id: { in: clientIds },
          organization_id: organizationId,
        },
        _sum: { amount: true },
      })
    : [];

  const revenueByClient = new Map(
    revenueAggregations.map((r) => [r.client_id, Number(r._sum.amount ?? 0)])
  );

  const clientsWithRevenue = clients.map((client) => ({
    ...client,
    total_revenue: revenueByClient.get(client.id) ?? 0,
  }));

  // Aggregate current month's revenue from active clients (Monthly Revenue metric)
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const activeClientIds = clients
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => c.id);

  const monthlyRevenueResult = activeClientIds.length > 0
    ? await prisma.clientCashReceipt.aggregate({
        where: {
          client_id: { in: activeClientIds },
          organization_id: organizationId,
          period_month: currentMonth,
          period_year: currentYear,
        },
        _sum: { amount: true },
      })
    : { _sum: { amount: null } };

  const monthlyRevenue = Number(monthlyRevenueResult._sum.amount ?? 0);

  return {
    clients: clientsWithRevenue,
    monthlyRevenue,
    pagination: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getClientById(id: string) {
  const organizationId = await getOrganizationId();
  return prisma.client.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
    include: {
      client_services: { include: { service: true } },
      contractor_assignments: { include: { contractor: true }, orderBy: { start_date: 'desc' } },
      staff_assignments: {
        include: {
          staff: {
            select: { id: true, name: true, staff_type: true, rate: true, rate_type: true, agency_id: true },
          },
          monthly_overrides: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          },
        },
        orderBy: { start_date: 'desc' },
      },
    },
  });
}

// T059: updateClient with churn date validation using UpdateClientSchema
export async function updateClient(id: string, data: unknown) {
  const validated = updateClientSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check ownership
  const existing = await prisma.client.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Client not found');

  // Check for duplicate name (excluding current client)
  const duplicate = await prisma.client.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      id: { not: id },
      deleted_at: null,
    },
  });
  if (duplicate) throw new Error('A client with this name already exists');

  // Use updateMany directly — the soft-delete middleware converts update→updateMany
  // which doesn't support `include` and causes a Prisma validation error at runtime
  await prisma.client.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: {
      ...(validated.name && { name: validated.name }),
      ...(validated.relationship_type && { relationship_type: validated.relationship_type }),
      ...(validated.status && { status: validated.status }),
      ...(validated.custom_margin_target !== undefined && { custom_margin_target: validated.custom_margin_target }),
      ...(validated.start_date && { start_date: validated.start_date }),
      ...(validated.churn_date !== undefined && { churn_date: validated.churn_date }),
      ...(validated.is_internal !== undefined && { is_internal: validated.is_internal }),
    },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${id}`);
  return { id };
}

// T060: softDeleteClient setting deleted_at timestamp
/**
 * Quick-create a client with minimal fields (name + defaults).
 * Used from the Vendor Mapping page where full client setup isn't needed.
 * Returns { id, name } for immediate use in mapping dropdowns.
 */
export async function createQuickClient(data: { name: string; relationship_type?: string }) {
  const name = (data.name ?? '').trim();
  if (!name) throw new Error('Client name is required');

  const organizationId = await getOrganizationId();

  const existing = await prisma.client.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: name, mode: 'insensitive' },
      deleted_at: null,
    },
  });
  if (existing) throw new Error('A client with this name already exists');

  const client = await prisma.client.create({
    data: {
      organization_id: organizationId,
      name,
      relationship_type: (data.relationship_type as any) ?? 'RETAINER',
      status: 'ACTIVE',
      start_date: new Date(),
    },
    select: { id: true, name: true },
  });

  revalidatePath('/dashboard/clients');
  return client;
}

export async function softDeleteClient(id: string) {
  const organizationId = await getOrganizationId();

  // Check ownership
  const existing = await prisma.client.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Client not found');

  await prisma.client.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/clients');
  return { id };
}

/**
 * Update enrichment goals for a client (emails/phones per month).
 */
export async function updateClientEnrichmentGoals(
  clientId: string,
  data: {
    enrichment_emails_per_month: number | null;
    enrichment_phones_per_month: number | null;
  }
) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Client not found');

  await prisma.client.update({
    where: { id: clientId },
    data: {
      enrichment_emails_per_month: data.enrichment_emails_per_month,
      enrichment_phones_per_month: data.enrichment_phones_per_month,
    },
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { success: true };
}

/**
 * Get enrichment credit budget across all enrichment subscriptions for the org.
 * Returns total available credits and per-unit costs.
 */
export async function getEnrichmentBudget() {
  const organizationId = await getOrganizationId();

  const enrichmentSubs = await prisma.subscription.findMany({
    where: {
      organization_id: organizationId,
      is_enrichment: true,
      is_active: true,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      total_credits: true,
      credit_cost_email: true,
      credit_cost_phone: true,
      allocations: {
        select: { client_id: true },
      },
    },
  });

  const totalCredits = enrichmentSubs.reduce((sum, s) => sum + (s.total_credits ?? 0), 0);
  // Use lowest cost across subs for the best rate
  const emailCosts = enrichmentSubs
    .filter((s) => s.credit_cost_email)
    .map((s) => Number(s.credit_cost_email));
  const phoneCosts = enrichmentSubs
    .filter((s) => s.credit_cost_phone)
    .map((s) => Number(s.credit_cost_phone));

  const avgEmailCost = emailCosts.length > 0
    ? emailCosts.reduce((a, b) => a + b, 0) / emailCosts.length
    : 0;
  const avgPhoneCost = phoneCosts.length > 0
    ? phoneCosts.reduce((a, b) => a + b, 0) / phoneCosts.length
    : 0;

  // Count total clients allocated to enrichment subscriptions
  const allocatedClientIds = new Set(
    enrichmentSubs.flatMap((s) => s.allocations.map((a) => a.client_id).filter(Boolean))
  );

  return {
    totalCredits,
    avgEmailCost,
    avgPhoneCost,
    enrichmentSubCount: enrichmentSubs.length,
    allocatedClientCount: allocatedClientIds.size,
    subscriptions: enrichmentSubs.map((s) => ({
      id: s.id,
      name: s.name,
      total_credits: s.total_credits,
      credit_cost_email: s.credit_cost_email ? Number(s.credit_cost_email) : null,
      credit_cost_phone: s.credit_cost_phone ? Number(s.credit_cost_phone) : null,
    })),
  };
}
