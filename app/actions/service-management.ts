'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import {
  createServiceSchema,
  assignServiceSchema,
  updateClientServiceRateSchema,
  setServiceRateHistorySchema,
  createServiceContractSchema,
  updateServiceContractSchema,
  terminateServiceContractSchema,
} from '@/lib/validations/service';
import { checkContractOverlap } from '@/lib/calculations/expected-revenue';

export async function createService(data: unknown) {
  const validated = createServiceSchema.parse(data);
  const organizationId = await getOrganizationId();

  const existing = await prisma.service.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
    },
  });

  if (existing) throw new Error('A service with this name already exists');

  const service = await prisma.service.create({
    data: { organization_id: organizationId, ...validated },
  });

  revalidatePath('/dashboard/services');
  revalidatePath('/dashboard/clients');
  return service;
}

export async function getServices(filters?: { is_active?: string }) {
  const organizationId = await getOrganizationId();
  const where: any = { organization_id: organizationId, deleted_at: null };

  if (filters?.is_active && filters.is_active !== 'all') {
    where.is_active = filters.is_active === 'true';
  }

  return prisma.service.findMany({ where, orderBy: { name: 'asc' } });
}

export async function updateService(id: string, data: unknown) {
  const validated = createServiceSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check ownership
  const existing = await prisma.service.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Service not found');

  // Check for duplicate name
  const duplicate = await prisma.service.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      id: { not: id },
      deleted_at: null,
    },
  });
  if (duplicate) throw new Error('A service with this name already exists');

  // Use updateMany directly — soft-delete middleware converts update→updateMany
  await prisma.service.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: validated,
  });

  revalidatePath('/dashboard/services');
  return { id };
}

