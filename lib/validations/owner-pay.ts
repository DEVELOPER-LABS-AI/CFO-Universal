/**
 * Zod validation schemas for owner pay tracking.
 */

import { z } from 'zod';

export const refreshOwnerPaySchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const refreshAllOwnerPaySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const getOwnerPayHistorySchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID').optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

export const updateOwnerPayNotesSchema = z.object({
  id: z.string().uuid('Invalid record ID'),
  notes: z.string().max(1000).nullable(),
});

export const setOwnerPayOverrideSchema = z.object({
  id: z.string().uuid('Invalid record ID'),
  override_paid: z.boolean(),
  override_amount: z.number().min(0).nullable(),
  override_note: z.string().max(500).nullable().optional(),
});

export type RefreshOwnerPayInput = z.infer<typeof refreshOwnerPaySchema>;
export type RefreshAllOwnerPayInput = z.infer<typeof refreshAllOwnerPaySchema>;
export type GetOwnerPayHistoryInput = z.infer<typeof getOwnerPayHistorySchema>;
export type UpdateOwnerPayNotesInput = z.infer<typeof updateOwnerPayNotesSchema>;
export type SetOwnerPayOverrideInput = z.infer<typeof setOwnerPayOverrideSchema>;
