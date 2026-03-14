/**
 * CompensationPageContent (Client Component)
 *
 * Displays owner compensation tracking: summary cards, per-owner breakdown
 * with transaction detail, payment status badges, and monthly history table.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingDown, AlertTriangle, RefreshCw, Pencil, ChevronDown, ChevronUp, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  refreshOwnerPay,
  refreshAllOwnerPay,
  getOwnerTransactionsAction,
  setOwnerPayOverride,
} from '@/app/actions/owner-pay-actions';
import { getPaymentStatus } from '@/lib/calculations/owner-pay-utils';
import { formatCurrency } from '@/lib/utils/currency';
import { Input } from '@/components/ui/input';
import { EditOwnerCompModal } from './EditOwnerCompModal';

interface Owner {
  id: string;
  name: string;
  rate: string | number;
  rate_type: string;
  compensation_start_date: string | null;
  pay_day: number | null;
}

interface PayRecord {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  expected_amount: string | number;
  actual_amount: string | number;
  shortfall: string | number;
  cumulative_deferred: string | number;
  override_paid: boolean;
  override_amount: number | null;
  override_note: string | null;
  notes: string | null;
  staff: {
    id: string;
    name: string;
    rate: string | number;
    rate_type: string;
    pay_day: number | null;
  };
}

interface OwnerTransaction {
  id: string;
  transaction_date: string;
  merchant_name: string | null;
  amount: number;
  description: string | null;
}

interface CompensationPageContentProps {
  owners: Owner[];
  records: PayRecord[];
  currentMonth: number;
  currentYear: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Payment status badge */
