import { z } from 'zod';

// ============================================================================
// Share Class Schemas
// ============================================================================

export const createShareClassSchema = z.object({
  name: z.string().min(1, 'Share class name is required').max(100, 'Name must be less than 100 characters').trim(),
  authorized_shares: z.number().int('Must be a whole number').positive('Must be greater than 0'),
  reserved_shares: z.number().int('Must be a whole number').min(0, 'Cannot be negative').default(0),
  price_per_share: z.number().min(0, 'Price must be non-negative').optional().nullable(),
});

export const updateShareClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).trim().optional(),
  authorized_shares: z.number().int().positive().optional(),
  reserved_shares: z.number().int().min(0).optional(),
  price_per_share: z.number().min(0).optional().nullable(),
});

// ============================================================================
// Stakeholder Schemas
// ============================================================================

export const createStakeholderSchema = z.object({
  name: z.string().min(1, 'Stakeholder name is required').max(200, 'Name must be less than 200 characters').trim(),
  email: z.string().email('Invalid email format').max(255).optional().nullable(),
  role_title: z.string().max(100, 'Role must be less than 100 characters').trim().optional().nullable(),
});

export const updateStakeholderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(255).optional().nullable(),
  role_title: z.string().max(100).trim().optional().nullable(),
});

export const removeStakeholderSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Transaction Schema
// ============================================================================

export const recordTransactionSchema = z.object({
  transaction_type: z.enum(['GRANT', 'TRANSFER', 'PURCHASE', 'CANCELLATION']),
  transaction_date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
  share_class_id: z.string().uuid(),
  from_stakeholder_id: z.string().uuid().optional().nullable(),
  to_stakeholder_id: z.string().uuid().optional().nullable(),
  shares_affected: z.number().int('Must be a whole number').positive('Must be greater than 0'),
  price_per_share: z.number().min(0, 'Price must be non-negative').optional().nullable(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional().nullable(),
}).superRefine((data, ctx) => {
  if (['GRANT', 'PURCHASE'].includes(data.transaction_type) && !data.to_stakeholder_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Recipient stakeholder is required for Grant/Purchase transactions',
      path: ['to_stakeholder_id'],
    });
  }
  if (data.transaction_type === 'TRANSFER') {
    if (!data.from_stakeholder_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Source stakeholder is required for Transfer transactions',
        path: ['from_stakeholder_id'],
      });
    }
    if (!data.to_stakeholder_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Recipient stakeholder is required for Transfer transactions',
        path: ['to_stakeholder_id'],
      });
    }
  }
  if (data.transaction_type === 'CANCELLATION' && !data.from_stakeholder_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Source stakeholder is required for Cancellation transactions',
      path: ['from_stakeholder_id'],
    });
  }
});

// ============================================================================
// Sharing & Query Schemas
// ============================================================================

export const generateShareLinkSchema = z.object({
  expires_in_days: z.number().int().min(1, 'Minimum 1 day').max(365, 'Maximum 365 days').default(30),
});

export const asOfDateSchema = z.object({
  date: z.union([z.string(), z.date()]).pipe(z.coerce.date()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateShareClassInput = z.infer<typeof createShareClassSchema>;
export type UpdateShareClassInput = z.infer<typeof updateShareClassSchema>;
export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;
export type RemoveStakeholderInput = z.infer<typeof removeStakeholderSchema>;
export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>;
export type GenerateShareLinkInput = z.infer<typeof generateShareLinkSchema>;
export type AsOfDateInput = z.infer<typeof asOfDateSchema>;
