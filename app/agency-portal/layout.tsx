import { requireAgencyAdmin } from '@/lib/auth/helpers'
import { prisma } from '@/lib/prisma'
import { AgencyPortalSidebar } from '@/components/agency-portal/Sidebar'
import { AgencyPortalHeader } from '@/components/agency-portal/Header'
import { redirect } from 'next/navigation'

export default async function AgencyPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAgencyAdmin()

  // Fetch agency name for branding
  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId },
    select: { name: true },
  })

  if (!agency) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AgencyPortalSidebar
        agencyName={agency.name}
        userName={user.fullName}
      />

      <div className="flex-1 flex flex-col lg:pl-64">
        <AgencyPortalHeader agencyName={agency.name} />

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
