import { z } from 'zod';

// T049: CreateSubscriptionSchema with fields: name, total_cost, total_seats, billing_frequency
export const createSubscriptionSchema = z.object({
  name: z.string().min(1, 'Subscription name is required').max(200, 'Name must be less than 200 characters').trim(),
  total_cost: z.number().min(0, 'Total cost cannot be negative'),
  total_seats: z.number().int().positive('Total seats must be a positive integer').nullable().optional(),
  billing_frequency: z.string().min(1, 'Billing frequency is required').max(50),
  is_active: z.boolean().default(true),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

// T050: CreateSubscriptionAllocationSchema with hybrid allocation support
// T051: Add custom validators: XOR(client_id, staff_id), allocation type validation
export const createSubscriptionAllocationSchema = z.object({
  subscription_id: z.string().uuid('Invalid subscription ID'),
  client_id: z.string().uuid('Invalid client ID').nullable().optional(),
  staff_id: z.string().uuid('Invalid staff ID').nullable().optional(),
  allocation_type: z.enum(['SEAT_BASED', 'PERCENTAGE_BASED'], {
    message: 'Allocation type is required',
  }),
  seats_allocated: z.number().int().positive('Seats allocated must be a positive integer').nullable().optional(),
  percentage_allocated: z.number()
    .min(0, 'Percentage must be at least 0')
    .max(100, 'Percentage cannot exceed 100')
    .nullable()
    .optional(),
  cost_allocated: z.number().positive('Cost allocated must be greater than 0').min(0.01),
}).refine(
  (data) => {
    // XOR: Either client_id or staff_id must be provided, but not both
    const hasClient = data.client_id != null && data.client_id.trim().length > 0;
    const hasStaff = data.staff_id != null && data.staff_id.trim().length > 0;
    return (hasClient && !hasStaff) || (!hasClient && hasStaff);
  },
  {
    message: 'Must allocate to either a client or a staff member, not both',
    path: ['client_id'],
  }
).refine(
  (data) => {
    // If SEAT_BASED, seats_allocated is required
    if (data.allocation_type === 'SEAT_BASED') {
      return data.seats_allocated != null && data.seats_allocated > 0;
    }
    return true;
  },
  {
    message: 'Seats allocated is required for seat-based allocation',
    path: ['seats_allocated'],
  }
).refine(
  (data) => {
    // If PERCENTAGE_BASED, percentage_allocated is required
    if (data.allocation_type === 'PERCENTAGE_BASED') {
      return data.percentage_allocated != null && data.percentage_allocated > 0;
    }
    return true;
  },
  {
    message: 'Percentage allocated is required for percentage-based allocation',
    path: ['percentage_allocated'],
  }
);

export const getSubscriptionsSchema = z.object({
  page: z.number().int().positive().default(1).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
  is_active: z.boolean().optional(),
  sort_by: z.enum(['name', 'total_cost', 'created_at']).default('created_at').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
  period_month: z.number().int().min(1).max(12).optional(),
  period_year: z.number().int().min(2020).max(2099).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateSubscriptionAllocationInput = z.infer<typeof createSubscriptionAllocationSchema>;
export type GetSubscriptionsInput = z.infer<typeof getSubscriptionsSchema>;

// ============================================================================
// Feature: Dynamic Cost Sync — Merchant Mapping Schemas (T015)
// ============================================================================

export const mapSubscriptionMerchantSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  merchantName: z.string().min(1, 'Merchant name is required').max(500).trim(),
  matchType: z.enum(['EXACT', 'FUZZY_KEYWORD']).default('EXACT'),
});

export const linkDepositSchema = z.object({
  mercuryTransactionId: z.string().min(1, 'Mercury transaction ID is required'),
  clientId: z.string().uuid('Invalid client ID'),
});

export const trendQuerySchema = z.object({
  historyMonths: z.coerce.number().int().min(1).max(24).default(3).optional(),
});

export const transactionQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2099).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});

export type MapSubscriptionMerchantInput = z.infer<typeof mapSubscriptionMerchantSchema>;
export type LinkDepositInput = z.infer<typeof linkDepositSchema>;
export type TrendQueryInput = z.infer<typeof trendQuerySchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
