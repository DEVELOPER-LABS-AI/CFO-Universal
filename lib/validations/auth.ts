import { z } from 'zod'

/**
 * Magic link login validation schema (email only)
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Strong password schema for creation and reset flows.
 * Requires min 8 chars, uppercase, lowercase, and number.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')

/**
 * Password reset validation schema
 */
export const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

