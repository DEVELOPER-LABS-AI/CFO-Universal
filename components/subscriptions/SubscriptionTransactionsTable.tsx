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
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';

interface Transaction {
  id: string;
  mercury_transaction_id: string;
  amount: number;
  transaction_date: string;
  merchant_name: string | null;
  bank_description: string | null;
  counterparty_name: string | null;
  period_month: number | null;
  period_year: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SubscriptionTransactionsTableProps {
  subscriptionId: string;
  subscriptionName: string;
}

export function SubscriptionTransactionsTable({
  subscriptionId,
  subscriptionName,
}: SubscriptionTransactionsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const limit = 25;

  const fetchTransactions = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/subscriptions/${subscriptionId}/transactions?page=${pageNum}&limit=${limit}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setTransactions(json.data);
      setPagination(json.pagination);
    } catch {
      console.error('Failed to fetch subscription transactions');
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    fetchTransactions(page);
  }, [page, fetchTransactions]);

  const handleUnlink = async (recordId: string) => {
    if (!confirm('Remove this transaction from this subscription?')) return;
    setUnlinking(recordId);
    try {
      const res = await fetch(
        `/api/subscriptions/${subscriptionId}/transactions/${recordId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        await fetchTransactions(page);
      }
    } catch {
      console.error('Failed to unlink transaction');
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mercury Transactions</CardTitle>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              {pagination.total} transaction{pagination.total !== 1 ? 's' : ''} linked to {subscriptionName}
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
            No transactions linked yet. Link this subscription to a Mercury merchant to start
            tracking costs.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank Statement Name</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  // Show the most detailed name available:
                  // bank_description (raw bank statement) > counterparty_name > merchant_name
                  const bankName = tx.bank_description || tx.counterparty_name || tx.merchant_name;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(new Date(tx.transaction_date))}</TableCell>
                      <TableCell>
                        <span className="font-medium">{bankName}</span>
                        {tx.bank_description && tx.counterparty_name && tx.bank_description !== tx.counterparty_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Counterparty: {tx.counterparty_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{subscriptionName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.period_month}/{tx.period_year}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                          disabled={unlinking === tx.id}
                          onClick={() => handleUnlink(tx.id)}
                          title="Unlink this transaction"
                        >
                          {unlinking === tx.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
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
