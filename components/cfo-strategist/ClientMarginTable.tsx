'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils/currency';

interface ClientMarginRow {
  /** Unique client identifier. */
  clientId: string;
  /** Display name for the client. */
  clientName: string;
  /** Current margin percentage. */
  margin: number;
  /** Target margin percentage. */
  target: number;
  /** Margin status relative to target. */
  status: 'above' | 'near' | 'below';
  /** Total revenue from the client. */
  revenue: number;
  /** Total costs associated with the client. */
  costs: number;
  /** Whether this is a recently added client. */
  isNewClient: boolean;
}

interface ClientMarginTableProps {
  /** List of client margin rows, pre-sorted by margin ascending (worst first). */
  clients: ClientMarginRow[];
}

/** Maps a margin status to its badge styling. */
const STATUS_STYLES: Record<string, string> = {
  above: 'bg-green-100 text-green-700 hover:bg-green-100',
  near: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  below: 'bg-red-100 text-red-700 hover:bg-red-100',
};

/** Human-readable labels for each status. */
const STATUS_LABELS: Record<string, string> = {
  above: 'Above',
  near: 'Near',
  below: 'Below',
};

/** Maps a margin status to a subtle row background color. */
const ROW_BG: Record<string, string> = {
  above: 'bg-green-50/50',
  near: '',
  below: 'bg-yellow-50/50',
};

/**
 * Displays a table of client margins with color-coded status badges and row
 * backgrounds. Shows an empty state when no client data is available.
 */
export function ClientMarginTable({ clients }: ClientMarginTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Margins</CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            No client data available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead className="text-right">Current Margin %</TableHead>
                <TableHead className="text-right">Target %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Costs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.clientId} className={ROW_BG[client.status] ?? ''}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {client.clientName}
                      {client.isNewClient && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          New
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{client.margin.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{client.target.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[client.status] ?? ''}>
                      {STATUS_LABELS[client.status] ?? client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(client.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.costs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
