'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Users, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

// T133: ClientROITable component with sortable columns

interface ClientROIData {
  id: string;
  client_id: string;
  month: number;
  year: number;
  revenue: any;
  total_costs: any;
  profit: any;
  roi_percentage: any;
  margin_percentage: any;
  bdr_costs: any;
  contractor_costs: any;
  subscription_costs: any;
  service_costs: any;
  overhead_costs: any;
  agency_costs: any;
  calculated_at: Date;
  client: {
    id: string;
    name: string;
    status: string;
    relationship_type: string;
  };
}

interface ClientROITableProps {
  clients: ClientROIData[];
  onSort?: (field: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type SortField = 'name' | 'revenue' | 'total_costs' | 'profit' | 'roi_percentage' | 'margin_percentage';

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getROIBadgeVariant(roi: number): 'default' | 'secondary' | 'destructive' {
  if (roi >= 100) return 'default'; // Green for positive ROI
  if (roi >= 0) return 'secondary'; // Gray for break-even
  return 'destructive'; // Red for negative ROI
}

function getMarginBadgeVariant(margin: number): 'default' | 'secondary' | 'destructive' {
  if (margin >= 50) return 'default'; // Green for healthy margin
  if (margin >= 20) return 'secondary'; // Gray for acceptable margin
  return 'destructive'; // Red for low/negative margin
}

export function ClientROITable({ clients, onSort, sortBy, sortOrder }: ClientROITableProps) {
  const [localSortBy, setLocalSortBy] = useState<SortField>('margin_percentage');
  const [localSortOrder, setLocalSortOrder] = useState<'asc' | 'desc'>('desc');

  const currentSortBy = sortBy || localSortBy;
  const currentSortOrder = sortOrder || localSortOrder;

  const handleSort = (field: SortField) => {
    if (onSort) {
      onSort(field);
    } else {
      if (currentSortBy === field) {
        setLocalSortOrder(currentSortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setLocalSortBy(field);
        setLocalSortOrder('desc');
      }
    }
  };

  const sortedClients = onSort
    ? clients
    : [...clients].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (localSortBy) {
          case 'name':
            aValue = a.client.name.toLowerCase();
            bValue = b.client.name.toLowerCase();
            break;
          case 'revenue':
            aValue = Number(a.revenue);
            bValue = Number(b.revenue);
            break;
          case 'total_costs':
            aValue = Number(a.total_costs);
            bValue = Number(b.total_costs);
            break;
          case 'profit':
            aValue = Number(a.profit);
            bValue = Number(b.profit);
            break;
          case 'roi_percentage':
            aValue = Number(a.roi_percentage);
            bValue = Number(b.roi_percentage);
            break;
          case 'margin_percentage':
            aValue = Number(a.margin_percentage);
            bValue = Number(b.margin_percentage);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return localSortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return localSortOrder === 'asc' ? 1 : -1;
        return 0;
      });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No client ROI data found"
        description="Refresh ROI calculations to see client performance metrics."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="name">Client Name</SortButton>
              </TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">
                <SortButton field="revenue">Revenue</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="total_costs">Total Costs</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="profit">Profit</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="roi_percentage">ROI %</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="margin_percentage">Margin %</SortButton>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map((client) => {
              const roi = Number(client.roi_percentage);
              const margin = Number(client.margin_percentage);
              const profit = Number(client.profit);
              const revenue = Number(client.revenue);
              const costs = Number(client.total_costs);

              return (
                <TableRow key={client.id}>
                  <TableCell>
                    <div>
                      <Link
                        href={`/dashboard/clients/${client.client_id}`}
                        className="hover:underline font-medium"
                      >
                        {client.client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {client.client.relationship_type}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.month}/{client.year}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(costs)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {profit >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatCurrency(profit)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getROIBadgeVariant(roi)} className="font-mono">
                      {formatPercentage(roi)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMarginBadgeVariant(margin)} className="font-mono">
                      {formatPercentage(margin)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.client.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {client.client.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {sortedClients.map((client) => {
          const roi = Number(client.roi_percentage);
          const margin = Number(client.margin_percentage);
          const profit = Number(client.profit);
          const revenue = Number(client.revenue);
          const costs = Number(client.total_costs);

          return (
            <div key={client.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/dashboard/clients/${client.client_id}`}
                    className="hover:underline font-medium"
                  >
                    {client.client.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {client.month}/{client.year} • {client.client.relationship_type}
                  </p>
                </div>
                <Badge variant={client.client.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {client.client.status}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Badge variant={getROIBadgeVariant(roi)} className="font-mono text-xs">
                  ROI {formatPercentage(roi)}
                </Badge>
                <Badge variant={getMarginBadgeVariant(margin)} className="font-mono text-xs">
                  Margin {formatPercentage(margin)}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="font-semibold">{formatCurrency(revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Costs</p>
                  <p className="text-muted-foreground">{formatCurrency(costs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
