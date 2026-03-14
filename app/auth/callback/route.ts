import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Auth callback route handler
 *
 * Handles two Supabase auth flows:
 * 1. PKCE flow (code exchange) - used by OAuth, password reset
 * 2. Token hash flow (verifyOtp) - used by magic links, email verification
 *
 * After authentication, performs profile lookup and role-based routing.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  const supabase = await createClient()
  let user = null

  // Flow 1: PKCE code exchange (OAuth, password reset)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      user = data.user
    } else {
      console.error('Auth callback code exchange error:', error)
    }
  }

  // Flow 2: Token hash verification (magic link, email confirm)
  if (!user && token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error && data.user) {
      user = data.user
    } else {
      console.error('Auth callback token verification error:', error)
    }
  }

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_error`)
  }

  // If an explicit next path was provided (e.g., invite-accept), use it
  if (next) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Perform profile lookup and role-based routing
  try {
    const userProfile = await prisma.userProfile.findUnique({
      where: { user_id: user.id },
    })

    if (!userProfile) {
      return NextResponse.redirect(`${origin}/login?error=profile_not_found`)
    }

    // HYBRID ARCHITECTURE: Support both internal tool and multi-tenant flows

    // Internal Tool Flow (has role and status)
    if (userProfile.role && userProfile.status) {
      if (userProfile.status !== 'ACTIVE') {
        return NextResponse.redirect(`${origin}/login?error=account_inactive`)
      }

      // Update last login timestamp
      await prisma.userProfile.update({
        where: { user_id: user.id },
        data: { last_login: new Date() },
      })

      // Sync role to JWT app_metadata for middleware RBAC
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          app_metadata: {
            role: userProfile.role,
            status: userProfile.status,
          },
        })
      } catch (adminError) {
        console.error('Failed to update user metadata:', adminError)
      }

      // Route by role
      let redirectTo = '/dashboard'
      if (userProfile.role === 'AGENCY_ADMIN') redirectTo = '/agency-portal'
      else if (userProfile.role === 'CONTRACTOR') redirectTo = '/contractor-portal'
      else if (userProfile.role === 'BDR') redirectTo = '/bdr-portal'

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }

    // Multi-Tenant Flow (no role/status, uses organizations)
    const userOrganizations = await prisma.userOrganization.findMany({
      where: { user_id: user.id },
      include: { organization: true },
    })

    if (userOrganizations.length === 0) {
      return NextResponse.redirect(`${origin}/login?error=profile_not_found`)
    }

    // Determine active organization
    const activeOrgId =
      userProfile.last_active_org || userOrganizations[0].organization_id

    // Store active organization in session/metadata
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          active_organization_id: activeOrgId,
        },
      })
    } catch (adminError) {
      console.error('Failed to update organization metadata:', adminError)
    }

    return NextResponse.redirect(`${origin}/dashboard`)
  } catch (err) {
    console.error('Auth callback profile lookup error:', err)
    return NextResponse.redirect(`${origin}/dashboard`)
  }
}
