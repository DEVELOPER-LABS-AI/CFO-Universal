import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(200, 'Name must be less than 200 characters').trim(),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters').trim(),
  standard_rate: z.number().positive('Rate must be greater than 0').min(0.01, 'Rate must be at least $0.01'),
  billing_type: z.enum(['recurring', 'one_time']),
  target_margin: z.number().min(0, 'Margin must be positive').max(100, 'Margin cannot exceed 100%'),
  is_active: z.boolean(),
});

export const updateServiceSchema = createServiceSchema.partial();

// T045: AssignServiceSchema with fields: client_id, service_id, custom_rate
export const assignServiceSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  service_id: z.string().uuid('Invalid service ID'),
  custom_rate: z.number().positive('Custom rate must be greater than 0').optional(),
});

export const updateClientServiceRateSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  service_id: z.string().uuid('Invalid service ID'),
  custom_rate: z.number().positive('Custom rate must be greater than 0').nullable(),
  effective_month: z.number().int().min(1).max(12).optional(),
  effective_year: z.number().int().min(2020).max(2099).optional(),
});

/**
 * Schema for setting a historical rate entry (backdating or correcting rate history).
 */
export const setServiceRateHistorySchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  service_id: z.string().uuid('Invalid service ID'),
  rate: z.number().min(0, 'Rate cannot be negative'),
  effective_month: z.number().int().min(1).max(12),
  effective_year: z.number().int().min(2020).max(2099),
});

// Feature 9: Service Contracts & Billing Models

/**
 * Helper: compare month/year pairs. Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareMonthYear(aMonth: number, aYear: number, bMonth: number, bYear: number): number {
  if (aYear !== bYear) return aYear < bYear ? -1 : 1;
  if (aMonth !== bMonth) return aMonth < bMonth ? -1 : 1;
  return 0;
}

/**
 * Schema for creating a new service contract.
 * Uses superRefine for billing-model-specific conditional validation.
 */
export const createServiceContractSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  service_id: z.string().uuid('Invalid service ID'),
  billing_model: z.enum(['CONTRACT', 'PROJECT', 'RETAINER']),
  start_month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  start_year: z.number().int().min(2020, 'Year must be 2020+').max(2099),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2020).max(2099).optional(),
  monthly_rate: z.number().min(0, 'Rate cannot be negative').optional(),
  project_fee: z.number().positive('Project fee must be greater than 0').optional(),
  notes: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.billing_model === 'CONTRACT') {
    if (data.monthly_rate === undefined || data.monthly_rate === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Monthly rate is required for Contract', path: ['monthly_rate'] });
    }
    if (!data.end_month || !data.end_year) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date is required for Contract', path: ['end_month'] });
    } else if (compareMonthYear(data.end_month, data.end_year, data.start_month, data.start_year) < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be on or after start date', path: ['end_month'] });
    }
  }

  if (data.billing_model === 'PROJECT') {
    if (!data.project_fee) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project fee is required', path: ['project_fee'] });
    }
  }

  if (data.billing_model === 'RETAINER') {
    if (data.monthly_rate === undefined || data.monthly_rate === null || data.monthly_rate <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Monthly rate must be greater than 0 for Retainer', path: ['monthly_rate'] });
    }
    // End date is optional for retainers, but if provided must be >= start
    if (data.end_month && data.end_year) {
      if (compareMonthYear(data.end_month, data.end_year, data.start_month, data.start_year) < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be on or after start date', path: ['end_month'] });
      }
    }
  }
});

/**
 * Schema for updating a service contract.
 * Only end_month/end_year/notes can be changed. Rate changes require terminate + create new.
 */
export const updateServiceContractSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2020).max(2099).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Schema for terminating a service contract.
 */
export const terminateServiceContractSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  end_month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  end_year: z.number().int().min(2020, 'Year must be 2020+').max(2099),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type AssignServiceInput = z.infer<typeof assignServiceSchema>;
export type UpdateClientServiceRateInput = z.infer<typeof updateClientServiceRateSchema>;
export type SetServiceRateHistoryInput = z.infer<typeof setServiceRateHistorySchema>;
export type CreateServiceContractInput = z.infer<typeof createServiceContractSchema>;
export type UpdateServiceContractInput = z.infer<typeof updateServiceContractSchema>;
export type TerminateServiceContractInput = z.infer<typeof terminateServiceContractSchema>;
