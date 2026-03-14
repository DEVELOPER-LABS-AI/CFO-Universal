import { z } from 'zod';

/**
 * Valid bonus types matching the Prisma BonusType enum.
 */
const BONUS_TYPES = [
  'PERFORMANCE', 'SIGNING', 'REFERRAL', 'RETENTION',
  'QUARTERLY', 'ANNUAL', 'SPOT', 'OTHER',
] as const;

/**
 * Schema for creating a new staff bonus.
 */
export const createStaffBonusSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  bonus_type: z.enum(BONUS_TYPES, { message: 'Bonus type is required' }),
  amount: z.number()
    .positive('Amount must be greater than 0')
    .min(0.01, 'Amount must be at least $0.01'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional().nullable(),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
  year: z.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year must be before 2100'),
});

/**
 * Schema for updating an existing staff bonus.
 */
export const updateStaffBonusSchema = z.object({
  bonus_type: z.enum(BONUS_TYPES).optional(),
  amount: z.number().positive('Amount must be greater than 0').min(0.01).optional(),
  description: z.string().max(1000).optional().nullable(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

/**
 * Schema for toggling bonus approval status.
 */
export const approveBonusSchema = z.object({
  bonus_id: z.string().uuid('Invalid bonus ID'),
  approved: z.boolean(),
});

/**
 * Schema for marking a bonus as paid.
 */
export const markBonusPaidSchema = z.object({
  bonus_id: z.string().uuid('Invalid bonus ID'),
  paid: z.boolean(),
});

export type CreateStaffBonusInput = z.infer<typeof createStaffBonusSchema>;
export type UpdateStaffBonusInput = z.infer<typeof updateStaffBonusSchema>;
export type ApproveBonusInput = z.infer<typeof approveBonusSchema>;
export type MarkBonusPaidInput = z.infer<typeof markBonusPaidSchema>;
