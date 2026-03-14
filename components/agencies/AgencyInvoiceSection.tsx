'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import { InvoiceReviewDetail } from '@/components/admin/invoices/InvoiceReviewDetail'
import type { InvoiceStatus } from '@prisma/client'

interface InvoiceListItem {
  id: string
  agency_id: string
  month: number
  year: number
  status: InvoiceStatus
  subtotal: unknown
  submitted_at: Date | string | null
  agency: { id: string; name: string }
  _count: { line_items: number; comments: number }
}

interface AgencyInvoiceSectionProps {
  invoices: InvoiceListItem[]
}

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
]

/**
 * Client component for displaying and reviewing agency invoices inline.
 * Manages list-to-detail navigation state, reusing InvoiceReviewDetail for
 * approve/reject/mark-paid actions.
 */
export function AgencyInvoiceSection({ invoices }: AgencyInvoiceSectionProps) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const filtered = statusFilter === 'ALL'
    ? invoices
    : invoices.filter((inv) => inv.status === statusFilter)

  const submittedCount = invoices.filter((inv) => inv.status === 'SUBMITTED').length

  // Detail view - reuse InvoiceReviewDetail
  if (selectedInvoiceId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <InvoiceReviewDetail
            invoiceId={selectedInvoiceId}
            onBack={() => setSelectedInvoiceId(null)}
          />
        </CardContent>
      </Card>
    )
  }

  // List view
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Invoices submitted by this agency for review and payment tracking
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Status filter tabs */}
        <div className="flex gap-2 mb-4">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="relative"
            >
              {filter.label}
              {filter.value === 'SUBMITTED' && submittedCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {submittedCount}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Invoice table */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No invoices found. Agencies submit invoices through their portal.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Line Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => {
                const invoiceDate = new Date(invoice.year, invoice.month - 1)
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{invoice._count.line_items}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(invoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invoice.submitted_at
                        ? new Date(invoice.submitted_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedInvoiceId(invoice.id)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
