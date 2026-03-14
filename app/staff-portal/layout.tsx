import { requireAuth } from '@/lib/auth/helpers';
import { redirect } from 'next/navigation';

export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  // Staff portal requires a linked staff ID (currently BDR users)
  if (!user.bdrStaffId) {
    // Non-staff users should use the dashboard instead
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
