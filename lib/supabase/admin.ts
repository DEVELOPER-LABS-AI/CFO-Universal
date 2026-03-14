import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client
 *
 * IMPORTANT: Uses service role key - server-side only, never expose to client
 * This client bypasses Row Level Security (RLS) policies
 *
 * Use cases:
 * - User management (create, update, delete users)
 * - Magic link generation for invitations
 * - Admin operations requiring elevated privileges
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
