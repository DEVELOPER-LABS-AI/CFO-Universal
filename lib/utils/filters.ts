/**
 * Filter utilities for converting URL search params to Prisma where clauses
 */

import { Prisma } from '@prisma/client';

export interface FilterParams {
  search?: string;
  status?: string;
  relationship_type?: string;
  service_id?: string;
  is_active?: string;
}

/**
 * Build Prisma where clause from filter parameters
 * Handles search, status, relationship type, and service filters
 */
export function buildFilters(params: FilterParams): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {};

  // Search filter (case-insensitive partial match on name)
  if (params.search && params.search.trim()) {
    where.name = {
      contains: params.search.trim(),
      mode: 'insensitive',
    };
  }

  // Status filter
  if (params.status && params.status !== 'all') {
    where.status = params.status as any;
  }

  // Relationship type filter
  if (params.relationship_type && params.relationship_type !== 'all') {
    where.relationship_type = params.relationship_type as any;
  }

  // Service filter (via join table)
  if (params.service_id) {
    where.client_services = {
      some: {
        service_id: params.service_id,
      },
    };
  }

  return where;
}

/**
 * Build Prisma where clause for service filters
 */
export function buildServiceFilters(params: FilterParams): Prisma.ServiceWhereInput {
  const where: Prisma.ServiceWhereInput = {};

  // Search filter
  if (params.search && params.search.trim()) {
    where.name = {
      contains: params.search.trim(),
      mode: 'insensitive',
    };
  }

  // Active status filter
  if (params.is_active !== undefined && params.is_active !== 'all') {
    where.is_active = params.is_active === 'true';
  }

  return where;
}
