/**
 * Owner Compensation Tracking Page
 *
 * Tracks expected vs actual monthly owner compensation,
 * computes shortfalls, and displays cumulative deferred balance.
 */

import { getOwners, getOwnerPayHistory } from '@/app/actions/owner-pay-actions';
import { CompensationPageContent } from '@/components/compensation/CompensationPageContent';

export default async function CompensationPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [rawOwners, rawRecords] = await Promise.all([
    getOwners(),
    getOwnerPayHistory(),
  ]);

  // Serialize Prisma Decimal/Date to plain types for client component
  const owners = rawOwners.map((o) => ({
    id: o.id,
    name: o.name,
    rate: Number(o.rate),
    rate_type: o.rate_type,
    compensation_start_date: o.compensation_start_date?.toISOString() ?? null,
    pay_day: o.pay_day,
  }));

  const records = rawRecords.map((r) => ({
    id: r.id,
    staff_id: r.staff_id,
    month: r.month,
    year: r.year,
    expected_amount: Number(r.expected_amount),
    actual_amount: Number(r.actual_amount),
    shortfall: Number(r.shortfall),
    cumulative_deferred: Number(r.cumulative_deferred),
    override_paid: r.override_paid,
    override_amount: r.override_amount !== null ? Number(r.override_amount) : null,
    override_note: r.override_note,
    notes: r.notes,
    staff: {
      id: r.staff.id,
      name: r.staff.name,
      rate: Number(r.staff.rate),
      rate_type: r.staff.rate_type,
      pay_day: r.staff.pay_day,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Owner Compensation</h1>
        <p className="text-gray-600 mt-1">
          Track owner pay shortfalls and deferred compensation. Link Mercury merchants to owners via{' '}
          <a href="/dashboard/integrations/mercury/merchants" className="text-blue-600 hover:underline">
            Vendor Mapping
          </a>.
        </p>
      </div>

      <CompensationPageContent
        owners={owners}
        records={records}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />
    </div>
  );
}
