import { requireAdmin } from '@/lib/auth/helpers'
import { getContractorInvoiceForReview } from '@/app/actions/contractor-admin-actions'
import { ContractorInvoiceReview } from '@/components/admin/ContractorInvoiceReview'
import { notFound } from 'next/navigation'

interface ContractorInvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Admin page for reviewing a single contractor invoice.
 */
export default async function ContractorInvoiceDetailPage({ params }: ContractorInvoiceDetailPageProps) {
  await requireAdmin()

  const { id } = await params
  const result = await getContractorInvoiceForReview(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return <ContractorInvoiceReview invoice={result.data} />
}
