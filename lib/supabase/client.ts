import { createBrowserClient } from '@supabase/ssr'

/**
 * Create Supabase client for client-side (browser) usage
 *
 * This client is used in Client Components for:
 * - Auth state management
 * - Real-time subscriptions
 * - Client-side queries (with RLS)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
