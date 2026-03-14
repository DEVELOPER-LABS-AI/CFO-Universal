import { z } from 'zod';

// T052: CreateAgencySchema with fields: name, monthly_payment (optional budget), merchant_name, start_date
const agencyBaseSchema = z.object({
  name: z.string().min(1, 'Agency name is required').max(200, 'Name must be less than 200 characters').trim(),
  monthly_payment: z
    .number()
    .positive('Monthly payment must be greater than 0')
    .min(0.01, 'Monthly payment must be at least $0.01')
    .optional()
    .nullable(), // Optional budget target; actual cost derived from Mercury transactions
  merchant_name: z
    .string()
    .max(200, 'Merchant name must be less than 200 characters')
    .trim()
    .optional()
    .nullable(), // Used for auto-matching Mercury transactions to this agency
  start_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()).default(new Date()),
  // Feature 14: Agency markup configuration
  markup_type: z.enum(['PERCENTAGE', 'FLAT_RATE']).optional().nullable(),
  markup_value: z.number().min(0, 'Markup value must be non-negative').optional().nullable(),
  markup_basis: z.enum(['BASE_PAY', 'TOTAL_COMPENSATION']).optional().nullable(),
});

export const createAgencySchema = agencyBaseSchema.refine(
  (data) => {
    // If any markup field is set, markup_type and markup_value must both be set
    const hasType = data.markup_type != null;
    const hasValue = data.markup_value != null;
    if (hasType !== hasValue) return false;
    // If markup_type is null, markup_basis must also be null
    if (!hasType && data.markup_basis != null) return false;
    return true;
  },
  { message: 'Markup type and value must both be set or both be null', path: ['markup_type'] }
);

export const updateAgencySchema = agencyBaseSchema.partial();

// Staff item within the monthly breakdown JSONB
const staffBreakdownItemSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  name: z.string().min(1, 'Staff name is required'),
  role: z.string().min(1, 'Staff role is required'),
  base_pay: z.number().min(0, 'Base pay must be non-negative'),
  expenses: z.number().min(0, 'Expenses must be non-negative').default(0),
  reimbursements: z.number().min(0, 'Reimbursements must be non-negative').default(0),
  notes: z.string().max(500).optional().nullable(),
  subtotal: z.number().min(0, 'Subtotal must be non-negative'), // base_pay + expenses + reimbursements
  true_cost: z.number().min(0, 'True cost must be non-negative').optional().nullable(), // Feature 14
});

// Service item within the monthly breakdown JSONB
const serviceBreakdownItemSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(200),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().min(0, 'Service amount must be non-negative'),
});

// T053: CreateAgencyMonthlyBreakdownSchema with expanded itemized JSONB structure
export const createAgencyMonthlyBreakdownSchema = z.object({
  agency_id: z.string().uuid('Invalid agency ID'),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
  breakdown: z.object({
    staff: z.array(staffBreakdownItemSchema).default([]),
    services: z.array(serviceBreakdownItemSchema).default([]),
  }),
  // breakdown_total and variance are computed server-side; not required from client
});

export const getAgenciesSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
  include_deleted: z.boolean().default(false).optional(),
  sort_by: z.enum(['name', 'monthly_payment', 'start_date', 'created_at']).default('created_at').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const getAgencyBreakdownsSchema = z.object({
  agency_id: z.string().uuid('Invalid agency ID'),
  start_month: z.number().int().min(1).max(12).optional(),
  start_year: z.number().int().min(2000).optional(),
  end_month: z.number().int().min(1).max(12).optional(),
  end_year: z.number().int().min(2000).optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
export type CreateAgencyMonthlyBreakdownInput = z.infer<typeof createAgencyMonthlyBreakdownSchema>;
export type GetAgenciesInput = z.infer<typeof getAgenciesSchema>;
export type GetAgencyBreakdownsInput = z.infer<typeof getAgencyBreakdownsSchema>;
export type StaffBreakdownItem = z.infer<typeof staffBreakdownItemSchema>;
export type ServiceBreakdownItem = z.infer<typeof serviceBreakdownItemSchema>;
