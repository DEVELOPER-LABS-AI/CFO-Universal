import { requireAgencyAdmin } from '@/lib/auth/helpers'
import { getAgencyInfo } from '@/app/actions/agency-portal-actions'
import { getInvoiceHistory } from '@/app/actions/agency-invoice-actions'
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import Link from 'next/link'
import { Users, Settings, FileText, ArrowRight } from 'lucide-react'

export default async function AgencyPortalDashboard() {
  const user = await requireAgencyAdmin()
  const [agency, invoices] = await Promise.all([
    getAgencyInfo(),
    getInvoiceHistory(),
  ])

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthName = now.toLocaleString('default', { month: 'long' })

  // Find current month invoice
  const currentInvoice = invoices.find(
    (inv) => inv.month === currentMonth && inv.year === currentYear
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back. Here&apos;s your agency overview for {monthName} {currentYear}.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/agency-portal/staff"
          className="bg-white rounded-lg border border-gray-200 p-5 hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {agency._count.staff}
              </p>
            </div>
            <Users className="h-8 w-8 text-gray-300" />
          </div>
        </Link>

        <Link
          href="/agency-portal/invoices"
          className="bg-white rounded-lg border border-gray-200 p-5 hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {agency._count.invoices}
              </p>
            </div>
            <FileText className="h-8 w-8 text-gray-300" />
          </div>
        </Link>

        <Link
          href="/agency-portal/services"
          className="bg-white rounded-lg border border-gray-200 p-5 hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Services</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">Manage</p>
            </div>
            <Settings className="h-8 w-8 text-gray-300" />
          </div>
        </Link>
      </div>

      {/* Current Month Invoice */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {monthName} {currentYear} Invoice
          </h2>
        </div>
        <div className="p-6">
          {currentInvoice ? (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <InvoiceStatusBadge status={currentInvoice.status} />
                  <span className="text-sm text-gray-500">
                    {currentInvoice._count.line_items} line items
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${Number(currentInvoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Link
                href={`/agency-portal/invoices/${currentInvoice.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                View Invoice <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                No invoice created yet for this month. Start by reviewing your staff and services.
              </p>
              <Link
                href={`/agency-portal/invoices?month=${currentMonth}&year=${currentYear}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                Create Invoice <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {invoices.slice(0, 5).map((invoice) => {
              const invoiceDate = new Date(invoice.year, invoice.month - 1)
              return (
                <Link
                  key={invoice.id}
                  href={`/agency-portal/invoices/${invoice.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    ${Number(invoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
