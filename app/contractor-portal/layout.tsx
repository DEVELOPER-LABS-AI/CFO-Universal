import { requireContractor } from '@/lib/auth/helpers'
import { prisma } from '@/lib/prisma'
import { ContractorPortalSidebar } from '@/components/contractor-portal/Sidebar'
import { ContractorPortalHeader } from '@/components/contractor-portal/Header'
import { redirect } from 'next/navigation'

export default async function ContractorPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireContractor()

  const contractor = await prisma.contractor.findUnique({
    where: { id: user.contractorId },
    select: { name: true },
  })

  if (!contractor) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ContractorPortalSidebar
        contractorName={contractor.name}
        userName={user.fullName}
      />

      <div className="flex-1 flex flex-col lg:pl-64">
        <ContractorPortalHeader contractorName={contractor.name} />

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
