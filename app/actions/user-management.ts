'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit/logger'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { UserRole } from '@prisma/client'

/**
 * Validation schema for inviting a new user
 */
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN', 'CONTRACTOR', 'BDR'], {
    message: 'Invalid role',
  }),
  agency_id: z.string().uuid('Invalid agency ID').optional().nullable(),
  contractor_id: z.string().optional().nullable(),
  bdr_staff_id: z.string().uuid('Invalid BDR staff ID').optional().nullable(),
}).refine(
  (data) => {
    if (data.role === 'AGENCY_ADMIN' && !data.agency_id) {
      return false
    }
    return true
  },
  { message: 'Agency is required for Agency Admin role', path: ['agency_id'] }
).refine(
  (data) => {
    if (data.role === 'CONTRACTOR' && !data.contractor_id) {
      return false
    }
    return true
  },
  { message: 'Contractor is required for Contractor role', path: ['contractor_id'] }
).refine(
  (data) => {
    if (data.role === 'BDR' && !data.bdr_staff_id) {
      return false
    }
    return true
  },
  { message: 'BDR staff member is required for BDR role', path: ['bdr_staff_id'] }
)

export type InviteUserInput = z.infer<typeof inviteUserSchema>

/**
 * Invite a new user to the platform
 *
 * Creates user in Supabase Auth, user_profiles, generates magic link,
 * and sends invitation email.
 *
 * @param input - User details (email, full_name, role)
 * @returns Success response with user data or error
 */
