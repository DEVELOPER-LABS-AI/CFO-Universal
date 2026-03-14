import { z } from 'zod';

/**
 * Valid reimbursement types matching the Prisma ReimbursementType enum.
 */
const REIMBURSEMENT_TYPES = [
  'TRAVEL', 'MEALS', 'SUPPLIES', 'EQUIPMENT',
  'SOFTWARE', 'PROFESSIONAL_DEV', 'OTHER',
] as const;

/**
 * Schema for creating a new staff reimbursement.
 */
export const createStaffReimbursementSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  reimbursement_type: z.enum(REIMBURSEMENT_TYPES, { message: 'Reimbursement type is required' }),
  amount: z.number()
    .positive('Amount must be greater than 0')
    .min(0.01, 'Amount must be at least $0.01'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional().nullable(),
  receipt_url: z.string().url('Invalid URL').optional().nullable(),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
});

/**
 * Schema for updating an existing staff reimbursement.
 */
export const updateStaffReimbursementSchema = z.object({
  reimbursement_type: z.enum(REIMBURSEMENT_TYPES).optional(),
  amount: z.number().positive('Amount must be greater than 0').min(0.01).optional(),
  description: z.string().max(1000).optional().nullable(),
  receipt_url: z.string().url('Invalid URL').optional().nullable(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

/**
 * Schema for toggling reimbursement approval status.
 */
export const approveReimbursementSchema = z.object({
  reimbursement_id: z.string().uuid('Invalid reimbursement ID'),
  approved: z.boolean(),
});

/**
 * Schema for marking a reimbursement as paid.
 */
export const markReimbursementPaidSchema = z.object({
  reimbursement_id: z.string().uuid('Invalid reimbursement ID'),
  paid: z.boolean(),
});

export type CreateStaffReimbursementInput = z.infer<typeof createStaffReimbursementSchema>;
export type UpdateStaffReimbursementInput = z.infer<typeof updateStaffReimbursementSchema>;
export type ApproveReimbursementInput = z.infer<typeof approveReimbursementSchema>;
export type MarkReimbursementPaidInput = z.infer<typeof markReimbursementPaidSchema>;
