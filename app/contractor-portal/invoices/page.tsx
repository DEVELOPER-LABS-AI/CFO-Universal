import { requireContractor } from '@/lib/auth/helpers'
import { getInvoiceHistory, getOrCreateDraftInvoice } from '@/app/actions/contractor-portal-actions'
import { redirect } from 'next/navigation'
import { InvoiceStatusBadge } from '@/components/contractor-portal/InvoiceStatusBadge'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'

interface InvoicesPageProps {
  searchParams: Promise<{ month?: string; year?: string }>
}

/**
 * Contractor portal invoices list page.
 * If month/year query params are provided, creates or retrieves a draft invoice
 * and redirects to the detail page. Otherwise displays invoice history.
 */
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  await requireContractor()

  const params = await searchParams
  const { month, year } = params

  // If month/year params exist, create draft and redirect to it
  if (month && year) {
    const result = await getOrCreateDraftInvoice(Number(month), Number(year))
    if (result.success && result.data) {
      redirect(`/contractor-portal/invoices/${result.data.id}`)
    }
  }

  const result = await getInvoiceHistory()
  const invoices = result.success ? result.data ?? [] : []

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage your monthly invoices</p>
        </div>
        <Link
          href={`/contractor-portal/invoices?month=${currentMonth}&year=${currentYear}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Current Month Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No invoices yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first invoice for the current month
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice: any) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {monthNames[invoice.month]} {invoice.year}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    ${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {invoice.payment ? (
                      <span className={
                        invoice.payment.status === 'COMPLETED' ? 'text-green-600' :
                        invoice.payment.status === 'FAILED' ? 'text-red-600' :
                        'text-yellow-600'
                      }>
                        {invoice.payment.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {invoice.submitted_at
                      ? new Date(invoice.submitted_at).toLocaleDateString()
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/contractor-portal/invoices/${invoice.id}`}
                      className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                    >
                      View
                    </Link>
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
