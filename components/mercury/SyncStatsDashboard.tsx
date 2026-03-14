/**
 * Mercury Sync Statistics Dashboard Component
 *
 * Displays key metrics:
 * - Success rate
 * - Total synced transactions
 * - Average sync duration
 * - Unmapped merchants count
 * - Uncategorized expenses count
 */

'use client';

import React from 'react';

interface SyncStats {
  period_days: number;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  success_rate: number;
  total_records_processed: number;
  total_records_created: number;
  total_records_failed: number;
  error_rate: number;
  avg_duration_ms: number;
}

interface ExpenseStats {
  totals: {
    expenses: number;
  };
  breakdown?: {
    by_category?: Array<{ category: string; _count: number }>;
    by_status?: Array<{ mercury_sync_status: string | null; _count: number }>;
  };
}

interface SyncStatsDashboardProps {
  syncStats: SyncStats;
  expenseStats: ExpenseStats | null;
  unmappedMerchantsCount?: number;
  uncategorizedExpensesCount?: number;
  organizationId: string;
}

export function SyncStatsDashboard({
  syncStats,
  expenseStats,
  unmappedMerchantsCount = 0,
  uncategorizedExpensesCount = 0,
  organizationId,
}: SyncStatsDashboardProps) {
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const stats = [
    {
      name: 'Success Rate',
      value: formatPercent(syncStats.success_rate),
      description: `${syncStats.successful_syncs} of ${syncStats.total_syncs} syncs`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Synced Transactions',
      value: (syncStats.total_records_created ?? 0).toLocaleString(),
      description: `${(syncStats.total_records_processed ?? 0).toLocaleString()} processed`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Avg Sync Duration',
      value: formatDuration(syncStats.avg_duration_ms),
      description: 'Per sync operation',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Error Rate',
      value: formatPercent(syncStats.error_rate),
      description: `${syncStats.total_records_failed} failed`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
  ];

  const actionItems = [
    {
      name: 'Unmapped Vendors',
      count: unmappedMerchantsCount,
      description: 'Vendors need identity mapping',
      action: 'Review',
      actionLink: `/dashboard/integrations/mercury/merchants?organizationId=${organizationId}`,
      severity: unmappedMerchantsCount > 10 ? 'high' : unmappedMerchantsCount > 0 ? 'medium' : 'low',
    },
    {
      name: 'Uncategorized Expenses',
      count: uncategorizedExpensesCount,
      description: 'Expenses need manual categorization',
      action: 'Categorize',
      actionLink: `/dashboard/integrations/mercury/expenses?organizationId=${organizationId}`,
      severity: uncategorizedExpensesCount > 20 ? 'high' : uncategorizedExpensesCount > 0 ? 'medium' : 'low',
    },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-300 bg-red-50';
      case 'medium':
        return 'border-yellow-300 bg-yellow-50';
      default:
        return 'border-green-300 bg-green-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
                <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <div className={stat.color}>{stat.icon}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionItems.map((item) => (
          <div
            key={item.name}
            className={`rounded-lg border-2 p-4 ${getSeverityColor(item.severity)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{item.count}</h3>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{item.description}</p>
              </div>
              <a
                href={item.actionLink}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {item.action} →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Total Expenses Summary */}
      {expenseStats && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Total Mercury Expenses
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(expenseStats.totals.expenses ?? 0).toLocaleString()}
              </p>
            </div>
            {expenseStats.breakdown?.by_category && (
              <>
                {expenseStats.breakdown.by_category.slice(0, 3).map((cat) => (
                  <div key={cat.category}>
                    <p className="text-sm text-gray-600">{cat.category}</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {(cat._count ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
