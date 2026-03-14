import { requireAgencyAdmin } from '@/lib/auth/helpers'
import { getInvoiceHistory, getOrCreateDraftInvoice } from '@/app/actions/agency-invoice-actions'
import { InvoiceListContent } from '@/components/agency-portal/InvoiceListContent'
import { redirect } from 'next/navigation'

interface InvoicesPageProps {
  searchParams: Promise<{ month?: string; year?: string }>
}

/**
 * Agency portal invoices list page.
 * If month/year query params are provided, creates or retrieves a draft invoice
 * and redirects to the detail page. Otherwise displays invoice history.
 */
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  await requireAgencyAdmin()

  const params = await searchParams
  const { month, year } = params

  // If month/year params exist, create draft and redirect to it
  if (month && year) {
    const invoice = await getOrCreateDraftInvoice(Number(month), Number(year))
    redirect(`/agency-portal/invoices/${invoice.id}`)
  }

  const invoices = await getInvoiceHistory()

  return <InvoiceListContent invoices={invoices} />
}
