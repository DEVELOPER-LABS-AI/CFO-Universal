import { requireAdmin } from '@/lib/auth/helpers'
import { getAllInvoices } from '@/app/actions/agency-invoice-actions'
import { InvoiceReviewContent } from '@/components/admin/invoices/InvoiceReviewContent'

export default async function AdminInvoiceReviewPage() {
  await requireAdmin()
  const invoices = await getAllInvoices()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agency Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage invoices submitted by agency partners.
        </p>
      </div>

      <InvoiceReviewContent invoices={invoices} />
    </div>
  )
}
