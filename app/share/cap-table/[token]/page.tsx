import { notFound } from 'next/navigation';
import { SharedCapTableView } from './SharedCapTableView';

interface SharedCapTablePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Public read-only cap table page. Server Component that fetches data
 * via the share API route and renders a clean, branded view.
 */
export default async function SharedCapTablePage({ params }: SharedCapTablePageProps) {
  const { token } = await params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${appUrl}/api/share/cap-table/${token}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 410) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
            <p className="text-muted-foreground">
              This shared cap table link has expired. Please request a new link from the company.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const data = await res.json();

  return <SharedCapTableView data={data} />;
}
