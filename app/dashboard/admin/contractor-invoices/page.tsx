import { requireAdmin } from '@/lib/auth/helpers'
import { getAllContractorInvoices } from '@/app/actions/contractor-admin-actions'
import { ContractorInvoiceListContent } from '@/components/admin/invoices/ContractorInvoiceListContent'

/**
 * Admin page listing all contractor invoices with filtering and review actions.
 */
export default async function ContractorInvoicesPage() {
  await requireAdmin()

  const result = await getAllContractorInvoices()
  const invoices = result.success ? result.data ?? [] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contractor Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve contractor invoice submissions.
        </p>
      </div>

      <ContractorInvoiceListContent invoices={invoices} />
    </div>
  )
}
