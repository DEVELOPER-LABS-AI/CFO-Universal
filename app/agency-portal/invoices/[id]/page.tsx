import { requireAgencyAdmin } from '@/lib/auth/helpers'
import { getInvoice } from '@/app/actions/agency-invoice-actions'
import { InvoiceDetailContent } from '@/components/agency-portal/InvoiceDetailContent'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Agency portal invoice detail page.
 * Fetches the invoice by ID and renders the full detail view.
 */
export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  await requireAgencyAdmin()

  const { id } = await params
  const invoice = await getInvoice(id)

  return <InvoiceDetailContent invoice={invoice} />
}
