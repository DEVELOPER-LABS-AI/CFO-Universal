/**
 * Validate required environment variables at server startup.
 * Import this module early in server-side entry points (e.g., lib/prisma.ts).
 */
function validateRequiredEnvVars() {
  if (typeof window !== 'undefined') return // Client-side guard

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_KEY',
  ]

  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

validateRequiredEnvVars()
