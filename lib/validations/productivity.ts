import { z } from 'zod';

// T054: RecordBDRProductivitySchema with fields: bdr_id, client_id, month, year, meetings_attended
export const recordBDRProductivitySchema = z.object({
  bdr_id: z.string().uuid('Invalid BDR ID'),
  client_id: z.string().uuid('Invalid client ID').nullable().optional(),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
  meetings_attended: z.number().int().min(0, 'Meetings attended must be non-negative'),
});

export const updateBDRProductivitySchema = recordBDRProductivitySchema.partial().required({
  bdr_id: true,
  client_id: true,
  month: true,
  year: true,
});

export const getBDRProductivitySchema = z.object({
  bdr_id: z.string().uuid('Invalid BDR ID').optional(),
  client_id: z.string().uuid('Invalid client ID').optional(),
  start_month: z.number().int().min(1).max(12).optional(),
  start_year: z.number().int().min(2000).optional(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2000).optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type RecordBDRProductivityInput = z.infer<typeof recordBDRProductivitySchema>;
export type UpdateBDRProductivityInput = z.infer<typeof updateBDRProductivitySchema>;
export type GetBDRProductivityInput = z.infer<typeof getBDRProductivitySchema>;
