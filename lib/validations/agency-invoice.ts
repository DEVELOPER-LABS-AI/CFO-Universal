import { z } from 'zod';

/**
 * Schema for adding a line item to an agency invoice
 */
export const addLineItemSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  type: z.enum(['STAFF_COST', 'BONUS', 'REIMBURSEMENT', 'SERVICE', 'CUSTOM'], {
    message: 'Invalid line item type',
  }),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters').trim(),
  amount: z.number().min(0, 'Amount must be non-negative'),
  staff_id: z.string().uuid('Invalid staff ID').optional().nullable(),
  bonus_id: z.string().uuid('Invalid bonus ID').optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Schema for updating an existing line item
 */
export const updateLineItemSchema = z.object({
  description: z.string().min(1).max(500).trim().optional(),
  amount: z.number().min(0, 'Amount must be non-negative').optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Schema for submitting an invoice for review
 */
export const submitInvoiceSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
});

/**
 * Schema for admin reviewing (approve/reject) an invoice
 */
export const reviewInvoiceSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  action: z.enum(['approve', 'reject'], { message: 'Action must be approve or reject' }),
  comment: z.string().max(1000).trim().optional(),
});

/**
 * Schema for adding a comment to an invoice
 */
export const addCommentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  comment: z.string().min(1, 'Comment is required').max(1000, 'Comment must be less than 1000 characters').trim(),
});

/**
 * Schema for filtering invoices (admin view)
 */
export const getInvoicesFilterSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID']).optional(),
  agency_id: z.string().uuid().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

/**
 * Schema for agency staff management (agency portal)
 */
export const addAgencyStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  staff_type: z.string().min(1, 'Role is required'),
  rate: z.number().min(0, 'Rate must be non-negative'),
  rate_type: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'VARIABLE'], { message: 'Invalid rate type' }),
  engagement_type: z.enum(['FULL_TIME', 'PART_TIME', 'PROJECT', 'AGENCY'], { message: 'Invalid engagement type' }).default('AGENCY'),
});

export const updateAgencyStaffSchema = addAgencyStaffSchema.partial();

/**
 * Schema for agency service management (agency portal)
 */
export const addAgencyServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(200).trim(),
  description: z.string().max(500).trim().optional().nullable(),
  standard_rate: z.number().min(0, 'Rate must be non-negative'),
  billing_type: z.enum(['recurring', 'one_time']).default('recurring'),
  target_margin: z.number().min(0).max(100).default(0),
});

export const updateAgencyServiceSchema = addAgencyServiceSchema.partial();

// Type exports
export type AddLineItemInput = z.infer<typeof addLineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
export type SubmitInvoiceInput = z.infer<typeof submitInvoiceSchema>;
export type ReviewInvoiceInput = z.infer<typeof reviewInvoiceSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type GetInvoicesFilterInput = z.infer<typeof getInvoicesFilterSchema>;
export type AddAgencyStaffInput = z.infer<typeof addAgencyStaffSchema>;
export type UpdateAgencyStaffInput = z.infer<typeof updateAgencyStaffSchema>;
export type AddAgencyServiceInput = z.infer<typeof addAgencyServiceSchema>;
export type UpdateAgencyServiceInput = z.infer<typeof updateAgencyServiceSchema>;
