'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reviewContractorInvoice } from '@/app/actions/contractor-admin-actions'
import { initiateContractorPayment, retryPayment } from '@/app/actions/mercury-payment-actions'
import { InvoiceStatusBadge } from '@/components/contractor-portal/InvoiceStatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  Check,
  X,
  Loader2,
  FileText,
  DollarSign,
  ArrowLeft,
  CreditCard,
  RefreshCw,
} from 'lucide-react'

interface LineItem {
  id: string
  type: string
  description: string
  amount: any
  sort_order: number
}

interface Document {
  id: string
  document_type: string
  file_name: string
  file_size: number
  mime_type: string
  uploaded_at: Date | string
}

interface Contractor {
  id: string
  name: string
  email: string | null
  rate: any
  rate_type: string | null
  engagement_type: string | null
}

interface Payment {
  id: string
  status: string
  amount: any
  payment_method: string | null
  mercury_transaction_id: string | null
  completed_at: Date | string | null
}

interface Invoice {
  id: string
  month: number
  year: number
  base_amount: any
  total_amount: any
  status: string
  description: string | null
  submitted_at: Date | string | null
  reviewed_at: Date | string | null
  reviewed_by: string | null
  rejection_reason: string | null
  line_items: LineItem[]
  documents: Document[]
  contractor: Contractor
  payment: Payment | null
}

interface ContractorInvoiceReviewProps {
  invoice: Invoice
}

const monthNames = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DOC_TYPE_LABELS: Record<string, string> = {
  SOW: 'Statement of Work',
  INVOICE: 'Invoice',
  TAX_FORM: 'Tax Form (W-9)',
  OTHER: 'Other',
}

const PAYMENT_METHODS = [
  { value: 'ACH', label: 'ACH Transfer' },
  { value: 'DOMESTIC_WIRE', label: 'Domestic Wire' },
  { value: 'INTERNATIONAL_WIRE', label: 'International Wire' },
] as const

/**
 * Admin component for reviewing a contractor invoice.
 * Shows full invoice details, approve/reject actions, and payment initiation.
 */
