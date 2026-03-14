/**
 * XeroExpensesSection Component
 *
 * Displays Xero-sourced expenses in a tabbed interface:
 * - "Uncategorized" tab: shows count and summary of expenses needing categorization
 * - "All" tab: shows all Xero expenses with contractor/client details
 *
 * Fetches data from /api/xero/expenses/uncategorized (count) and /api/xero/expenses/all.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/** Shape of a Xero expense record from the all-expenses API. */
interface XeroExpense {
  id: string;
  amount: string | number;
  transaction_date: string;
  category: string;
  description: string | null;
  xero_expense_id: string | null;
  xero_account_code: string | null;
  expense_sync_status: string | null;
  contractor: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
}

export function XeroExpensesSection() {
  // Uncategorized tab state
  const [uncategorizedCount, setUncategorizedCount] = useState<number | null>(null);
  const [uncategorizedLoading, setUncategorizedLoading] = useState(true);
  const [uncategorizedError, setUncategorizedError] = useState<string | null>(null);

  // All expenses tab state
  const [allExpenses, setAllExpenses] = useState<XeroExpense[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [allLoaded, setAllLoaded] = useState(false);

  /**
   * Load the uncategorized expense count from the API.
   * Called on mount to populate the uncategorized tab.
   */
  const loadUncategorized = useCallback(async () => {
    try {
      setUncategorizedLoading(true);
      setUncategorizedError(null);

      const res = await fetch('/api/xero/expenses/uncategorized');
      if (!res.ok) {
        throw new Error('Failed to fetch uncategorized expenses');
      }

      const data = await res.json();
      setUncategorizedCount(data.count ?? 0);
    } catch (err) {
      console.error('Failed to load uncategorized expenses:', err);
      setUncategorizedError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setUncategorizedLoading(false);
    }
  }, []);

  /**
   * Load all Xero-sourced expenses.
   * Called lazily when the "All" tab is selected for the first time.
   */
  const loadAllExpenses = useCallback(async () => {
    if (allLoaded) return;
    try {
      setAllLoading(true);
      setAllError(null);

      const res = await fetch('/api/xero/expenses/all');
      if (!res.ok) {
        throw new Error('Failed to fetch Xero expenses');
      }

      const data = await res.json();
      setAllExpenses(data.expenses || []);
      setAllLoaded(true);
    } catch (err) {
      console.error('Failed to load all expenses:', err);
      setAllError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setAllLoading(false);
    }
  }, [allLoaded]);

  useEffect(() => {
    loadUncategorized();
  }, [loadUncategorized]);

  /**
   * Handle tab changes -- lazy-load the all-expenses data when the tab is first activated.
   */
  const handleTabChange = (value: string) => {
    if (value === 'all') {
      loadAllExpenses();
    }
  };

  /** Format a monetary amount as USD. */
  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  /** Returns a readable label for an expense category enum. */
  const categoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      CONTRACTOR_COST: 'Contractor',
      SUBSCRIPTION: 'Subscription',
      TOOLS: 'Tools',
      PAYROLL: 'Payroll',
      OVERHEAD: 'Overhead',
      MARKETING: 'Marketing',
      OTHER: 'Other',
    };
    return labels[category] || category;
  };

  /** Returns a badge color based on the expense sync status. */
  const syncStatusColor = (status: string | null): string => {
    switch (status) {
      case 'SYNCED':
        return 'bg-green-100 text-green-800';
      case 'CATEGORIZATION_FAILED':
        return 'bg-orange-100 text-orange-800';
      case 'VALIDATION_FAILED':
        return 'bg-red-100 text-red-800';
      case 'MANUAL':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <Tabs defaultValue="uncategorized" onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="uncategorized">
          Uncategorized
          {!uncategorizedLoading && uncategorizedCount !== null && uncategorizedCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
              {uncategorizedCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="all">All Expenses</TabsTrigger>
      </TabsList>

      {/* Uncategorized expenses tab */}
      <TabsContent value="uncategorized">
        {uncategorizedLoading ? (
          <div className="animate-pulse space-y-3 py-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-16 bg-gray-200 rounded" />
          </div>
        ) : uncategorizedError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{uncategorizedError}</p>
          </div>
        ) : uncategorizedCount === 0 ? (
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm font-medium text-green-900">All expenses categorized</p>
            <p className="mt-1 text-xs text-green-700">
              There are no uncategorized Xero expenses at this time.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Expenses needing categorization</p>
                <p className="text-3xl font-bold text-orange-600">{uncategorizedCount}</p>
              </div>
              <a
                href="/dashboard/expenses?filter=uncategorized"
                className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors"
              >
                Review expenses
              </a>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              {uncategorizedCount} expense{uncategorizedCount !== 1 ? 's' : ''}{' '}
              could not be automatically categorized and require manual review.
            </p>
          </div>
        )}
      </TabsContent>

      {/* All expenses tab */}
      <TabsContent value="all">
        {allLoading ? (
          <div className="animate-pulse space-y-3 py-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        ) : allError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{allError}</p>
          </div>
        ) : allExpenses.length === 0 ? (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-sm font-medium text-gray-700">No Xero expenses</p>
            <p className="mt-1 text-xs text-gray-500">
              Expenses from Xero will appear here after syncing.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contractor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(expense.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                      {expense.description || '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {categoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {expense.contractor?.name || '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {expense.client?.name || '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${syncStatusColor(expense.expense_sync_status)}`}
                      >
                        {expense.expense_sync_status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
