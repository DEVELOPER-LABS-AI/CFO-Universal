import { requireBDR } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { BDRPortalSidebar } from '@/components/bdr-portal/Sidebar';
import { BDRPortalHeader } from '@/components/bdr-portal/Header';
import { redirect } from 'next/navigation';

export default async function BDRPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireBDR();

  const staff = await prisma.staff.findUnique({
    where: { id: user.bdrStaffId },
    select: { name: true },
  });

  if (!staff) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <BDRPortalSidebar bdrName={staff.name} userName={user.fullName} />

      <div className="flex-1 flex flex-col lg:pl-64">
        <BDRPortalHeader bdrName={staff.name} userName={user.fullName} />

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
