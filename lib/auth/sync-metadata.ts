import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'

/**
 * Sync user role from database to JWT app_metadata
 *
 * This ensures the JWT token contains the latest role information
 * for fast middleware checks without database queries.
 *
 * Called automatically on login to keep JWT and database in sync.
 *
 * @param userId - Supabase auth.users.id
 * @throws {Error} If user profile not found
 *
 * @example
 * // In login Server Action
 * await syncRoleToJWT(user.id)
 */
export async function syncRoleToJWT(userId: string): Promise<void> {
  // Fetch current role from database (source of truth)
  const profile = await prisma.userProfile.findUnique({
    where: { user_id: userId },
    select: {
      role: true,
      status: true,
    },
  })

  if (!profile) {
    throw new Error('User profile not found')
  }

  // Update Supabase Auth user metadata with current role
  // This will be included in the JWT token on next refresh
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: profile.role,
      status: profile.status,
    },
  })
}

/**
 * Update last login timestamp for user
 *
 * Called on successful login to track user activity.
 *
 * @param userId - Supabase auth.users.id
 *
 * @example
 * await updateLastLogin(user.id)
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await prisma.userProfile.update({
    where: { user_id: userId },
    data: { last_login: new Date() },
  })
}
