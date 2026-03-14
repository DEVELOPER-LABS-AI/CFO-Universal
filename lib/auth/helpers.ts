import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { UserRole, UserStatus } from '@prisma/client'

/**
 * Authenticated user with profile data
 */
export interface AuthUser {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
  fullName: string
  agencyId?: string
  contractorId?: string
  bdrStaffId?: string
}

/**
 * Get current authenticated user with profile data.
 * Returns null if not authenticated or no profile exists (uninvited user).
 *
 * @example
 * const user = await getCurrentUser()
 * if (!user) return redirect('/login')
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  // Fetch user profile from database (single organization)
  const profile = await prisma.userProfile.findUnique({
    where: { user_id: user.id },
    select: {
      full_name: true,
      role: true,
      status: true,
      agency_id: true,
      contractor_id: true,
      bdr_staff_id: true,
    },
  })

  // No profile means user was not invited — deny access
  if (!profile) return null

  return {
    userId: user.id,
    email: user.email!,
    role: profile.role || 'EXECUTIVE',
    status: profile.status || 'ACTIVE',
    fullName: profile.full_name,
    agencyId: profile.agency_id ?? undefined,
    contractorId: profile.contractor_id ?? undefined,
    bdrStaffId: profile.bdr_staff_id ?? undefined,
  }
}

/**
 * Check if current user has admin role and is active
 *
 * @example
 * if (await isAdmin()) {
 *   // Show admin UI
 * }
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' && user?.status === 'ACTIVE'
}

/**
 * Require authentication - throw if not authenticated or inactive
 * Use in Server Components and Server Actions to protect routes
 *
 * @throws {Error} If user is not authenticated or account is inactive
 *
 * @example
 * export default async function DashboardPage() {
 *   const user = await requireAuth()
 *   return <Dashboard user={user} />
 * }
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('Account inactive')
  }

  return user
}

/**
 * Require admin role - throw if not admin or inactive
 * Use in admin-only Server Components and Server Actions
 *
 * @throws {Error} If user is not authenticated, not admin, or account is inactive
 *
 * @example
 * export async function deleteUser(userId: string) {
 *   const admin = await requireAdmin()
 *   // Perform admin operation
 * }
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden - admin access required')
  }

  return user
}

/**
 * Require agency admin role - throw if not agency admin, inactive, or missing agency link
 * Use in agency portal Server Components and Server Actions
 *
 * @throws {Error} If user is not authenticated, not agency admin, or has no agency linked
 *
 * @returns AuthUser with guaranteed agencyId
 */
export async function requireAgencyAdmin(): Promise<AuthUser & { agencyId: string }> {
  const user = await requireAuth()

  if (user.role !== 'AGENCY_ADMIN') {
    throw new Error('Forbidden - agency admin access required')
  }

  if (!user.agencyId) {
    throw new Error('No agency linked to this account. Contact administrator.')
  }

  return user as AuthUser & { agencyId: string }
}

/**
 * Require contractor role - throw if not contractor, inactive, or missing contractor link
 * Use in contractor portal Server Components and Server Actions
 *
 * @throws {Error} If user is not authenticated, not contractor, or has no contractor linked
 *
 * @returns AuthUser with guaranteed contractorId
 */
export async function requireContractor(): Promise<AuthUser & { contractorId: string }> {
  const user = await requireAuth()

  if (user.role !== 'CONTRACTOR') {
    throw new Error('Forbidden - contractor access required')
  }

  if (!user.contractorId) {
    throw new Error('No contractor profile linked to this account. Contact administrator.')
  }

  return user as AuthUser & { contractorId: string }
}

/**
 * Require admin or executive role - throw if neither
 * Use in endpoints that need elevated but not strictly admin access
 *
 * @throws {Error} If user is not authenticated, inactive, or lacks admin/executive role
 */
export async function requireAdminOrExecutive(): Promise<AuthUser> {
  const user = await requireAuth()

  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    throw new Error('Forbidden - admin or executive access required')
  }

  return user
}

/**
 * Require BDR role - throw if not BDR, inactive, or missing BDR staff link
 * Use in BDR portal Server Components and Server Actions
 *
 * @throws {Error} If user is not authenticated, not BDR, or has no BDR staff linked
 *
 * @returns AuthUser with guaranteed bdrStaffId
 */
export async function requireBDR(): Promise<AuthUser & { bdrStaffId: string }> {
  const user = await requireAuth()

  if (user.role !== 'BDR') {
    throw new Error('Forbidden - BDR access required')
  }

  if (!user.bdrStaffId) {
    throw new Error('No BDR staff profile linked to this account. Contact administrator.')
  }

  return user as AuthUser & { bdrStaffId: string }
}
