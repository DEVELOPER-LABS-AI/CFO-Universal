import { z } from 'zod';

export const createContractorSchema = z.object({
  name: z.string().min(1, 'Contractor name is required').max(200, 'Name must be less than 200 characters').trim(),
  rate: z.number().positive('Rate must be greater than 0').min(0.01, 'Rate must be at least $0.01').nullable().optional(),
  rate_type: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'VARIABLE']).nullable().optional(),
  engagement_type: z.enum(['FULL_TIME', 'PART_TIME', 'PROJECT', 'OWNER', 'AGENCY']).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateContractorSchema = createContractorSchema.partial();

export const createAssignmentSchema = z.object({
  contractor_id: z.string().uuid('Invalid contractor selected'),
  client_id: z.string().uuid('Invalid client selected'),
  start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  end_date: z.union([z.string(), z.date(), z.null()]).pipe(z.coerce.date()).nullable().optional(),
  allocation_percentage: z.number().int('Allocation must be a whole number').min(1, 'Allocation must be at least 1%').max(100, 'Allocation cannot exceed 100%'),
}).refine(
  (data) => !data.end_date || data.end_date >= data.start_date,
  { message: "End date must be after start date", path: ["end_date"] }
);

export type CreateContractorInput = z.infer<typeof createContractorSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
