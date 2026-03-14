import { requireAuth } from '@/lib/auth/helpers'
import { redirect } from 'next/navigation'

/**
 * Layout guard for BDR admin pages.
 * Ensures only ADMIN and AGENCY_ADMIN can access /dashboard/bdr/* routes.
 */
export default async function BDRAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  if (user.role !== 'ADMIN' && user.role !== 'AGENCY_ADMIN') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
