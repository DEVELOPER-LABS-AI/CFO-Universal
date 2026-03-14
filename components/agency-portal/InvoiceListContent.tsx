'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, FileText, ArrowRight } from 'lucide-react'

interface Invoice {
  id: string
  month: number
  year: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'
  subtotal: unknown
  _count: {
    line_items: number
    comments: number
  }
  agency: {
    name: string
  }
}

interface InvoiceListContentProps {
  invoices: Invoice[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Client component that displays the invoice list with a create-new-invoice
 * section and a table of existing invoices.
 */
export function InvoiceListContent({ invoices }: InvoiceListContentProps) {
  const router = useRouter()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  /** Navigate to the invoices page with month/year params to trigger draft creation. */
  function handleCreateInvoice() {
    router.push(`/agency-portal/invoices?month=${selectedMonth}&year=${selectedYear}`)
  }

  /** Format a currency value for display. */
  function formatCurrency(amount: unknown): string {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  // Generate year options: current year +/- 1
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create and manage your monthly invoices.
        </p>
      </div>

      {/* Create New Invoice */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Invoice</h2>
        <div className="flex items-end gap-4">
          <div>
            <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={index + 1} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="block w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleCreateInvoice} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Invoice History</h2>
        </div>
        {invoices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">No invoices yet. Create your first invoice above.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month / Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Line Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {MONTH_NAMES[invoice.month - 1]} {invoice.year}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {invoice._count.line_items}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.subtotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/agency-portal/invoices/${invoice.id}`}
                      className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
