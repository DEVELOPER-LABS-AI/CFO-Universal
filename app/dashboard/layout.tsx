import { requireAuth } from '@/lib/auth/helpers'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { DashboardHeader } from '@/components/dashboard/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require authentication for all dashboard pages
  const user = await requireAuth()

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar user={user} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Header */}
        <DashboardHeader user={user} />

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
