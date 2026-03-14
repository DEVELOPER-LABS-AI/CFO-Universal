import { z } from 'zod';

// ============================================================================
// Project CRUD Schemas
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Name must be less than 200 characters').trim(),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  client_id: z.string().uuid('Invalid client ID').optional(),
  budget_target: z.number().min(0, 'Budget must be a positive number').optional(),
  start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
}).refine(
  (data) => !data.end_date || !data.start_date || data.end_date >= data.start_date,
  { message: 'End date must be after start date', path: ['end_date'] }
);

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  budget_target: z.number().min(0).nullable().optional(),
  status: z.enum(['ACTIVE', 'UNDER_REVIEW', 'SUNSET', 'ARCHIVED']).optional(),
  end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
});

// ============================================================================
// Allocation Schemas
// ============================================================================

export const createAllocationSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  cost_source_type: z.enum(['STAFF', 'CONTRACTOR', 'SUBSCRIPTION', 'OTHER']),
  cost_source_id: z.string().uuid('Invalid source ID'),
  allocation_percentage: z.number().min(1, 'Allocation must be at least 1%').max(100, 'Allocation cannot exceed 100%'),
  fixed_amount: z.number().min(0, 'Amount must be positive').optional(),
  effective_start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  effective_end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
}).refine(
  (data) => data.cost_source_type !== 'OTHER' || data.fixed_amount !== undefined,
  { message: 'Fixed amount is required for OTHER cost type', path: ['fixed_amount'] }
);

export const updateAllocationSchema = z.object({
  allocation_percentage: z.number().min(1).max(100).optional(),
  fixed_amount: z.number().min(0).optional(),
  effective_end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// Metrics Schemas
// ============================================================================

export const projectRevenueSchema = z.object({
  project_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  revenue: z.number().min(0, 'Revenue must be a positive number'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
export type ProjectRevenueInput = z.infer<typeof projectRevenueSchema>;
