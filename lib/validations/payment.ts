import { z } from 'zod';

// ============================================================================
// Payment Allocation & Fee Tracking Schemas
// ============================================================================

const PAYMENT_METHODS = ['ACH', 'DOMESTIC_WIRE', 'INTERNATIONAL_WIRE', 'CREDIT_CARD', 'CHECK'] as const;

/**
 * Schema for a single allocation row when linking a deposit.
 */
export const paymentAllocationRowSchema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020).max(2099),
  serviceId: z.string().uuid('Invalid service ID').nullable().optional(),
  amount: z.number().positive('Allocation amount must be positive'),
  description: z.string().max(200).nullable().optional(),
});

/**
 * Enhanced link deposit schema with fee tracking and payment allocations.
 */
export const linkDepositWithAllocationsSchema = z.object({
  mercuryTransactionId: z.string().min(1, 'Mercury transaction ID is required'),
  clientId: z.string().uuid('Invalid client ID'),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  grossAmount: z.number().positive('Gross amount must be positive').nullable().optional(),
  feeAmount: z.number().min(0, 'Fee amount cannot be negative').default(0),
  feePercentage: z.number().min(0).max(1, 'Fee percentage must be between 0 and 1').nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  allocations: z.array(paymentAllocationRowSchema)
    .min(1, 'At least one allocation is required'),
}).refine(
  (data) => {
    // Allocation amounts will be validated against net amount in the service layer
    // since the net amount comes from the Mercury transaction, not the form
    return true;
  }
);

/**
 * Schema for updating org-level fee defaults.
 */
export const updateFeeDefaultsSchema = z.object({
  defaults: z.array(z.object({
    paymentMethod: z.enum(PAYMENT_METHODS),
    feePercentage: z.number().min(0, 'Fee cannot be negative').max(0.5, 'Fee cannot exceed 50%'),
  })).min(1, 'At least one default is required'),
});

/**
 * Schema for updating service coverage settings.
 */
export const updateServiceCoverageSettingsSchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(365),
  warningDays: z.number().int().min(0).max(90),
});

/**
 * Schema for updating allocations on an existing linked deposit.
 */
export const updateAllocationsSchema = z.object({
  receiptId: z.string().uuid('Invalid receipt ID'),
  allocations: z.array(paymentAllocationRowSchema).min(1, 'At least one allocation is required'),
});

export type PaymentAllocationRow = z.infer<typeof paymentAllocationRowSchema>;
export type LinkDepositWithAllocationsInput = z.infer<typeof linkDepositWithAllocationsSchema>;
export type UpdateFeeDefaultsInput = z.infer<typeof updateFeeDefaultsSchema>;
export type UpdateServiceCoverageSettingsInput = z.infer<typeof updateServiceCoverageSettingsSchema>;
export type UpdateAllocationsInput = z.infer<typeof updateAllocationsSchema>;
