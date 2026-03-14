'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addInvoiceLineItem,
  updateInvoiceLineItem,
  removeInvoiceLineItem,
  submitInvoice,
} from '@/app/actions/contractor-portal-actions'
import { DocumentUpload } from '@/components/contractor-portal/DocumentUpload'
import { InvoiceStatusBadge } from '@/components/contractor-portal/InvoiceStatusBadge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Plus,
  Trash2,
  Send,
  AlertCircle,
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

interface Payment {
  status: string
  amount: any
  payment_method: string | null
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
  rejection_reason: string | null
  line_items: LineItem[]
  documents: Document[]
  payment: Payment | null
}

interface InvoiceFormProps {
  invoice: Invoice
}

const LINE_ITEM_TYPES = [
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'BONUS', label: 'Bonus' },
  { value: 'OTHER', label: 'Other' },
]

const monthNames = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Full invoice form with base amount, line items, documents, and submission.
 * Editable only when invoice is in DRAFT status.
 */
export function InvoiceForm({ invoice }: InvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)

  // New line item form state
  const [newType, setNewType] = useState('REIMBURSEMENT')
  const [newDescription, setNewDescription] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const isDraft = invoice.status === 'DRAFT'

  /**
   * Add a new line item to the invoice.
   */
  async function handleAddLineItem() {
    if (!newDescription.trim() || !newAmount) return

    setAddingItem(true)
    const result = await addInvoiceLineItem({
      invoice_id: invoice.id,
      type: newType,
      description: newDescription.trim(),
      amount: parseFloat(newAmount),
    })

    if (result.success) {
      setNewDescription('')
      setNewAmount('')
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
    setAddingItem(false)
  }

  /**
   * Remove a line item from the invoice.
   */
  async function handleRemoveLineItem(lineItemId: string) {
    const result = await removeInvoiceLineItem(lineItemId)
    if (result.success) {
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }

  /**
   * Submit the invoice for admin review.
   */
  async function handleSubmit() {
    setSubmitting(true)
    const result = await submitInvoice(invoice.id)
    if (result.success) {
      toast({ title: 'Invoice submitted', description: 'Your invoice has been submitted for review.' })
      startTransition(() => router.refresh())
    } else {
      toast({ title: 'Cannot submit', description: result.error, variant: 'destructive' })
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {monthNames[invoice.month]} {invoice.year} Invoice
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isDraft ? 'Edit your invoice details and submit when ready' : 'Invoice details'}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status as any} />
      </div>

      {/* Rejection notice */}
      {invoice.rejection_reason && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Invoice was rejected</p>
            <p className="text-sm text-red-600 mt-1">{invoice.rejection_reason}</p>
            <p className="text-xs text-red-500 mt-2">Please make corrections and resubmit.</p>
          </div>
        </div>
      )}

      {/* Amounts summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Base Amount (from contract rate)</span>
            <span className="text-sm font-medium text-gray-900">
              ${Number(invoice.base_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {invoice.line_items.map((item) => (
            <div key={item.id} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {item.description}
                <span className="ml-2 text-xs text-gray-400">({item.type})</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                {isDraft && (
                  <button
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-base font-bold text-gray-900">
              ${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Add line item form */}
      {isDraft && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Line Item</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {LINE_ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="sm:col-span-2 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <Button
                size="sm"
                onClick={handleAddLineItem}
                disabled={addingItem || !newDescription.trim() || !newAmount}
              >
                {addingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Documents section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
        <DocumentUpload
          invoiceId={invoice.id}
          documents={invoice.documents}
          isDraft={isDraft}
          onDocumentsChanged={() => startTransition(() => router.refresh())}
        />
      </div>

      {/* Submit button */}
      {isDraft && (
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || isPending}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit for Review
              </>
            )}
          </Button>
        </div>
      )}

      {/* Payment info */}
      {invoice.payment && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Method</span>
                <span className="text-gray-900">{invoice.payment.payment_method}</span>
              </div>
            )}
            {invoice.payment.completed_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Completed</span>
                <span className="text-gray-900">{new Date(invoice.payment.completed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
