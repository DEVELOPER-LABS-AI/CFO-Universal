import {
  getCapTableSummary,
  getTransactionHistory,
} from '@/app/actions/cap-table';
import { requireAuth } from '@/lib/auth/helpers';
import { CapTableDashboard } from './CapTableDashboard';

export default async function CapTablePage() {
  const user = await requireAuth();
  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    throw new Error('Forbidden - Admin or Executive access required');
  }

  const [summary, transactions] = await Promise.all([
    getCapTableSummary(),
    getTransactionHistory(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cap Table</h1>
        <p className="text-muted-foreground">
          Manage equity ownership, share classes, and transaction history
        </p>
      </div>

      <CapTableDashboard
        summary={summary}
        transactions={transactions}
        shareConfigured={!!process.env.CAP_TABLE_SHARE_SECRET}
      />
    </div>
  );
}
