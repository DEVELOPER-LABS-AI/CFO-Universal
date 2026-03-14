/**
 * Unmapped Contacts Count Component
 *
 * Displays count of Xero contacts that couldn't be automatically mapped to clients.
 * Links to manual mapping page for admin review.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function UnmappedContactsCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnmappedCount();
  }, []);

  const fetchUnmappedCount = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query for contacts that have no mapping or failed mapping
      // This would typically be an API endpoint like /api/xero/mappings/unmapped
      const response = await fetch('/api/xero/mappings/unmapped');

      if (!response.ok) {
        throw new Error('Failed to fetch unmapped contacts');
      }

      const data = await response.json();
      setCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch unmapped contacts:', err);
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

  const hasUnmapped = count !== null && count > 0;

  return (
    <div
      className={`p-4 border rounded-lg ${
        hasUnmapped
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-green-50 border-green-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Unmapped Contacts</p>
          <p
            className={`text-2xl font-bold ${
              hasUnmapped ? 'text-yellow-600' : 'text-green-600'
            }`}
          >
            {count}
          </p>
        </div>
        {hasUnmapped && (
          <Link
            href="/dashboard/integrations/xero/mappings"
            className="px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors"
          >
            Review &rarr;
          </Link>
        )}
      </div>
      {hasUnmapped && (
        <p className="mt-2 text-xs text-gray-600">
          {count} contact{count !== 1 ? 's' : ''} need manual mapping to clients
        </p>
      )}
    </div>
  );
}