function StatusBadge({ status }: { status: 'paid' | 'upcoming' | 'overdue' | 'n/a' }) {
  const config = {
    paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
    upcoming: { label: 'Upcoming', className: 'bg-gray-100 text-gray-600' },
    overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
    'n/a': { label: 'N/A', className: 'bg-gray-50 text-gray-400' },
  };
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

/** Expandable transaction list for an owner/month */
function TransactionBreakdown({
  staffId,
  month,
  year,
}: {
  staffId: string;
  month: number;
  year: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<OwnerTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (transactions !== null) return; // already loaded

    setLoading(true);
    try {
      const data = await getOwnerTransactionsAction(staffId, month, year);
      // Serialize dates for client
      setTransactions(
        data.map((t) => ({
          ...t,
          transaction_date:
            typeof t.transaction_date === 'string'
              ? t.transaction_date
              : (t.transaction_date as Date).toISOString(),
        }))
      );
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const total = transactions?.reduce((sum, t) => sum + t.amount, 0) ?? 0;

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide' : 'View'} Transactions
      </button>
      {expanded && (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-gray-400">Loading...</p>
          ) : transactions && transactions.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium text-gray-500">Merchant</th>
                    <th className="px-3 py-1.5 text-right font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-600">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900 max-w-[180px] truncate">
                        {tx.merchant_name || tx.description || '—'}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900 text-right font-medium">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-1.5 font-medium text-gray-700">Total</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No transactions found for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CompensationPageContent({
  owners,
  records,
  currentMonth,
  currentYear,
}: CompensationPageContentProps) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingOwner, setRefreshingOwner] = useState<string | null>(null);

  // Filter records by selected year
  const yearRecords = records.filter((r) => r.year === selectedYear);

  // Current month records
  const currentMonthRecords = records.filter((r) => r.month === currentMonth && r.year === currentYear);

  // Summary calculations
  const totalExpected = currentMonthRecords.reduce((sum, r) => sum + Number(r.expected_amount), 0);
  const totalActual = currentMonthRecords.reduce((sum, r) => sum + Number(r.actual_amount), 0);
  const totalShortfall = currentMonthRecords.reduce((sum, r) => sum + Number(r.shortfall), 0);
  const totalDeferred = currentMonthRecords.reduce((sum, r) => sum + Number(r.cumulative_deferred), 0);

  /** Refresh a single owner's pay record for the current month */
  const handleRefreshOwner = async (staffId: string) => {
    setRefreshingOwner(staffId);
    try {
      const result = await refreshOwnerPay({
        staff_id: staffId,
        month: currentMonth,
        year: currentYear,
      });
      toast.success(`Owner pay refreshed: expected ${formatCurrency(result.expected)}, actual ${formatCurrency(result.actual)}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh owner pay';
      toast.error(message);
    } finally {
      setRefreshingOwner(null);
    }
  };

  /** Refresh all owners for the current month */
  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await refreshAllOwnerPay({ month: currentMonth, year: currentYear });
      toast.success('All owner pay records refreshed');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh all owner pay';
      toast.error(message);
    } finally {
      setRefreshingAll(false);
    }
  };

  // Build unique years from records for the year selector
  const availableYears = Array.from(new Set(records.map((r) => r.year))).sort((a, b) => b - a);
  if (!availableYears.includes(currentYear)) availableYears.unshift(currentYear);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Pay (This Month)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpected)}</div>
            <p className="text-xs text-muted-foreground">{owners.length} owner{owners.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Pay (This Month)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
            <p className="text-xs text-muted-foreground">From Mercury transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Shortfall</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalShortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalShortfall))}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalShortfall > 0 ? 'Underpaid this month' : totalShortfall < 0 ? 'Overpaid this month' : 'Fully paid'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deferred Comp</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalDeferred > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(totalDeferred))}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalDeferred > 0 ? 'Cumulative shortfall' : 'No deferred balance'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Owner Compensation</h2>
          <span className="text-sm text-gray-500">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </span>
        </div>
        <Button
          onClick={handleRefreshAll}
          disabled={refreshingAll || owners.length === 0}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAll ? 'animate-spin' : ''}`} />
          {refreshingAll ? 'Refreshing...' : 'Refresh All from Mercury'}
        </Button>
      </div>

      {/* Per-Owner Cards */}
      {owners.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>No staff members with engagement type &quot;OWNER&quot; found.</p>
            <p className="text-sm mt-1">
              Add an owner in the <a href="/dashboard/staff" className="text-blue-600 hover:underline">Staff</a> page
              with engagement type set to &quot;Owner&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {owners.map((owner) => {
            const ownerRecord = currentMonthRecords.find((r) => r.staff_id === owner.id);
            const expected = ownerRecord ? Number(ownerRecord.expected_amount) : 0;
            const actual = ownerRecord ? Number(ownerRecord.actual_amount) : 0;
            const shortfall = ownerRecord ? Number(ownerRecord.shortfall) : 0;
            const cumDeferred = ownerRecord ? Number(ownerRecord.cumulative_deferred) : 0;
            const isRefreshing = refreshingOwner === owner.id;
            const status = getPaymentStatus(owner.pay_day, actual, expected, currentMonth, currentYear);

            return (
              <Card key={owner.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base font-medium">{owner.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={status} />
                      {owner.compensation_start_date && (
                        <span className="text-xs text-gray-400">
                          Since {new Date(owner.compensation_start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {owner.pay_day && (
                        <span className="text-xs text-gray-400">
                          Due: {owner.pay_day}{ordinalSuffix(owner.pay_day)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditOwnerCompModal
                      owner={owner}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                      onSaved={() => router.refresh()}
                    />
                    <Button
                      onClick={() => handleRefreshOwner(owner.id)}
                      disabled={isRefreshing || refreshingAll}
                      variant="ghost"
                      size="sm"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Rate</p>
                      <p className="font-medium">{formatCurrency(Number(owner.rate))}/{owner.rate_type.toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expected</p>
                      <p className="font-medium">{formatCurrency(expected)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Actual (Mercury)</p>
                      <p className="font-medium">{formatCurrency(actual)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Shortfall</p>
                      <p className={`font-medium ${shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {shortfall > 0 ? '-' : ''}{formatCurrency(Math.abs(shortfall))}
                      </p>
                    </div>
                  </div>
                  {cumDeferred > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500">Cumulative Deferred</p>
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(cumDeferred)}</p>
                    </div>
                  )}
                  {/* Transaction breakdown */}
                  <div className="mt-3 pt-3 border-t">
                    <TransactionBreakdown
                      staffId={owner.id}
                      month={currentMonth}
                      year={currentYear}
                    />
                  </div>
                  {!ownerRecord && (
                    <p className="mt-3 text-xs text-gray-400 italic">
                      No data yet. Click refresh to compute from Mercury.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Monthly History Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Monthly History</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {yearRecords.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-gray-500 text-sm">
              No records for {selectedYear}. Click &quot;Refresh All from Mercury&quot; to generate.
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shortfall</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cumulative</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Override</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {yearRecords.map((record) => {
                    const shortfall = Number(record.shortfall);
                    const cumDeferred = Number(record.cumulative_deferred);
                    const actual = Number(record.actual_amount);
                    const expected = Number(record.expected_amount);
                    const status = getPaymentStatus(
                      record.staff.pay_day,
                      actual,
                      expected,
                      record.month,
                      record.year
                    );

                    return (
                      <HistoryRow
                        key={record.id}
                        record={record}
                        shortfall={shortfall}
                        cumDeferred={cumDeferred}
                        status={status}
                        onOverrideChanged={() => router.refresh()}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single history row with expandable transaction detail and override controls */
function HistoryRow({
  record,
  shortfall,
  cumDeferred,
  status,
  onOverrideChanged,
}: {
  record: PayRecord;
  shortfall: number;
  cumDeferred: number;
  status: 'paid' | 'upcoming' | 'overdue' | 'n/a';
  onOverrideChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<OwnerTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingOverride, setEditingOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState(
    record.override_amount !== null ? String(record.override_amount) : String(Number(record.expected_amount))
  );
  const [overrideNote, setOverrideNote] = useState(record.override_note ?? '');
  const [savingOverride, setSavingOverride] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (transactions !== null) return;

    setLoading(true);
    try {
      const data = await getOwnerTransactionsAction(record.staff_id, record.month, record.year);
      setTransactions(
        data.map((t) => ({
          ...t,
          transaction_date:
            typeof t.transaction_date === 'string'
              ? t.transaction_date
              : (t.transaction_date as Date).toISOString(),
        }))
      );
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  /** Save override amount */
  const handleSaveOverride = async () => {
    const amount = parseFloat(overrideValue);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSavingOverride(true);
    try {
      await setOwnerPayOverride({
        id: record.id,
        override_paid: true,
        override_amount: amount,
        override_note: overrideNote.trim() || null,
      });
      toast.success(`Override set: ${formatCurrency(amount)}`);
      setEditingOverride(false);
      onOverrideChanged();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set override';
      toast.error(message);
    } finally {
      setSavingOverride(false);
    }
  };

  /** Clear override */
  const handleClearOverride = async () => {
    setSavingOverride(true);
    try {
      await setOwnerPayOverride({
        id: record.id,
        override_paid: false,
        override_amount: null,
      });
      toast.success('Override removed');
      setEditingOverride(false);
      onOverrideChanged();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear override';
      toast.error(message);
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <>
      <tr className={`hover:bg-gray-50 cursor-pointer ${record.override_paid ? 'bg-blue-50/50' : ''}`} onClick={handleToggle}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {record.staff.name}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {MONTH_NAMES[record.month - 1]} {record.year}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
          {record.override_paid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <ShieldCheck className="h-3 w-3" />
              Override
            </span>
          ) : (
            <StatusBadge status={status} />
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          {formatCurrency(Number(record.expected_amount))}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          <div>
            {formatCurrency(Number(record.actual_amount))}
            {record.override_paid && record.override_amount !== null && (
              <div className="text-xs text-blue-600">
                Override: {formatCurrency(record.override_amount)}
              </div>
            )}
          </div>
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {shortfall > 0 ? '-' : ''}{formatCurrency(Math.abs(shortfall))}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${cumDeferred > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(Math.abs(cumDeferred))}
        </td>
        <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px]">
          {record.override_paid && record.override_note ? (
            <div>
              <span className="text-blue-600 text-xs italic truncate block" title={record.override_note}>
                {record.override_note}
              </span>
              {record.notes && <span className="text-gray-400 text-xs truncate block">{record.notes}</span>}
            </div>
          ) : (
            <span className="truncate block">{record.notes || '—'}</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-center" onClick={(e) => e.stopPropagation()}>
          {record.override_paid ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleClearOverride()}
              disabled={savingOverride}
              className="text-red-500 hover:text-red-700 h-7 px-2"
              title="Remove override"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingOverride(true)}
              className="text-blue-500 hover:text-blue-700 h-7 px-2"
              title="Mark as paid (override)"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
          )}
        </td>
      </tr>
      {/* Override editing row */}
      {editingOverride && !record.override_paid && (
        <tr>
          <td colSpan={9} className="px-6 py-3 bg-blue-50 border-l-4 border-blue-400">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Override actual amount:</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-32 h-8 text-sm"
                  autoFocus
                />
              </div>
              <Button size="sm" onClick={handleSaveOverride} disabled={savingOverride} className="h-8">
                {savingOverride ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingOverride(false)} className="h-8">
                Cancel
              </Button>
            </div>
            <div className="mt-2">
              <Input
                type="text"
                placeholder="Reason for override (e.g., January pay taken in December)"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOverride(); }}
                className="w-full max-w-lg h-8 text-sm"
              />
            </div>
          </td>
        </tr>
      )}
      {expanded && (
        <tr>
          <td colSpan={9} className="px-6 py-3 bg-gray-50">
            {loading ? (
              <p className="text-xs text-gray-400">Loading transactions...</p>
            ) : transactions && transactions.length > 0 ? (
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-1 text-left font-medium text-gray-500">Date</th>
                    <th className="px-3 py-1 text-left font-medium text-gray-500">Merchant</th>
                    <th className="px-3 py-1 text-left font-medium text-gray-500">Description</th>
                    <th className="px-3 py-1 text-right font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-3 py-1 text-gray-600">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-1 text-gray-900">{tx.merchant_name || '—'}</td>
                      <td className="px-3 py-1 text-gray-500 max-w-[200px] truncate">{tx.description || '—'}</td>
                      <td className="px-3 py-1 text-gray-900 text-right font-medium">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-3 py-1 text-gray-700">Total</td>
                    <td className="px-3 py-1 text-right text-gray-900">
                      {formatCurrency(transactions.reduce((s, t) => s + t.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-xs text-gray-400 italic">No transactions found.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Helper: ordinal suffix for day numbers */
function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
