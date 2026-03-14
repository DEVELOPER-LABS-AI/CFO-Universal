import { z } from 'zod';

/**
 * Valid BDR expense statuses matching the Prisma BDRExpenseStatus enum.
 */
const BDR_EXPENSE_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED'] as const;

/**
 * Schema for creating a BDR expense claim.
 * Note: receipt file is handled via FormData, not this schema.
 */
export const createBDRExpenseSchema = z.object({
  expense_date: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, 'Expense date must be a valid date and not in the future'),
  category_id: z.string().uuid('Invalid category ID'),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
});

/**
 * Schema for listing BDR expenses with optional filters.
 */
export const getBDRExpensesSchema = z.object({
  status: z.enum(BDR_EXPENSE_STATUSES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/**
 * Schema for approving a BDR expense.
 */
export const approveExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
  admin_notes: z.string().max(500).optional(),
});

/**
 * Schema for rejecting a BDR expense (admin_notes required).
 */
export const rejectExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
  admin_notes: z.string().min(1, 'Rejection reason is required').max(500, 'Reason must be less than 500 characters'),
});

/**
 * Schema for marking a BDR expense as reimbursed.
 */
export const markExpenseReimbursedSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID'),
});

/**
 * Schema for managing expense categories (create or update).
 */
export const manageExpenseCategorySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    description: z.string().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().uuid('Invalid category ID'),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
]);

export type CreateBDRExpenseInput = z.infer<typeof createBDRExpenseSchema>;
export type GetBDRExpensesInput = z.infer<typeof getBDRExpensesSchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type ManageExpenseCategoryInput = z.infer<typeof manageExpenseCategorySchema>;
