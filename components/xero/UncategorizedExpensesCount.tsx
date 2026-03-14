/**
 * Uncategorized Expenses Count Component
 *
 * Displays count of expenses that couldn't be automatically categorized.
 * Links to expense review page for admin categorization.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function UncategorizedExpensesCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUncategorizedCount();
  }, []);

  const fetchUncategorizedCount = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query for expenses with expense_sync_status = CATEGORIZATION_FAILED
      // This would typically be an API endpoint like /api/xero/expenses/uncategorized
      const response = await fetch('/api/xero/expenses/uncategorized');

      if (!response.ok) {
        throw new Error('Failed to fetch uncategorized expenses');
      }

      const data = await response.json();
      setCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch uncategorized expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load count');
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  const hasUncategorized = count !== null && count > 0;

  return (
    <div
      className={`p-4 border rounded-lg ${
        hasUncategorized
          ? 'bg-orange-50 border-orange-200'
          : 'bg-green-50 border-green-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Uncategorized Expenses</p>
          <p
            className={`text-2xl font-bold ${
              hasUncategorized ? 'text-orange-600' : 'text-green-600'
            }`}
          >
            {count}
          </p>
        </div>
        {hasUncategorized && (
          <Link
            href="/dashboard/expenses?filter=uncategorized"
            className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200 transition-colors"
          >
            Review &rarr;
          </Link>
        )}
      </div>
      {hasUncategorized && (
        <p className="mt-2 text-xs text-gray-600">
          {count} expense{count !== 1 ? 's' : ''} need manual categorization
        </p>
      )}
    </div>
  );
}
