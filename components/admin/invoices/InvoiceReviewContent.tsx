'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import { InvoiceReviewDetail } from './InvoiceReviewDetail'
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

interface InvoiceReviewContentProps {
  invoices: InvoiceListItem[]
}

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
]

export function InvoiceReviewContent({ invoices }: InvoiceReviewContentProps) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const filtered = statusFilter === 'ALL'
    ? invoices
    : invoices.filter((inv) => inv.status === statusFilter)

  // Count by status for badges
  const submittedCount = invoices.filter((inv) => inv.status === 'SUBMITTED').length

  if (selectedInvoiceId) {
    return (
      <InvoiceReviewDetail
        invoiceId={selectedInvoiceId}
        onBack={() => setSelectedInvoiceId(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex gap-2">
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

      {/* Invoice Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Line Items</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => {
                const invoiceDate = new Date(invoice.year, invoice.month - 1)
                return (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{invoice.agency.name}</TableCell>
                    <TableCell>
                      {invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{invoice._count.line_items}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(invoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
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
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
