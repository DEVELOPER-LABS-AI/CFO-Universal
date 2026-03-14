import { getContractorDashboard, getInvoiceHistory } from '@/app/actions/contractor-portal-actions'
import Link from 'next/link'
import { FileText, Clock, DollarSign, Upload, ArrowRight } from 'lucide-react'
import { InvoiceStatusBadge } from '@/components/contractor-portal/InvoiceStatusBadge'

/**
 * Contractor portal dashboard — a simple single-page overview showing:
 * Total Payout, Pending amount, current month invoice with submit action,
 * documentation status, and recent invoice history.
 */
export default async function ContractorDashboardPage() {
  const [dashResult, historyResult] = await Promise.all([
    getContractorDashboard(),
    getInvoiceHistory(),
  ])

  if (!dashResult.success) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading dashboard: {dashResult.error}</p>
      </div>
    )
  }

  const { contractor, currentInvoice, stats } = dashResult.data!
  const recentInvoices = historyResult.success ? (historyResult.data ?? []).slice(0, 5) : []

  const now = new Date()
  const currentMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthNum = now.getMonth() + 1
  const yearNum = now.getFullYear()

  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {contractor.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {currentMonth} overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Payout</p>
              <p className="text-xl font-semibold text-gray-900">
                ${Number(stats.totalPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-gray-900">
                ${Number(stats.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Invoices</p>
              <p className="text-xl font-semibold text-gray-900">
                {stats.invoiceCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Submit for Payment — Current Month Invoice */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Submit for Payment
        </h2>

        {currentInvoice ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {monthNames[currentInvoice.month]} {currentInvoice.year}
              </p>
              <p className="text-lg font-semibold mt-1">
                ${Number(currentInvoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-2">
                <InvoiceStatusBadge status={currentInvoice.status} />
              </div>
            </div>
            <Link
              href={`/contractor-portal/invoices/${currentInvoice.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors"
            >
              {currentInvoice.status === 'DRAFT' ? 'Edit & Submit' : 'View Invoice'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">No invoice for this month yet</p>
            <Link
              href={`/contractor-portal/invoices?month=${monthNum}&year=${yearNum}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors"
            >
              Create Invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Documentation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Documentation</h2>
          {currentInvoice && currentInvoice.status === 'DRAFT' && (
            <Link
              href={`/contractor-portal/invoices/${currentInvoice.id}`}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Documents
            </Link>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Upload your SOW, invoices, and supporting documents through the invoice detail page.
          Required documents must be attached before submitting.
        </p>
      </div>

      {/* History Log */}
      {recentInvoices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">History</h2>
            <Link
              href="/contractor-portal/invoices"
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              View All
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentInvoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {monthNames[inv.month]} {inv.year}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    ${Number(inv.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
