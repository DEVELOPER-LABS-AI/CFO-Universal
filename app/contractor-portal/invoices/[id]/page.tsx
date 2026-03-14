import { requireContractor } from '@/lib/auth/helpers'
import { getInvoice } from '@/app/actions/contractor-portal-actions'
import { InvoiceForm } from '@/components/contractor-portal/InvoiceForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Contractor portal invoice detail page.
 * Fetches the invoice by ID and renders the full InvoiceForm.
 */
export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  await requireContractor()

  const { id } = await params
  const result = await getInvoice(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/contractor-portal/invoices"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>

      <InvoiceForm invoice={result.data} />
    </div>
  )
}
