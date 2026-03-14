import { z } from 'zod';

const clientBaseSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200, 'Name must be less than 200 characters').trim(),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED', 'CUSTOM']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']),
  custom_margin_target: z.number().min(0, 'Margin must be positive').max(100, 'Margin cannot exceed 100%').nullable().optional(),
  start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  churn_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
  service_ids: z.array(z.string().uuid()).default([]),
  is_internal: z.boolean().optional().default(false),
});

export const createClientSchema = clientBaseSchema.refine(
  (data) => data.is_internal || data.service_ids.length > 0,
  { message: 'Please select at least one service', path: ['service_ids'] }
);

export const updateClientSchema = clientBaseSchema.partial().omit({ service_ids: true });

// T043: GetClientsSchema with pagination, filters, sorting params
export const getClientsSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED', 'CUSTOM']).optional(),
  min_margin: z.number().min(0).max(100).optional(),
  max_margin: z.number().min(0).max(100).optional(),
  search: z.string().optional(),
  sort_by: z.enum(['name', 'start_date', 'custom_margin_target', 'created_at']).default('created_at').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type GetClientsInput = z.infer<typeof getClientsSchema>;
