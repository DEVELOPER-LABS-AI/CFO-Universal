import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

/**
 * Get the current authenticated user
 * Cached for the duration of the request to avoid multiple calls
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Get the current session
 * Cached for the duration of the request
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
})

/**
 * Require authentication - throws if user is not authenticated
 * Use in Server Components to protect routes
 */
export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Get user with profile data
 */
export async function getUserWithProfile() {
  const user = await getUser()
  if (!user) return null

  // TODO: Fetch user profile from user_profiles table
  // This will be implemented after the user_profiles migration
  return {
    ...user,
    profile: null,
  }
}
