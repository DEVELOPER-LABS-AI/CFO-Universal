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
import { InvoiceStatusBadge } from '@/components/contractor-portal/InvoiceStatusBadge'

interface ContractorInvoiceListItem {
  id: string
  contractor_id: string
  month: number
  year: number
  status: string
  total_amount: unknown
  submitted_at: Date | string | null
  contractor: { id: string; name: string; email: string | null }
}

interface ContractorInvoiceListContentProps {
  invoices: ContractorInvoiceListItem[]
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Draft', value: 'DRAFT' },
]

/**
 * Client component for the contractor invoices list page.
 * Mirrors the InvoiceReviewContent component for agency invoices.
 */
export function ContractorInvoiceListContent({ invoices }: ContractorInvoiceListContentProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const filtered = statusFilter === 'ALL'
    ? invoices
    : invoices.filter((inv) => inv.status === statusFilter)

  const submittedCount = invoices.filter((inv) => inv.status === 'SUBMITTED').length

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
              <TableHead>Contractor</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => {
                const invoiceDate = new Date(invoice.year, invoice.month - 1)
                return (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{invoice.contractor.name}</TableCell>
                    <TableCell>
                      {invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status as any} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                        onClick={() => router.push(`/dashboard/admin/contractor-invoices/${invoice.id}`)}
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