export function ContractorInvoiceReview({ invoice }: ContractorInvoiceReviewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | 'pay' | 'retry' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'ACH' | 'DOMESTIC_WIRE' | 'INTERNATIONAL_WIRE'>('ACH')
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)

  const isSubmitted = invoice.status === 'SUBMITTED'
  const isApproved = invoice.status === 'APPROVED'
  const hasFailed = invoice.payment?.status === 'FAILED'

  const periodLabel = `${monthNames[invoice.month]} ${invoice.year}`

  /**
   * Handle approve or reject action.
   */
  async function handleReview(action: 'approve' | 'reject') {
    if (action === 'reject' && !showRejectForm) {
      setShowRejectForm(true)
      return
    }

    if (action === 'reject' && rejectionReason.trim().length < 5) {
      toast({ title: 'Error', description: 'Please provide a rejection reason (min 5 chars)', variant: 'destructive' })
      return
    }

    setActionLoading(action)
    const result = await reviewContractorInvoice({
      invoice_id: invoice.id,
      action,
      ...(action === 'reject' ? { rejection_reason: rejectionReason.trim() } : {}),
    })

    if (result.success) {
      toast({
        title: action === 'approve' ? 'Invoice approved' : 'Invoice rejected',
        description: action === 'approve'
          ? 'The invoice has been approved and is ready for payment.'
          : 'The invoice has been sent back to the contractor for revision.',
      })
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  /**
   * Handle payment initiation for approved invoices.
   */
  async function handlePayment() {
    if (!showPaymentConfirm) {
      setShowPaymentConfirm(true)
      return
    }

    setActionLoading('pay')
    const result = await initiateContractorPayment({
      invoice_id: invoice.id,
      payment_method: paymentMethod,
    })

    if (result.success) {
      toast({
        title: 'Payment initiated',
        description: 'The payment request has been submitted to Mercury for approval.',
      })
      setShowPaymentConfirm(false)
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Payment failed', description: result.error, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  /**
   * Handle retry of a failed payment.
   */
  async function handleRetry() {
    if (!invoice.payment) return

    setActionLoading('retry')
    const result = await retryPayment(invoice.payment.id)

    if (result.success) {
      toast({
        title: 'Payment retried',
        description: 'The payment has been resubmitted to Mercury.',
      })
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Retry failed', description: result.error, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-6">
      {/* Header — matches agency InvoiceReviewDetail layout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/admin/contractor-invoices')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {invoice.contractor.name} - {periodLabel}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <InvoiceStatusBadge status={invoice.status as any} />
              {invoice.submitted_at && (
                <span className="text-xs text-gray-500">
                  Submitted {new Date(invoice.submitted_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons in header */}
        <div className="flex gap-2">
          {isSubmitted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading !== null || isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {actionLoading === 'reject' ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Rejecting</>
                ) : (
                  <><X className="h-4 w-4 mr-1" /> Reject</>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => handleReview('approve')}
                disabled={actionLoading !== null || isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading === 'approve' ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Approving</>
                ) : (
                  <><Check className="h-4 w-4 mr-1" /> Approve</>
                )}
              </Button>
            </>
          )}
          {isApproved && !invoice.payment && (
            <Button
              size="sm"
              onClick={handlePayment}
              disabled={actionLoading !== null || isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading === 'pay' ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-1" /> Initiate Payment</>
              )}
            </Button>
          )}
          {isApproved && invoice.payment && (
            <Button
              size="sm"
              onClick={() => {}}
              disabled
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4 mr-1" /> Payment {invoice.payment.status.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      {/* Reject Form — matches agency red alert box */}
      {showRejectForm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            Provide a reason for rejection (invoice will return to draft):
          </p>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="bg-white"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowRejectForm(false)
                setRejectionReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleReview('reject')}
              disabled={actionLoading !== null || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      )}

      {/* Payment Confirmation — shown when initiating payment */}
      {showPaymentConfirm && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-yellow-800">Confirm payment details:</p>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="w-full max-w-xs border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-yellow-800">
              Pay <strong>${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> to <strong>{invoice.contractor.name}</strong> via {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}?
              This will submit a request to Mercury&apos;s approval queue.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPaymentConfirm(false)}
              disabled={actionLoading !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePayment}
              disabled={actionLoading !== null || isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading === 'pay' ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing</>
              ) : (
                <>Confirm Payment</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Line Items — uses Shadcn Table matching agency pattern */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Base amount row */}
            <TableRow>
              <TableCell>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  BASE
                </span>
              </TableCell>
              <TableCell>Contract rate</TableCell>
              <TableCell className="text-right font-medium">
                ${Number(invoice.base_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
            {/* Additional line items */}
            {invoice.line_items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {item.type}
                  </span>
                </TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right font-medium">
                  ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            ${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Documents ({invoice.documents.length})
          </h3>
        </div>
        <div className="px-6 py-4">
          {invoice.documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents attached</p>
          ) : (
            <ul className="space-y-2">
              {invoice.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900">{doc.file_name}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                    {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(doc.file_size / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
        </div>
        <div className="px-6 py-4 space-y-2 text-sm">
          {invoice.submitted_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">Submitted</span>
              <span className="text-gray-900">{new Date(invoice.submitted_at).toLocaleString()}</span>
            </div>
          )}
          {invoice.reviewed_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">Reviewed</span>
              <span className="text-gray-900">{new Date(invoice.reviewed_at).toLocaleString()}</span>
            </div>
          )}
          {invoice.rejection_reason && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
              <p className="text-sm text-red-600 mt-1">{invoice.rejection_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment info */}
      {invoice.payment && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
          </div>
          <div className="px-6 py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className={
                invoice.payment.status === 'COMPLETED' ? 'text-green-600 font-medium' :
                invoice.payment.status === 'FAILED' ? 'text-red-600 font-medium' :
                'text-yellow-600 font-medium'
              }>
                {invoice.payment.status}
              </span>
            </div>
            {invoice.payment.payment_method && (
              <div className="flex justify-between">
                <span className="text-gray-600">Method</span>
                <span className="text-gray-900">{invoice.payment.payment_method}</span>
              </div>
            )}
            {invoice.payment.completed_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="text-gray-900">{new Date(invoice.payment.completed_at).toLocaleString()}</span>
              </div>
            )}

            {/* Retry button for failed payments */}
            {hasFailed && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button
                  onClick={handleRetry}
                  disabled={actionLoading !== null || isPending}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {actionLoading === 'retry' ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Retrying</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-1" /> Retry Payment</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
