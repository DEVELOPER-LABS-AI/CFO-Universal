import { z } from 'zod';

export const createStaffRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be less than 50 characters')
    .trim()
    .toUpperCase()
    .transform((val) => val.replace(/\s+/g, '_')),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(200, 'Display name must be less than 200 characters')
    .trim(),
});

export const deleteStaffRoleSchema = z.object({
  id: z.string().uuid('Invalid role ID'),
});

export type CreateStaffRoleInput = z.infer<typeof createStaffRoleSchema>;
