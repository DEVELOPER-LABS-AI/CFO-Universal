'use client';

/**
 * T016: Bench Staff Table Component
 *
 * Displays a sortable table of staff members with their utilization,
 * bench cost, and bench duration information. Supports client-side
 * column sorting by clicking column headers.
 */

import { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/utilization/status-badge';
import { formatCurrency } from '@/lib/utils/currency';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BenchStaffEntry {
  staff: {
    id: string;
    name: string;
    staff_type: string;
    engagement_type: string;
    agency_name: string | null;
  };
  utilization: {
    rate: number;
    status: 'on_target' | 'warning' | 'critical';
    bench_hours: number;
    data_source: string;
  };
  cost: {
    bench_cost: number;
    hourly_cost_rate: number;
    cost_rate_source: string;
    monthly_full_cost: number;
  };
  bench_info: {
    days_on_bench: number | null;
    last_assignment_end: string | null;
    last_client_name: string | null;
  };
}

interface BenchStaffTableProps {
  /** Array of bench staff entries to display. */
  staff: BenchStaffEntry[];
}

// ============================================================================
// Sort Configuration
// ============================================================================

type SortField =
  | 'name'
  | 'staff_type'
  | 'agency_name'
  | 'utilization_rate'
  | 'bench_hours'
  | 'bench_cost'
  | 'days_on_bench'
  | 'last_assignment_end'
  | 'status';

type SortDirection = 'asc' | 'desc';

/** Extract the sortable value from a bench staff entry for a given field. */
function getSortValue(entry: BenchStaffEntry, field: SortField): string | number {
  switch (field) {
    case 'name':
      return entry.staff.name.toLowerCase();
    case 'staff_type':
      return entry.staff.staff_type.toLowerCase();
    case 'agency_name':
      return (entry.staff.agency_name ?? '').toLowerCase();
    case 'utilization_rate':
      return entry.utilization.rate;
    case 'bench_hours':
      return entry.utilization.bench_hours;
    case 'bench_cost':
      return entry.cost.bench_cost;
    case 'days_on_bench':
      return entry.bench_info.days_on_bench ?? -1;
    case 'last_assignment_end':
      return entry.bench_info.last_assignment_end ?? '';
    case 'status': {
      const statusOrder = { critical: 0, warning: 1, on_target: 2 };
      return statusOrder[entry.utilization.status];
    }
    default:
      return 0;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a sortable table of bench staff members with utilization,
 * cost, and duration data. Click column headers to sort.
 */
export function BenchStaffTable({ staff }: BenchStaffTableProps) {
  const [sortField, setSortField] = useState<SortField>('bench_cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  /** Toggle sort direction or set a new sort field. */
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  /** Sorted staff list (memoized). */
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      const multiplier = sortDirection === 'desc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });
  }, [staff, sortField, sortDirection]);

  /** Render the sort icon for a column header. */
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No bench staff found for this period.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('name')}
            >
              Name <SortIcon field="name" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('staff_type')}
            >
              Staff Type <SortIcon field="staff_type" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('agency_name')}
            >
              Agency <SortIcon field="agency_name" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('utilization_rate')}
            >
              Utilization % <SortIcon field="utilization_rate" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('bench_hours')}
            >
              Bench Hours <SortIcon field="bench_hours" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('bench_cost')}
            >
              Bench Cost <SortIcon field="bench_cost" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('days_on_bench')}
            >
              Days on Bench <SortIcon field="days_on_bench" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('last_assignment_end')}
            >
              Last Assignment <SortIcon field="last_assignment_end" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              className="flex items-center font-medium hover:text-foreground"
              onClick={() => handleSort('status')}
            >
              Status <SortIcon field="status" />
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStaff.map((entry) => (
          <TableRow key={entry.staff.id}>
            <TableCell className="font-medium">{entry.staff.name}</TableCell>
            <TableCell>{entry.staff.staff_type}</TableCell>
            <TableCell>{entry.staff.agency_name ?? '-'}</TableCell>
            <TableCell>{entry.utilization.rate.toFixed(1)}%</TableCell>
            <TableCell>{entry.utilization.bench_hours.toFixed(1)}</TableCell>
            <TableCell>{formatCurrency(entry.cost.bench_cost)}</TableCell>
            <TableCell>
              {entry.bench_info.days_on_bench !== null
                ? `${entry.bench_info.days_on_bench}d`
                : '-'}
            </TableCell>
            <TableCell>
              {entry.bench_info.last_client_name
                ? (
                  <span className="text-sm">
                    {entry.bench_info.last_client_name}
                    {entry.bench_info.last_assignment_end && (
                      <span className="text-muted-foreground ml-1">
                        ({entry.bench_info.last_assignment_end})
                      </span>
                    )}
                  </span>
                )
                : '-'}
            </TableCell>
            <TableCell>
              <StatusBadge status={entry.utilization.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
