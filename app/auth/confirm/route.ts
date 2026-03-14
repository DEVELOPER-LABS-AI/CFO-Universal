import { NextResponse } from 'next/server'

/**
 * Auth confirm route - redirects to /auth/callback
 *
 * Some Supabase email templates use /auth/confirm as the magic link target.
 * This route forwards all parameters to /auth/callback for unified handling.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const callbackUrl = new URL(`${origin}/auth/callback`)

  // Forward all query parameters
  searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value)
  })

  return NextResponse.redirect(callbackUrl)
}