export async function softDeleteService(id: string) {
  const organizationId = await getOrganizationId();

  const existing = await prisma.service.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });
  if (!existing) throw new Error('Service not found');

  await prisma.service.updateMany({
    where: { id, organization_id: organizationId, deleted_at: null },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/services');
  return { id };
}

// T063: assignServiceToClient preventing duplicates
export async function assignServiceToClient(data: unknown) {
  const validated = assignServiceSchema.parse(data);
  const organizationId = await getOrganizationId(); // TODO: Get from session

  // Check if service exists and belongs to organization
  const service = await prisma.service.findFirst({
    where: { id: validated.service_id, organization_id: organizationId, deleted_at: null },
  });
  if (!service) throw new Error('Service not found');

  // Check if client exists and belongs to organization
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  // Check for existing assignment to prevent duplicates
  const existing = await prisma.clientService.findUnique({
    where: {
      client_id_service_id: {
        client_id: validated.client_id,
        service_id: validated.service_id,
      },
    },
  });
  if (existing) throw new Error('Service is already assigned to this client');

  const clientService = await prisma.clientService.create({
    data: {
      client_id: validated.client_id,
      service_id: validated.service_id,
      custom_rate: validated.custom_rate,
    },
    include: {
      service: true,
      client: true,
    },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${validated.client_id}`);
  return clientService;
}

// T064: removeServiceFromClient
export async function removeServiceFromClient(clientId: string, serviceId: string) {
  const organizationId = await getOrganizationId(); // TODO: Get from session

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  const service = await prisma.service.findFirst({
    where: { id: serviceId, organization_id: organizationId, deleted_at: null },
  });
  if (!service) throw new Error('Service not found');

  await prisma.clientService.delete({
    where: {
      client_id_service_id: {
        client_id: clientId,
        service_id: serviceId,
      },
    },
  });

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { success: true };
}

/**
 * Update the custom rate for an existing client-service assignment.
 * Creates a rate history entry so historical periods retain their correct rate.
 * Pass null custom_rate to revert to the service's standard rate.
 */
export async function updateClientServiceRate(data: unknown) {
  const validated = updateClientServiceRateSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  const service = await prisma.service.findFirst({
    where: { id: validated.service_id, organization_id: organizationId, deleted_at: null },
  });
  if (!service) throw new Error('Service not found');

  const now = new Date();
  const effectiveMonth = validated.effective_month ?? (now.getMonth() + 1);
  const effectiveYear = validated.effective_year ?? now.getFullYear();
  const newRate = validated.custom_rate ?? Number(service.standard_rate);

  // Create a rate history entry for the new rate
  await prisma.$transaction([
    prisma.clientService.update({
      where: {
        client_id_service_id: {
          client_id: validated.client_id,
          service_id: validated.service_id,
        },
      },
      data: { custom_rate: validated.custom_rate },
    }),
    prisma.serviceRateHistory.create({
      data: {
        client_id: validated.client_id,
        service_id: validated.service_id,
        rate: newRate,
        effective_month: effectiveMonth,
        effective_year: effectiveYear,
      },
    }),
  ]);

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${validated.client_id}`);
  return { success: true };
}

/**
 * Set a historical rate entry for a client service.
 * Used for backdating rates (e.g., "this service was $12,000/mo from Jun 2025").
 */
export async function setServiceRateHistory(data: unknown) {
  const validated = setServiceRateHistorySchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  // Upsert: if there's already a history entry for this exact month/year, update it
  const existing = await prisma.serviceRateHistory.findFirst({
    where: {
      client_id: validated.client_id,
      service_id: validated.service_id,
      effective_month: validated.effective_month,
      effective_year: validated.effective_year,
    },
  });

  if (existing) {
    await prisma.serviceRateHistory.update({
      where: { id: existing.id },
      data: { rate: validated.rate },
    });
  } else {
    await prisma.serviceRateHistory.create({
      data: {
        client_id: validated.client_id,
        service_id: validated.service_id,
        rate: validated.rate,
        effective_month: validated.effective_month,
        effective_year: validated.effective_year,
      },
    });
  }

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${validated.client_id}`);
  return { success: true };
}

/**
 * Get the rate history for a specific client service.
 * Returns entries sorted by effective date descending.
 */
export async function getServiceRateHistory(clientId: string, serviceId: string) {
  const organizationId = await getOrganizationId();

  // Verify ownership
  const client = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  const history = await prisma.serviceRateHistory.findMany({
    where: { client_id: clientId, service_id: serviceId },
    orderBy: [{ effective_year: 'desc' }, { effective_month: 'desc' }],
  });

  return history.map((h) => ({
    id: h.id,
    rate: Number(h.rate),
    effectiveMonth: h.effective_month,
    effectiveYear: h.effective_year,
    createdAt: h.created_at,
  }));
}

/**
 * Delete a rate history entry.
 */
export async function deleteServiceRateHistory(historyId: string) {
  const organizationId = await getOrganizationId();

  const entry = await prisma.serviceRateHistory.findUnique({
    where: { id: historyId },
    include: { client_service: { include: { client: true } } },
  });
  if (!entry || entry.client_service.client.organization_id !== organizationId) {
    throw new Error('Rate history entry not found');
  }

  await prisma.serviceRateHistory.delete({ where: { id: historyId } });

  revalidatePath('/dashboard/clients');
  revalidatePath(`/dashboard/clients/${entry.client_id}`);
  return { success: true };
}

// ─── Service Contracts (Feature 9) ────────────────────────────────────────────

/**
 * Helper: calculate term_months between two month/year pairs (inclusive).
 */
function calculateTermMonths(
  startMonth: number, startYear: number,
  endMonth: number, endYear: number
): number {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

/**
 * T014: Create a new service contract.
 * Validates billing-model-specific fields, checks overlap, auto-calculates term_months,
 * ensures ClientService exists, sets COMPLETED status if end date is in the past.
 */
export async function createServiceContract(data: unknown) {
  const validated = createServiceContractSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify client belongs to org
  const client = await prisma.client.findFirst({
    where: { id: validated.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) return { success: false, error: 'Client not found or not in your organization' };

  // Verify service belongs to org
  const service = await prisma.service.findFirst({
    where: { id: validated.service_id, organization_id: organizationId, deleted_at: null },
  });
  if (!service) return { success: false, error: 'Service not found or not in your organization' };

  // Check for overlapping ACTIVE contracts
  const overlap = await checkContractOverlap(
    validated.client_id,
    validated.service_id,
    validated.start_month,
    validated.start_year,
    validated.end_month ?? null,
    validated.end_year ?? null,
  );
  if (overlap.overlaps && overlap.conflictingContract) {
    const c = overlap.conflictingContract;
    const startStr = `${c.start_month}/${c.start_year}`;
    const endStr = c.end_month && c.end_year ? `${c.end_month}/${c.end_year}` : 'ongoing';
    return {
      success: false,
      error: `Overlapping contract exists for ${service.name} from ${startStr} to ${endStr}. End the existing contract first.`,
    };
  }

  // Calculate term_months for CONTRACT type
  let termMonths: number | null = null;
  if (validated.billing_model === 'CONTRACT' && validated.end_month && validated.end_year) {
    termMonths = calculateTermMonths(
      validated.start_month, validated.start_year,
      validated.end_month, validated.end_year
    );
  }

  // Determine status: COMPLETED if end date is before current month
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE';
  if (validated.end_month && validated.end_year) {
    const endBeforeCurrent =
      validated.end_year < currentYear ||
      (validated.end_year === currentYear && validated.end_month < currentMonth);
    if (endBeforeCurrent) status = 'COMPLETED';
  }

  // Create the contract
  const contract = await prisma.serviceContract.create({
    data: {
      organization_id: organizationId,
      client_id: validated.client_id,
      service_id: validated.service_id,
      billing_model: validated.billing_model,
      status,
      start_month: validated.start_month,
      start_year: validated.start_year,
      end_month: validated.end_month ?? null,
      end_year: validated.end_year ?? null,
      monthly_rate: validated.monthly_rate ?? null,
      project_fee: validated.project_fee ?? null,
      term_months: termMonths,
      notes: validated.notes ?? null,
    },
  });

  // Ensure ClientService exists (create if missing)
  const existingAssignment = await prisma.clientService.findUnique({
    where: {
      client_id_service_id: {
        client_id: validated.client_id,
        service_id: validated.service_id,
      },
    },
  });
  if (!existingAssignment) {
    await prisma.clientService.create({
      data: {
        client_id: validated.client_id,
        service_id: validated.service_id,
        custom_rate: validated.monthly_rate ?? validated.project_fee ?? null,
      },
    });
  }

  revalidatePath(`/dashboard/clients/${validated.client_id}`);
  revalidatePath('/dashboard/clients');
  return { success: true, contract };
}

/**
 * T015: Get contracts for a client with optional filters.
 * Returns contracts with service name and calculated total_value.
 */
export async function getClientContracts(params: {
  client_id: string;
  service_id?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
}) {
  const organizationId = await getOrganizationId();

  // Verify client belongs to org
  const client = await prisma.client.findFirst({
    where: { id: params.client_id, organization_id: organizationId, deleted_at: null },
  });
  if (!client) throw new Error('Client not found');

  const where: any = {
    client_id: params.client_id,
    organization_id: organizationId,
  };
  if (params.service_id) where.service_id = params.service_id;
  if (params.status) where.status = params.status;

  const contracts = await prisma.serviceContract.findMany({
    where,
    include: { service: { select: { id: true, name: true } } },
    orderBy: [{ start_year: 'desc' }, { start_month: 'desc' }],
  });

  return {
    contracts: contracts.map((c) => ({
      id: c.id,
      billing_model: c.billing_model,
      status: c.status,
      start_month: c.start_month,
      start_year: c.start_year,
      end_month: c.end_month,
      end_year: c.end_year,
      monthly_rate: c.monthly_rate ? Number(c.monthly_rate) : null,
      project_fee: c.project_fee ? Number(c.project_fee) : null,
      term_months: c.term_months,
      total_value: c.monthly_rate && c.term_months
        ? Number(c.monthly_rate) * c.term_months
        : c.project_fee
          ? Number(c.project_fee)
          : null,
      notes: c.notes,
      service: c.service,
      created_at: c.created_at.toISOString(),
    })),
  };
}

/**
 * T016: Update a service contract.
 * Only allows changes to end_month, end_year, and notes.
 * Rate changes require terminate + create new contract.
 */
export async function updateServiceContract(data: unknown) {
  const validated = updateServiceContractSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Fetch the contract and verify ownership + ACTIVE status
  const contract = await prisma.serviceContract.findFirst({
    where: { id: validated.contract_id, organization_id: organizationId },
  });
  if (!contract) return { success: false, error: 'Contract not found' };
  if (contract.status !== 'ACTIVE') {
    return { success: false, error: 'Only ACTIVE contracts can be updated' };
  }

  // Build update data
  const updateData: any = {};
  if (validated.notes !== undefined) updateData.notes = validated.notes;

  // Handle end date changes
  if (validated.end_month !== undefined && validated.end_year !== undefined) {
    // Validate end date >= start date
    const endAfterStart =
      validated.end_year > contract.start_year ||
      (validated.end_year === contract.start_year && validated.end_month >= contract.start_month);
    if (!endAfterStart) {
      return { success: false, error: 'End date must be on or after start date' };
    }

    // Check overlap with expanded date range
    const overlap = await checkContractOverlap(
      contract.client_id,
      contract.service_id,
      contract.start_month,
      contract.start_year,
      validated.end_month,
      validated.end_year,
      contract.id,
    );
    if (overlap.overlaps) {
      return { success: false, error: 'Expanding the end date would overlap with another active contract' };
    }

    updateData.end_month = validated.end_month;
    updateData.end_year = validated.end_year;

    // Recalculate term_months for CONTRACT type
    if (contract.billing_model === 'CONTRACT') {
      updateData.term_months = calculateTermMonths(
        contract.start_month, contract.start_year,
        validated.end_month, validated.end_year
      );
    }
  }

  await prisma.serviceContract.update({
    where: { id: validated.contract_id },
    data: updateData,
  });

  revalidatePath(`/dashboard/clients/${contract.client_id}`);
  revalidatePath('/dashboard/clients');
  return { success: true };
}

/**
 * T017: Terminate a service contract.
 * Sets end date and status to TERMINATED. Recalculates term_months.
 */
export async function terminateServiceContract(data: unknown) {
  const validated = terminateServiceContractSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Fetch the contract and verify ownership + ACTIVE status
  const contract = await prisma.serviceContract.findFirst({
    where: { id: validated.contract_id, organization_id: organizationId },
  });
  if (!contract) return { success: false, error: 'Contract not found' };
  if (contract.status !== 'ACTIVE') {
    return { success: false, error: 'Only ACTIVE contracts can be terminated' };
  }

  // Calculate term_months based on new end date
  const termMonths = calculateTermMonths(
    contract.start_month, contract.start_year,
    validated.end_month, validated.end_year
  );

  await prisma.serviceContract.update({
    where: { id: validated.contract_id },
    data: {
      end_month: validated.end_month,
      end_year: validated.end_year,
      term_months: termMonths,
      status: 'TERMINATED',
    },
  });

  revalidatePath(`/dashboard/clients/${contract.client_id}`);
  revalidatePath('/dashboard/clients');
  return { success: true };
}
