import { z } from 'zod';

/**
 * Valid base metrics matching the Prisma BDRBaseMetric enum.
 */
const BDR_BASE_METRICS = ['MEETINGS_BOOKED', 'MEETINGS_SHOWED'] as const;

/**
 * Tier schema for pay plan creation/update.
 */
const tierSchema = z.object({
  min_threshold: z.number().int().min(1, 'Min threshold must be at least 1'),
  max_threshold: z.number().int().min(1).optional().nullable(),
  payout_rate: z.number().positive('Payout rate must be greater than 0'),
});

/**
 * Schema for creating a new BDR pay plan.
 */
export const createPayPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  base_metric: z.enum(BDR_BASE_METRICS, { message: 'Base metric is required' }),
  effective_start: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  effective_end: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date').optional(),
  tiers: z.array(tierSchema).min(1, 'At least one tier is required'),
});

/**
 * Schema for updating an existing BDR pay plan.
 */
export const updatePayPlanSchema = z.object({
  id: z.string().uuid('Invalid pay plan ID'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  base_metric: z.enum(BDR_BASE_METRICS).optional(),
  effective_end: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date').optional().nullable(),
  tiers: z.array(tierSchema).min(1).optional(),
});

/**
 * Schema for assigning a pay plan to a BDR.
 */
export const assignPayPlanSchema = z.object({
  pay_plan_id: z.string().uuid('Invalid pay plan ID'),
  staff_id: z.string().uuid('Invalid staff ID'),
  effective_from: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
});

export type CreatePayPlanInput = z.infer<typeof createPayPlanSchema>;
export type UpdatePayPlanInput = z.infer<typeof updatePayPlanSchema>;
export type AssignPayPlanInput = z.infer<typeof assignPayPlanSchema>;
