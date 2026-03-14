'use server'

import { requireAdmin } from '@/lib/auth/helpers'
import { prisma } from '@/lib/prisma'

/**
 * Fetch all email logs ordered by most recent first.
 * Admin-only: returns the full email log history.
 *
 * @returns Object with success boolean, data array, and optional error
 */
export async function getEmailLogs() {
  try {
    await requireAdmin()

    const logs = await prisma.emailLog.findMany({
      orderBy: { created_at: 'desc' },
    })

    return { success: true, data: logs }
  } catch (error) {
    console.error('[email-logs] Failed to fetch email logs:', error)
    return {
      success: false as const,
      data: [] as Awaited<ReturnType<typeof prisma.emailLog.findMany>>,
      error: error instanceof Error ? error.message : 'Failed to fetch email logs',
    }
  }
}
