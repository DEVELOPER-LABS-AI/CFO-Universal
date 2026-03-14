import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js Middleware for Authentication
 *
 * NOTE: Middleware runs on Edge Runtime - Prisma is NOT compatible!
 * Role and status checks are handled in Server Components/Actions instead.
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session (keep user logged in)
 * 2. Protect authenticated routes (/dashboard/*)
 * 3. Preserve redirect URLs for post-login navigation
 *
 * Role/Status checks happen in:
 * - requireAuth() and requireAdmin() helper functions (Server Components)
 * - Server Actions (before mutations)
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session if expired (required for Server Components)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // API routes: only refresh session, let the route handler manage auth responses
  if (pathname.startsWith('/api/')) {
    return response
  }

  // Public routes (no authentication required)
  const publicRoutes = [
    '/login',
    '/invite-accept',
    '/auth/',
    '/share/cap-table',
  ]

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response
  }

  // Require authentication for all other routes
  if (!user || error) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // User is authenticated - allow access
  // Role and status checks happen in Server Components via requireAuth() and requireAdmin()
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
