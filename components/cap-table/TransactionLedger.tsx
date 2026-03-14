'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight } from 'lucide-react';

/** Shape of a single equity transaction for display in the ledger. */
interface Transaction {
  /** Unique transaction ID. */
  id: string;
  /** Type of equity transaction. */
  transaction_type: string;
  /** ISO date string for the transaction date. */
  transaction_date: string;
  /** The share class involved in the transaction. */
  share_class: { id: string; name: string };
  /** The source stakeholder, if applicable. */
  from_stakeholder: { id: string; name: string } | null;
  /** The recipient stakeholder, if applicable. */
  to_stakeholder: { id: string; name: string } | null;
  /** Number of shares affected by the transaction. */
  shares_affected: number;
  /** Price per share at the time of transaction, if recorded. */
  price_per_share: number | null;
  /** Optional notes about the transaction. */
  notes: string | null;
  /** User ID of the person who recorded the transaction. */
  created_by: string;
  /** ISO date string for when the transaction was created. */
  created_at: string;
}

/**
 * Props for the TransactionLedger component.
 */
interface TransactionLedgerProps {
  /** Array of transactions to display in the ledger table. */
  transactions: Transaction[];
}

/** Maps transaction types to their Badge color variants. */
const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  GRANT: 'bg-green-100 text-green-800 hover:bg-green-100',
  TRANSFER: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  PURCHASE: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  CANCELLATION: 'bg-red-100 text-red-800 hover:bg-red-100',
};

/**
 * Displays a read-only ledger of equity transactions in a table format.
 * Each row shows the transaction date, type badge, share class, stakeholder flow,
 * shares affected, price per share, and optional notes.
 */
export function TransactionLedger({ transactions }: TransactionLedgerProps) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No transactions recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Share Class</TableHead>
          <TableHead>From</TableHead>
          <TableHead></TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-right">Shares</TableHead>
          <TableHead className="text-right">Price/Share</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            {/* Date */}
            <TableCell className="whitespace-nowrap">
              {new Date(txn.transaction_date).toLocaleDateString()}
            </TableCell>

            {/* Type Badge */}
            <TableCell>
              <Badge
                className={
                  TRANSACTION_TYPE_COLORS[txn.transaction_type] ?? ''
                }
                variant="secondary"
              >
                {txn.transaction_type}
              </Badge>
            </TableCell>

            {/* Share Class */}
            <TableCell>{txn.share_class.name}</TableCell>

            {/* From Stakeholder */}
            <TableCell>
              {txn.from_stakeholder?.name ?? <span className="text-muted-foreground">--</span>}
            </TableCell>

            {/* Arrow */}
            <TableCell className="px-1">
              {(txn.from_stakeholder || txn.to_stakeholder) && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </TableCell>

            {/* To Stakeholder */}
            <TableCell>
              {txn.to_stakeholder?.name ?? <span className="text-muted-foreground">--</span>}
            </TableCell>

            {/* Shares Affected */}
            <TableCell className="text-right font-medium">
              {txn.shares_affected.toLocaleString()}
            </TableCell>

            {/* Price Per Share */}
            <TableCell className="text-right">
              {txn.price_per_share != null
                ? `$${txn.price_per_share.toFixed(2)}`
                : <span className="text-muted-foreground">--</span>}
            </TableCell>

            {/* Notes */}
            <TableCell className="max-w-[200px] truncate">
              {txn.notes ?? <span className="text-muted-foreground">--</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
