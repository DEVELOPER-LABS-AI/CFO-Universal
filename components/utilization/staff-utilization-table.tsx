'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from './status-badge';
import { formatCurrency } from '@/lib/utils/currency';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Staff utilization table with sortable columns and optional staff_type filter.
 * Displays per-staff utilization data with visual progress bars and status badges.
 */

/** Shape of a single staff row (matches API response). */
export interface StaffUtilizationRow {
  staff_id: string;
  name: string;
  staff_type: string;
  engagement_type: string;
  utilization_rate: number;
  available_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  bench_hours: number;
  bench_cost: number;
  data_source: 'TIMESHEET' | 'ALLOCATION';
  status: 'on_target' | 'warning' | 'critical';
  target_rate: number;
  current_assignments: Array<{
    id: string;
    client_name: string;
    allocation_percentage: number;
  }>;
}

interface StaffUtilizationTableProps {
  /** Array of staff utilization data rows. */
  staff: StaffUtilizationRow[];
}

type SortField = 'name' | 'staff_type' | 'utilization_rate' | 'billable_hours' | 'bench_cost' | 'status';
type SortDirection = 'asc' | 'desc';

/** Status sort order for consistent ranking. */
const STATUS_SORT_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  on_target: 2,
};

export function StaffUtilizationTable({ staff }: StaffUtilizationTableProps) {
  const [sortField, setSortField] = useState<SortField>('utilization_rate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('all');

  // Extract unique staff types for the filter dropdown
  const staffTypes = useMemo(() => {
    const types = new Set(staff.map((s) => s.staff_type));
    return Array.from(types).sort();
  }, [staff]);

  // Filter by staff type
  const filteredStaff = useMemo(() => {
    if (staffTypeFilter === 'all') return staff;
    return staff.filter((s) => s.staff_type === staffTypeFilter);
  }, [staff, staffTypeFilter]);

  // Sort the filtered list
  const sortedStaff = useMemo(() => {
    const sorted = [...filteredStaff];
    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'staff_type':
          comparison = a.staff_type.localeCompare(b.staff_type);
          break;
        case 'utilization_rate':
          comparison = a.utilization_rate - b.utilization_rate;
          break;
        case 'billable_hours':
          comparison = a.billable_hours - b.billable_hours;
          break;
        case 'bench_cost':
          comparison = a.bench_cost - b.bench_cost;
          break;
        case 'status':
          comparison = (STATUS_SORT_ORDER[a.status] ?? 2) - (STATUS_SORT_ORDER[b.status] ?? 2);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredStaff, sortField, sortDirection]);

  /**
   * Handle clicking a column header to toggle sorting.
   */
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  /**
   * Render the sort indicator icon for a column header.
   */
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  }

  /**
   * Get a Tailwind color class for the progress bar based on utilization status.
   */
  function getProgressColor(status: string): string {
    switch (status) {
      case 'on_target': return '[&>div]:bg-green-500';
      case 'warning': return '[&>div]:bg-yellow-500';
      case 'critical': return '[&>div]:bg-red-500';
      default: return '';
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Utilization</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={staffTypeFilter} onValueChange={setStaffTypeFilter}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All Staff Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff Types</SelectItem>
              {staffTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                Name <SortIcon field="name" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('staff_type')}
              >
                Staff Type <SortIcon field="staff_type" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-[200px]"
                onClick={() => handleSort('utilization_rate')}
              >
                Utilization <SortIcon field="utilization_rate" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('billable_hours')}
              >
                Hours <SortIcon field="billable_hours" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('bench_cost')}
              >
                Bench Cost <SortIcon field="bench_cost" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No staff members found.
                </TableCell>
              </TableRow>
            ) : (
              sortedStaff.map((row) => (
                <TableRow key={row.staff_id}>
                  {/* Name */}
                  <TableCell className="font-medium">
                    <a
                      href={`/dashboard/staff?highlight=${row.staff_id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </a>
                  </TableCell>

                  {/* Staff Type */}
                  <TableCell className="text-sm text-muted-foreground">
                    {row.staff_type}
                  </TableCell>

                  {/* Utilization Rate with progress bar */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(row.utilization_rate, 100)}
                        className={`h-2 flex-1 ${getProgressColor(row.status)}`}
                      />
                      <span className="text-sm font-medium tabular-nums w-14 text-right">
                        {row.utilization_rate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>

                  {/* Billable / Available Hours */}
                  <TableCell className="text-right text-sm tabular-nums">
                    <span className="font-medium">
                      {row.billable_hours.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}/ {row.available_hours.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </TableCell>

                  {/* Bench Cost */}
                  <TableCell className="text-right text-sm tabular-nums">
                    {row.bench_cost > 0
                      ? formatCurrency(row.bench_cost)
                      : <span className="text-muted-foreground">-</span>}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>

                  {/* Data Source */}
                  <TableCell>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      row.data_source === 'TIMESHEET'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-50 text-gray-600'
                    }`}>
                      {row.data_source === 'TIMESHEET' ? 'Timesheet' : 'Allocation'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer with count */}
      <p className="text-xs text-muted-foreground text-right">
        Showing {sortedStaff.length} of {staff.length} staff members
      </p>
    </div>
  );
}
