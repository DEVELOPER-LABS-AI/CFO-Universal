'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';

interface ClientTransaction {
  id: string;
  mercury_transaction_id: string;
  amount: number;
  receipt_date: string;
  period_month: number;
  period_year: number;
  bank_description: string | null;
  counterparty_name: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ClientTransactionsTableProps {
  clientId: string;
  clientName: string;
}

export function ClientTransactionsTable({
  clientId,
  clientName,
}: ClientTransactionsTableProps) {
  const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchTransactions = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/transactions?page=${pageNum}&limit=${limit}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setTransactions(json.data);
      setPagination(json.pagination);
    } catch {
      console.error('Failed to fetch client transactions');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchTransactions(page);
  }, [page, fetchTransactions]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mercury Deposits</CardTitle>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              {pagination.total} deposit{pagination.total !== 1 ? 's' : ''} linked to {clientName}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No deposits linked yet. Map Mercury deposits to this client to start tracking revenue.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const description = tx.bank_description || tx.counterparty_name || 'Mercury Deposit';

                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(new Date(tx.receipt_date))}</TableCell>
                      <TableCell>
                        <span className="font-medium">{description}</span>
                        {tx.bank_description && tx.counterparty_name && tx.bank_description !== tx.counterparty_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Counterparty: {tx.counterparty_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.period_month}/{tx.period_year}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +${tx.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
