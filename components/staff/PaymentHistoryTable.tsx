'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface PaymentRecord {
  month: number;
  year: number;
  agencyName: string;
  invoiceStatus: string;
  basePay: number;
  bonuses: number;
  reimbursements: number;
  services: number;
  other: number;
  total: number;
}

interface PaymentHistoryTableProps {
  payments: PaymentRecord[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Displays month-by-month payment history for a staff member
 * from approved/paid agency invoices.
 */
export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No payment history yet. Payments appear here once invoices are approved or paid.
      </p>
    );
  }

  function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Agency</TableHead>
          <TableHead className="text-right">Base Pay</TableHead>
          <TableHead className="text-right">Bonuses</TableHead>
          <TableHead className="text-right">Reimbursements</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={`${payment.year}-${payment.month}`}>
            <TableCell className="font-medium">
              {MONTH_NAMES[payment.month - 1]} {payment.year}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {payment.agencyName}
            </TableCell>
            <TableCell className="text-right">
              {payment.basePay > 0 ? formatCurrency(payment.basePay) : '—'}
            </TableCell>
            <TableCell className="text-right">
              {payment.bonuses > 0 ? formatCurrency(payment.bonuses) : '—'}
            </TableCell>
            <TableCell className="text-right">
              {payment.reimbursements > 0 ? formatCurrency(payment.reimbursements) : '—'}
            </TableCell>
            <TableCell className="text-right font-semibold">
              {formatCurrency(payment.total)}
            </TableCell>
            <TableCell>
              <Badge
                variant={payment.invoiceStatus === 'PAID' ? 'default' : 'secondary'}
              >
                {payment.invoiceStatus === 'PAID' ? 'Paid' : 'Approved'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
