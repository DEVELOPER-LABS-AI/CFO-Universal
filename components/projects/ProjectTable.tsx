'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  client: { id: string; name: string } | null;
  budget_target: number | null;
  start_date: Date;
  end_date: Date | null;
  total_costs: number;
  total_revenue: number;
  roi: number | null;
  allocation_count: number;
}

interface ProjectTableProps {
  projects: ProjectData[];
  clients: Array<{ id: string; name: string }>;
}

type SortColumn =
  | 'name'
  | 'status'
  | 'client'
  | 'total_costs'
  | 'total_revenue'
  | 'roi'
  | 'budget_util'
  | 'allocation_count';

type SortDirection = 'asc' | 'desc';

const STATUS_OPTIONS = ['All', 'ACTIVE', 'UNDER_REVIEW', 'SUNSET', 'ARCHIVED'] as const;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  SUNSET: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

/**
 * Formats a number as USD currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Computes budget utilization percentage, or null if no budget target.
 */
function getBudgetUtil(project: ProjectData): number | null {
  if (!project.budget_target) return null;
  return (project.total_costs / project.budget_target) * 100;
}

/**
 * Returns a Tailwind color class for budget utilization percentage.
 */
function getBudgetUtilColor(percent: number): string {
  if (percent < 80) return 'text-green-600';
  if (percent <= 100) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * ProjectTable displays a sortable, filterable table of projects with
 * status and client filters, a search input, and formatted financial columns.
 */
export function ProjectTable({ projects, clients }: ProjectTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  /**
   * Handles clicking a column header to toggle sort column and direction.
   */
  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...projects];

    // Filter by status
    if (statusFilter !== 'All') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Filter by client
    if (clientFilter !== 'All') {
      result = result.filter((p) => p.client?.id === clientFilter);
    }

    // Filter by search (name, case-insensitive)
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'client':
          comparison = (a.client?.name ?? '').localeCompare(b.client?.name ?? '');
          break;
        case 'total_costs':
          comparison = a.total_costs - b.total_costs;
          break;
        case 'total_revenue':
          comparison = a.total_revenue - b.total_revenue;
          break;
        case 'roi':
          comparison = (a.roi ?? -Infinity) - (b.roi ?? -Infinity);
          break;
        case 'budget_util': {
          const aUtil = getBudgetUtil(a) ?? -Infinity;
          const bUtil = getBudgetUtil(b) ?? -Infinity;
          comparison = aUtil - bUtil;
          break;
        }
        case 'allocation_count':
          comparison = a.allocation_count - b.allocation_count;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [projects, statusFilter, clientFilter, search, sortColumn, sortDirection]);

  /**
   * Renders a sort indicator icon for the given column.
   */
  function renderSortIcon(column: SortColumn) {
    if (sortColumn !== column) {
      return <ChevronUp className="inline h-4 w-4 opacity-25" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="inline h-4 w-4" />
    ) : (
      <ChevronDown className="inline h-4 w-4" />
    );
  }

  /**
   * Renders a clickable column header cell with sort indicator.
   */
  function renderHeader(label: string, column: SortColumn) {
    return (
      <th
        className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
        onClick={() => handleSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {renderSortIcon(column)}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status === 'All' ? 'All Statuses' : status.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[250px]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              {renderHeader('Name', 'name')}
              {renderHeader('Status', 'status')}
              {renderHeader('Client', 'client')}
              {renderHeader('Total Cost', 'total_costs')}
              {renderHeader('Revenue', 'total_revenue')}
              {renderHeader('ROI', 'roi')}
              {renderHeader('Budget Util', 'budget_util')}
              {renderHeader('Allocations', 'allocation_count')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No projects match your filters.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((project) => {
                const budgetUtil = getBudgetUtil(project);

                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    {/* Name */}
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {project.name}
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800'}`}
                      >
                        {project.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {project.client?.name ?? '\u2014'}
                    </td>

                    {/* Total Cost */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(project.total_costs)}
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(project.total_revenue)}
                    </td>

                    {/* ROI */}
                    <td className="px-4 py-3 text-sm">
                      {project.roi !== null ? (
                        <span className={project.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {(project.roi * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Budget Util */}
                    <td className="px-4 py-3 text-sm">
                      {budgetUtil !== null ? (
                        <span className={getBudgetUtilColor(budgetUtil)}>
                          {budgetUtil.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">{'\u2014'}</span>
                      )}
                    </td>

                    {/* Allocations */}
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {project.allocation_count}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