export async function inviteUser(input: InviteUserInput) {
  try {
    // Require admin authorization
    const admin = await requireAdmin()

    // Validate input
    const validatedData = inviteUserSchema.parse(input)

    // Check if user already exists in Supabase Auth
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUser.users.find(
      (u) => u.email === validatedData.email
    )

    let authUserId: string

    if (existingAuthUser) {
      // User exists in Auth — check if they also have a profile
      const existingProfile = await prisma.userProfile.findUnique({
        where: { user_id: existingAuthUser.id },
      })

      if (existingProfile) {
        // Both Auth and profile exist — true duplicate
        return {
          success: false,
          error: 'A user with this email already exists',
        }
      }

      // Orphaned Auth user (no profile) — recover by creating the profile
      authUserId = existingAuthUser.id

      // Update auth user metadata with the new name
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        user_metadata: { full_name: validatedData.full_name },
        ban_duration: 'none', // Unban in case they were previously banned
      })
    } else {
      // No Auth user — create one
      const { data: authUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: validatedData.email,
          email_confirm: true,
          user_metadata: {
            full_name: validatedData.full_name,
          },
        })

      if (createError || !authUser.user) {
        console.error('Failed to create user in Supabase Auth:', createError)
        return {
          success: false,
          error: 'Failed to create user account',
        }
      }

      authUserId = authUser.user.id
    }

    // Generate magic link for invitation
    const { data: magicLinkData, error: magicLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: validatedData.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/invite-accept`,
        },
      })

    if (magicLinkError || !magicLinkData) {
      console.error('Failed to generate magic link:', magicLinkError)
      // Only clean up if we just created the auth user (not an orphan recovery)
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      }
      return {
        success: false,
        error: 'Failed to generate invitation link',
      }
    }

    // Generate invite token for tracking
    const inviteToken = crypto.randomUUID()
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user profile with INACTIVE status
    await prisma.userProfile.create({
      data: {
        user_id: authUserId,
        full_name: validatedData.full_name,
        role: validatedData.role as UserRole,
        status: 'INACTIVE',
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        agency_id: validatedData.role === 'AGENCY_ADMIN' ? validatedData.agency_id : null,
        contractor_id: validatedData.role === 'CONTRACTOR' ? validatedData.contractor_id : null,
        bdr_staff_id: validatedData.role === 'BDR' ? validatedData.bdr_staff_id : null,
      },
    })

    // Link user to admin's organization
    const adminOrg = await prisma.userOrganization.findFirst({
      where: { user_id: admin.userId },
      select: { organization_id: true },
    })

    if (adminOrg) {
      // Upsert to avoid duplicate if org link already exists from a previous partial setup
      await prisma.userOrganization.upsert({
        where: {
          user_id_organization_id: {
            user_id: authUserId,
            organization_id: adminOrg.organization_id,
          },
        },
        update: { role: 'member' },
        create: {
          user_id: authUserId,
          organization_id: adminOrg.organization_id,
          role: 'member',
        },
      })
    }

    // Create audit log entry
    const isRecovery = !!existingAuthUser
    await createAuditLog({
      actorId: admin.userId,
      targetUserId: authUserId,
      actionType: isRecovery ? 'USER_PROFILE_RECOVERED' : 'USER_CREATED',
      actionDetails: {
        email: validatedData.email,
        full_name: validatedData.full_name,
        role: validatedData.role,
        invited_by: admin.email,
        ...(isRecovery && { note: 'Profile created for existing auth user (orphan recovery)' }),
      },
    })

    return {
      success: true,
      data: {
        userId: authUserId,
        email: validatedData.email,
        full_name: validatedData.full_name,
        role: validatedData.role,
        magic_link: magicLinkData.properties.action_link,
      },
      message: isRecovery
        ? 'User profile recovered and invitation sent.'
        : 'User invited successfully. Invitation email sent.',
    }
  } catch (error) {
    console.error('Invite user error:', error)

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required') {
        return {
          success: false,
          error: error.message,
        }
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

/**
 * Get all users for admin management
 *
 * @returns List of all users with profile data
 */
export async function getAllUsers() {
  try {
    // Require admin authorization
    await requireAdmin()

    const users = await prisma.userProfile.findMany({
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        user_id: true,
        full_name: true,
        role: true,
        status: true,
        agency_id: true,
        last_login: true,
        created_at: true,
        updated_at: true,
        invite_token: true,
        agency: { select: { id: true, name: true } },
      },
    })

    // Fetch email addresses from Supabase Auth
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('Supabase listUsers error:', listError)
    }

    const authUserList = authUsers?.users ?? []

    // Merge profile data with email from auth
    const usersWithEmail = users.map((user) => {
      const authUser = authUserList.find((au) => au.id === user.user_id)
      return {
        ...user,
        email: authUser?.email || 'Unknown',
      }
    })

    return {
      success: true,
      data: usersWithEmail,
    }
  } catch (error) {
    console.error('Get all users error:', error)

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required') {
        return {
          success: false,
          error: error.message,
        }
      }
    }

    return {
      success: false,
      error: 'Failed to fetch users',
    }
  }
}

/**
 * Accept user invitation and activate account
 *
 * Called when user clicks magic link and sets their password.
 * Activates the account by changing status to ACTIVE and clearing invite tokens.
 *
 * @param userId - Supabase auth user ID
 * @param password - New password to set
 * @returns Success response or error
 */
export async function acceptInvitation(userId: string, password: string) {
  try {
    // Validate password
    if (!password || password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters',
      }
    }

    // Get user profile to verify invite token exists and not expired
    const profile = await prisma.userProfile.findUnique({
      where: { user_id: userId },
      select: {
        invite_token: true,
        invite_expires_at: true,
        status: true,
        full_name: true,
      },
    })

    if (!profile) {
      return {
        success: false,
        error: 'User profile not found',
      }
    }

    // Check if invitation is still valid
    if (!profile.invite_token || !profile.invite_expires_at) {
      return {
        success: false,
        error: 'Invalid invitation link',
      }
    }

    if (new Date() > profile.invite_expires_at) {
      return {
        success: false,
        error: 'Invitation link has expired. Please request a new invitation.',
      }
    }

    // Update user password in Supabase Auth
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
    )

    if (passwordError) {
      console.error('Failed to update password:', passwordError)
      return {
        success: false,
        error: 'Failed to set password. Please try again.',
      }
    }

    // Activate user account and clear invitation tokens
    await prisma.userProfile.update({
      where: { user_id: userId },
      data: {
        status: 'ACTIVE',
        invite_token: null,
        invite_expires_at: null,
      },
    })

    return {
      success: true,
      message: 'Account activated successfully. You can now login.',
    }
  } catch (error) {
    console.error('Accept invitation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// ---------------------------------------------------------------------------
// Update User
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN', 'CONTRACTOR', 'BDR'], {
    message: 'Invalid role',
  }),
  agency_id: z.string().uuid('Invalid agency ID').optional().nullable(),
  bdr_staff_id: z.string().uuid('Invalid BDR staff ID').optional().nullable(),
}).refine(
  (data) => {
    if (data.role === 'AGENCY_ADMIN' && !data.agency_id) return false
    return true
  },
  { message: 'Agency is required for Agency Admin role', path: ['agency_id'] }
).refine(
  (data) => {
    if (data.role === 'BDR' && !data.bdr_staff_id) return false
    return true
  },
  { message: 'BDR staff member is required for BDR role', path: ['bdr_staff_id'] }
)

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/**
 * Update user profile (name, role, agency)
 *
 * @param profileId - UserProfile.id (primary key)
 * @param input - Fields to update
 * @returns Success response or error
 */
export async function updateUser(profileId: string, input: UpdateUserInput) {
  try {
    const admin = await requireAdmin()
    const validated = updateUserSchema.parse(input)

    const profile = await prisma.userProfile.findUnique({
      where: { id: profileId },
      select: { user_id: true, full_name: true, role: true, agency_id: true },
    })

    if (!profile) {
      return { success: false, error: 'User not found' }
    }

    // Self-protection: cannot change own role
    if (profile.user_id === admin.userId && validated.role !== profile.role) {
      return { success: false, error: 'Cannot change your own role' }
    }

    const roleChanged = validated.role !== profile.role

    const updated = await prisma.userProfile.update({
      where: { id: profileId },
      data: {
        full_name: validated.full_name,
        role: validated.role as UserRole,
        agency_id: validated.role === 'AGENCY_ADMIN' ? validated.agency_id : null,
        bdr_staff_id: validated.role === 'BDR' ? validated.bdr_staff_id : null,
      },
    })

    await createAuditLog({
      actorId: admin.userId,
      targetUserId: profile.user_id,
      actionType: roleChanged ? 'ROLE_CHANGED' : 'USER_EDITED',
      actionDetails: {
        before: { full_name: profile.full_name, role: profile.role, agency_id: profile.agency_id },
        after: { full_name: validated.full_name, role: validated.role, agency_id: validated.agency_id, bdr_staff_id: validated.bdr_staff_id },
        edited_by: admin.email,
      },
    })

    revalidatePath('/dashboard/admin/users')
    return { success: true, data: updated }
  } catch (error) {
    console.error('Update user error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Validation error' }
    }
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to update user' }
  }
}

// ---------------------------------------------------------------------------
// Delete User
// ---------------------------------------------------------------------------

/**
 * Permanently delete a user from the platform
 *
 * Removes UserProfile, UserOrganization records, and Supabase Auth user.
 * Blocks deletion if user has initiated contractor payments (non-nullable FK).
 *
 * @param profileId - UserProfile.id (primary key)
 * @returns Success response or error
 */
export async function deleteUser(profileId: string) {
  try {
    const admin = await requireAdmin()

    const profile = await prisma.userProfile.findUnique({
      where: { id: profileId },
      select: { id: true, user_id: true, full_name: true, role: true },
    })

    if (!profile) {
      return { success: false, error: 'User not found' }
    }

    if (profile.user_id === admin.userId) {
      return { success: false, error: 'Cannot delete your own account' }
    }

    // Get email before deleting
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const email = authUsers.users.find((u) => u.id === profile.user_id)?.email || 'Unknown'

    // Nullify nullable FKs that reference this profile
    await prisma.contractorInvoice.updateMany({
      where: { reviewed_by: profile.id },
      data: { reviewed_by: null },
    })

    // Delete UserOrganization records
    await prisma.userOrganization.deleteMany({
      where: { user_id: profile.user_id },
    })

    // Delete UserProfile (will fail with FK error if user has initiated payments)
    try {
      await prisma.userProfile.delete({ where: { id: profileId } })
    } catch (deleteError: unknown) {
      if ((deleteError as any)?.code === 'P2003') {
        return {
          success: false,
          error: 'Cannot delete user with associated records. Deactivate instead.',
        }
      }
      throw deleteError
    }

    // Delete from Supabase Auth
    await supabaseAdmin.auth.admin.deleteUser(profile.user_id)

    await createAuditLog({
      actorId: admin.userId,
      targetUserId: profile.user_id,
      actionType: 'USER_DELETED',
      actionDetails: {
        email,
        full_name: profile.full_name,
        role: profile.role,
        deleted_by: admin.email,
      },
    })

    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Delete user error:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to delete user' }
  }
}

// ---------------------------------------------------------------------------
// Toggle User Status (Active/Inactive)
// ---------------------------------------------------------------------------

/**
 * Toggle user status between ACTIVE and INACTIVE
 *
 * Also bans/unbans the user in Supabase Auth to prevent login.
 *
 * @param profileId - UserProfile.id (primary key)
 * @returns Success response with new status or error
 */
export async function toggleUserStatus(profileId: string) {
  try {
    const admin = await requireAdmin()

    const profile = await prisma.userProfile.findUnique({
      where: { id: profileId },
      select: { user_id: true, status: true, full_name: true },
    })

    if (!profile) {
      return { success: false, error: 'User not found' }
    }

    if (profile.user_id === admin.userId) {
      return { success: false, error: 'Cannot deactivate your own account' }
    }

    const newStatus = profile.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    await prisma.userProfile.update({
      where: { id: profileId },
      data: { status: newStatus },
    })

    // Ban/unban in Supabase Auth
    if (newStatus === 'INACTIVE') {
      await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        ban_duration: '876000h', // ~100 years
      })
    } else {
      await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        ban_duration: 'none',
      })
    }

    await createAuditLog({
      actorId: admin.userId,
      targetUserId: profile.user_id,
      actionType: newStatus === 'INACTIVE' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
      actionDetails: {
        full_name: profile.full_name,
        previous_status: profile.status,
        new_status: newStatus,
        changed_by: admin.email,
      },
    })

    revalidatePath('/dashboard/admin/users')
    return { success: true, data: { newStatus } }
  } catch (error) {
    console.error('Toggle user status error:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to toggle user status' }
  }
}

// ---------------------------------------------------------------------------
// Resend Invitation
// ---------------------------------------------------------------------------

/**
 * Resend invitation magic link for a pending user
 *
 * Generates a new magic link and updates the invite token/expiry.
 *
 * @param profileId - UserProfile.id (primary key)
 * @returns Success response with magic link or error
 */
export async function resendInvitation(profileId: string) {
  try {
    const admin = await requireAdmin()

    const profile = await prisma.userProfile.findUnique({
      where: { id: profileId },
      select: { user_id: true, invite_token: true, full_name: true, status: true },
    })

    if (!profile) {
      return { success: false, error: 'User not found' }
    }

    if (!profile.invite_token && profile.status === 'ACTIVE') {
      return { success: false, error: 'User has already accepted their invitation' }
    }

    // Get email from Supabase Auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)

    if (!authUser.user?.email) {
      return { success: false, error: 'Could not find user email' }
    }

    // Generate new magic link
    const { data: magicLinkData, error: magicLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: authUser.user.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/invite-accept`,
        },
      })

    if (magicLinkError || !magicLinkData) {
      console.error('Failed to generate magic link:', magicLinkError)
      return { success: false, error: 'Failed to generate invitation link' }
    }

    // Update invite token and expiry
    const newToken = crypto.randomUUID()
    await prisma.userProfile.update({
      where: { id: profileId },
      data: {
        invite_token: newToken,
        invite_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    })

    await createAuditLog({
      actorId: admin.userId,
      targetUserId: profile.user_id,
      actionType: 'PASSWORD_RESET',
      actionDetails: {
        full_name: profile.full_name,
        action: 'invitation_resent',
        resent_by: admin.email,
      },
    })

    revalidatePath('/dashboard/admin/users')
    return {
      success: true,
      data: { magic_link: magicLinkData.properties.action_link },
      message: 'Invitation resent successfully.',
    }
  } catch (error) {
    console.error('Resend invitation error:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden - admin access required')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to resend invitation' }
  }
}
