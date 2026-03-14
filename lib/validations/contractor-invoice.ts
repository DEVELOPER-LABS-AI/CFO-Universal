import { z } from 'zod';

/**
 * Zod validation schemas for Contractor Payment Portal
 */

// ============================================================================
// Line Item Schemas
// ============================================================================

export const addContractorLineItemSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  type: z.enum(['REIMBURSEMENT', 'BONUS', 'OTHER'], {
    message: 'Invalid line item type',
  }),
  description: z.string().min(2, 'Description must be at least 2 characters').max(500).trim(),
  amount: z.number().positive('Amount must be greater than 0'),
});

export const updateContractorLineItemSchema = z.object({
  type: z.enum(['REIMBURSEMENT', 'BONUS', 'OTHER']).optional(),
  description: z.string().min(2).max(500).trim().optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
});

// ============================================================================
// Invoice Schemas
// ============================================================================

export const getOrCreateDraftInvoiceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
});

export const submitContractorInvoiceSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
});

// ============================================================================
// Document Schemas
// ============================================================================

const MAX_FILE_SIZE = 10_485_760; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const;

export const uploadDocumentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  document_type: z.enum(['SOW', 'INVOICE', 'TAX_FORM', 'OTHER'], {
    message: 'Invalid document type',
  }),
});

export const documentFileValidation = {
  maxSize: MAX_FILE_SIZE,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
};

// ============================================================================
// Admin Review Schemas
// ============================================================================

export const reviewContractorInvoiceSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  action: z.enum(['approve', 'reject'], { message: 'Action must be approve or reject' }),
  rejection_reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(1000).trim().optional(),
}).refine(
  (d) => d.action !== 'reject' || d.rejection_reason,
  { message: 'Rejection reason is required when rejecting', path: ['rejection_reason'] }
);

export const getContractorInvoicesFilterSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID']).optional(),
  contractor_id: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2024).max(2100).optional(),
}).optional();

// ============================================================================
// Settings Schemas
// ============================================================================

export const updateGlobalContractorSettingsSchema = z.object({
  contractor_reminder_day: z.number().int().min(1).max(28),
  contractor_default_doc_types: z.array(z.enum(['SOW', 'INVOICE', 'TAX_FORM', 'OTHER'])),
});

export const updateContractorPortalSettingsSchema = z.object({
  reminder_day_override: z.number().int().min(1).max(28).nullable(),
  reminder_enabled: z.boolean(),
  required_doc_types: z.array(z.enum(['SOW', 'INVOICE', 'TAX_FORM', 'OTHER'])),
});

// ============================================================================
// Invitation Schema
// ============================================================================

export const inviteContractorSchema = z.object({
  contractor_id: z.string().uuid('Invalid contractor ID'),
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(200).trim(),
});

// ============================================================================
// Payment Schemas
// ============================================================================

export const initiatePaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  payment_method: z.enum(['ACH', 'DOMESTIC_WIRE', 'INTERNATIONAL_WIRE'], {
    message: 'Invalid payment method',
  }),
});

// ============================================================================
// Mercury Recipient Schemas
// ============================================================================

export const linkMercuryRecipientSchema = z.object({
  contractor_id: z.string().uuid('Invalid contractor ID'),
  recipient_id: z.string().min(1, 'Recipient ID is required'),
});

export const createMercuryRecipientSchema = z.object({
  contractor_id: z.string().uuid('Invalid contractor ID'),
  name: z.string().min(1, 'Name is required'),
  emails: z.array(z.string().email()).optional(),
  defaultPaymentMethod: z.enum(['ach', 'domesticWire', 'internationalWire']),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AddContractorLineItemInput = z.infer<typeof addContractorLineItemSchema>;
export type UpdateContractorLineItemInput = z.infer<typeof updateContractorLineItemSchema>;
export type GetOrCreateDraftInvoiceInput = z.infer<typeof getOrCreateDraftInvoiceSchema>;
export type SubmitContractorInvoiceInput = z.infer<typeof submitContractorInvoiceSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ReviewContractorInvoiceInput = z.infer<typeof reviewContractorInvoiceSchema>;
export type GetContractorInvoicesFilterInput = z.infer<typeof getContractorInvoicesFilterSchema>;
export type UpdateGlobalContractorSettingsInput = z.infer<typeof updateGlobalContractorSettingsSchema>;
export type UpdateContractorPortalSettingsInput = z.infer<typeof updateContractorPortalSettingsSchema>;
export type InviteContractorInput = z.infer<typeof inviteContractorSchema>;
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type LinkMercuryRecipientInput = z.infer<typeof linkMercuryRecipientSchema>;
export type CreateMercuryRecipientInput = z.infer<typeof createMercuryRecipientSchema>;
