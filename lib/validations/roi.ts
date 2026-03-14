import { z } from 'zod';

// T055: RefreshClientROISchema and RefreshBDRROISchema with fields: id, month, year
export const refreshClientROISchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
});

export const refreshBDRROISchema = z.object({
  bdr_id: z.string().uuid('Invalid BDR ID'),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
});

export const getClientROISchema = z.object({
  client_id: z.string().uuid('Invalid client ID').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED', 'CUSTOM']).optional(),
  search: z.string().optional(),
  start_month: z.number().int().min(1).max(12).optional(),
  start_year: z.number().int().min(2000).optional(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2000).optional(),
  min_roi: z.number().optional(),
  max_roi: z.number().optional(),
  min_margin: z.number().min(0).max(100).optional(),
  max_margin: z.number().min(0).max(100).optional(),
  sort_by: z.enum(['roi_percentage', 'margin_percentage', 'profit', 'revenue', 'total_costs']).default('roi_percentage').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const getBDRROISchema = z.object({
  bdr_id: z.string().uuid('Invalid BDR ID').optional(),
  start_month: z.number().int().min(1).max(12).optional(),
  start_year: z.number().int().min(2000).optional(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2000).optional(),
  min_roi: z.number().optional(),
  max_roi: z.number().optional(),
  min_margin: z.number().min(0).max(100).optional(),
  max_margin: z.number().min(0).max(100).optional(),
  sort_by: z.enum(['roi_percentage', 'margin_percentage', 'profit', 'revenue_attributed']).default('roi_percentage').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type RefreshClientROIInput = z.infer<typeof refreshClientROISchema>;
export type RefreshBDRROIInput = z.infer<typeof refreshBDRROISchema>;
export type GetClientROIInput = z.infer<typeof getClientROISchema>;
export type GetBDRROIInput = z.infer<typeof getBDRROISchema>;
