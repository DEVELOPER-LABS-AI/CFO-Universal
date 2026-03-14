'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getOrganizationId } from '@/lib/auth/organization';
import { createProjectSchema, updateProjectSchema } from '@/lib/validations/project';
import { Prisma } from '@prisma/client';

/**
 * Valid status transitions for projects.
 * Maps each status to the list of statuses it can transition to.
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['UNDER_REVIEW', 'ARCHIVED'],
  UNDER_REVIEW: ['ACTIVE', 'SUNSET'],
  SUNSET: ['ARCHIVED'],
  ARCHIVED: [],
};

/**
 * Create a new project within the authenticated user's organization.
 *
 * @param data - Raw input validated against createProjectSchema
 * @returns The newly created project with Decimal fields serialized as numbers
 * @throws {Error} If validation fails, name is duplicate, or client does not belong to org
 */
export async function createProject(data: unknown) {
  const validated = createProjectSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Check name uniqueness within the organization (soft-delete aware)
  const existing = await prisma.project.findFirst({
    where: {
      organization_id: organizationId,
      name: { equals: validated.name, mode: 'insensitive' },
      deleted_at: null,
    },
  });
  if (existing) {
    throw new Error('A project with this name already exists');
  }

  // If client_id is provided, verify the client belongs to the same organization
  if (validated.client_id) {
    const client = await prisma.client.findFirst({
      where: {
        id: validated.client_id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });
    if (!client) {
      throw new Error('Client not found or does not belong to this organization');
    }
  }

  const project = await prisma.project.create({
    data: {
      organization_id: organizationId,
      name: validated.name,
      description: validated.description,
      client_id: validated.client_id,
      budget_target: validated.budget_target,
      start_date: validated.start_date,
      end_date: validated.end_date ?? null,
    },
  });

  revalidatePath('/dashboard/projects');

  return {
    ...project,
    budget_target: project.budget_target ? Number(project.budget_target) : null,
  };
}

/**
 * Retrieve all projects for the authenticated user's organization with optional filters.
 *
 * @param filters - Optional filters for status, client_id, and search term
 * @returns Array of projects with client info, allocation counts, and latest cost snapshot data
 */
export async function getProjects(filters?: {
  status?: string;
  client_id?: string;
  search?: string;
}) {
  const organizationId = await getOrganizationId();

  const where: Prisma.ProjectWhereInput = {
    organization_id: organizationId,
    deleted_at: null,
  };

  if (filters?.status) {
    where.status = filters.status as Prisma.EnumProjectStatusFilter;
  }

  if (filters?.client_id) {
    where.client_id = filters.client_id;
  }

  if (filters?.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      client: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          cost_allocations: {
            where: {
              OR: [
                { effective_end_date: null },
                { effective_end_date: { gte: new Date() } },
              ],
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Fetch latest cost snapshots for current month/year for all projects in one query
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const projectIds = projects.map((p) => p.id);

  const costSnapshots = projectIds.length > 0
    ? await prisma.projectCostSnapshot.findMany({
        where: {
          project_id: { in: projectIds },
          period_month: currentMonth,
          period_year: currentYear,
        },
      })
    : [];

  const snapshotByProject = new Map(
    costSnapshots.map((s) => [s.project_id, s])
  );

  return projects.map((project) => {
    const snapshot = snapshotByProject.get(project.id);
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      client: project.client,
      budget_target: project.budget_target ? Number(project.budget_target) : null,
      start_date: project.start_date,
      end_date: project.end_date,
      total_costs: snapshot ? Number(snapshot.total_costs) : 0,
      total_revenue: snapshot ? Number(snapshot.revenue) : 0,
      roi: snapshot?.roi ? Number(snapshot.roi) : null,
      allocation_count: project._count.cost_allocations,
    };
  });
}

/**
 * Retrieve a single project by ID with related data.
 *
 * @param projectId - The UUID of the project to retrieve
 * @returns The project with client, active allocations, and last 12 cost snapshots
 * @throws {Error} If the project is not found or does not belong to the user's organization
 */
export async function getProject(projectId: string) {
  const organizationId = await getOrganizationId();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization_id: organizationId,
      deleted_at: null,
    },
    include: {
      client: {
        select: { id: true, name: true },
      },
      cost_allocations: {
        where: {
          OR: [
            { effective_end_date: null },
            { effective_end_date: { gte: new Date() } },
          ],
        },
      },
      cost_snapshots: {
        orderBy: [
          { period_year: 'desc' },
          { period_month: 'desc' },
        ],
        take: 12,
      },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return {
    ...project,
    budget_target: project.budget_target ? Number(project.budget_target) : null,
    cost_allocations: project.cost_allocations.map((a) => ({
      ...a,
      allocation_percentage: Number(a.allocation_percentage),
      fixed_amount: a.fixed_amount ? Number(a.fixed_amount) : null,
    })),
    cost_snapshots: project.cost_snapshots.map((s) => ({
      ...s,
      subscription_costs: Number(s.subscription_costs),
      staff_costs: Number(s.staff_costs),
      contractor_costs: Number(s.contractor_costs),
      other_costs: Number(s.other_costs),
      total_costs: Number(s.total_costs),
      revenue: Number(s.revenue),
      roi: s.roi ? Number(s.roi) : null,
    })),
  };
}

/**
 * Update an existing project.
 *
 * @param projectId - The UUID of the project to update
 * @param data - Raw input validated against updateProjectSchema
 * @returns The updated project with Decimal fields serialized as numbers
 * @throws {Error} If project not found, invalid status transition, or duplicate name
 */
export async function updateProject(projectId: string, data: unknown) {
  const validated = updateProjectSchema.parse(data);
  const organizationId = await getOrganizationId();

  // Verify project exists and belongs to the organization
  const existing = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });
  if (!existing) {
    throw new Error('Project not found');
  }

  // Enforce valid status transitions if status is being changed
  if (validated.status && validated.status !== existing.status) {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowedTransitions.includes(validated.status)) {
      throw new Error(
        `Invalid status transition from ${existing.status} to ${validated.status}. ` +
        `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none'}`
      );
    }
  }

  // Check name uniqueness if name is being changed
  if (validated.name && validated.name !== existing.name) {
    const duplicate = await prisma.project.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: validated.name, mode: 'insensitive' },
        id: { not: projectId },
        deleted_at: null,
      },
    });
    if (duplicate) {
      throw new Error('A project with this name already exists');
    }
  }

  // If client_id is being changed, verify the new client belongs to the same org
  if (validated.client_id) {
    const client = await prisma.client.findFirst({
      where: {
        id: validated.client_id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });
    if (!client) {
      throw new Error('Client not found or does not belong to this organization');
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(validated.name !== undefined && { name: validated.name }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.client_id !== undefined && { client_id: validated.client_id }),
      ...(validated.budget_target !== undefined && { budget_target: validated.budget_target }),
      ...(validated.status !== undefined && { status: validated.status }),
      ...(validated.end_date !== undefined && { end_date: validated.end_date }),
    },
  });

  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${projectId}`);

  return {
    ...project,
    budget_target: project.budget_target ? Number(project.budget_target) : null,
  };
}

/**
 * Soft-delete (archive) a project by setting its deleted_at timestamp.
 *
 * @param projectId - The UUID of the project to archive
 * @returns { success: true } on successful archival
 * @throws {Error} If the project is not found or does not belong to the user's organization
 */
export async function archiveProject(projectId: string) {
  const organizationId = await getOrganizationId();

  // Verify project exists and belongs to the organization
  const existing = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });
  if (!existing) {
    throw new Error('Project not found');
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { deleted_at: new Date() },
  });

  revalidatePath('/dashboard/projects');

  return { success: true };
}

/**
 * Get a lightweight list of clients for the project select dropdown.
 * Returns only id and name, ordered alphabetically.
 *
 * @returns Array of { id, name } for active clients in the organization
 */
export async function getClientsForProjectSelect() {
  const organizationId = await getOrganizationId();

  return prisma.client.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });
}
