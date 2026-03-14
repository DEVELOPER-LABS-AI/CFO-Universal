'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { loginSchema } from '@/lib/validations/auth'

/**
 * Send magic link to user's email for passwordless login
 */
export async function sendMagicLink(email: string) {
  try {
    // Validate input
    const validatedData = loginSchema.parse({ email })

    // Create Supabase client
    const supabase = await createClient()

    // Send magic link via Supabase OTP
    const { error } = await supabase.auth.signInWithOtp({
      email: validatedData.email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (error) {
      console.error('Magic link error:', error)
      return {
        success: false,
        error: `Failed to send login link: ${error.message}`,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Send magic link error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

/**
 * Logout user
 */
export async function logoutUser() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

