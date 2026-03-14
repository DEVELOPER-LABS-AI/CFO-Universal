'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import {
  getInvoiceForReview,
  reviewInvoice,
  markInvoicePaid,
  addInvoiceComment,
} from '@/app/actions/agency-invoice-actions'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, DollarSign, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InvoiceStatus, InvoiceLineItemType } from '@prisma/client'

interface InvoiceData {
  id: string
  agency_id: string
  month: number
  year: number
  status: InvoiceStatus
  subtotal: unknown
  submitted_at: string | null
  reviewed_at: string | null
  paid_at: string | null
  agency: { id: string; name: string }
  line_items: Array<{
    id: string
    type: InvoiceLineItemType
    description: string
    amount: unknown
    metadata: unknown
  }>
  comments: Array<{
    id: string
    user_name: string
    comment: string
    created_at: string
  }>
}

const typeColors: Record<string, string> = {
  STAFF_COST: 'bg-blue-100 text-blue-700',
  BONUS: 'bg-purple-100 text-purple-700',
  SERVICE: 'bg-green-100 text-green-700',
  CUSTOM: 'bg-gray-100 text-gray-700',
}

interface InvoiceReviewDetailProps {
  invoiceId: string
  onBack: () => void
}

export function InvoiceReviewDetail({ invoiceId, onBack }: InvoiceReviewDetailProps) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    loadInvoice()
  }, [invoiceId])

  async function loadInvoice() {
    try {
      setLoading(true)
      const data = await getInvoiceForReview(invoiceId)
      setInvoice(data as unknown as InvoiceData)
    } catch (err) {
      toast.error('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    setActionLoading(true)
    try {
      await reviewInvoice({ invoice_id: invoiceId, action: 'approve' })
      toast.success('Invoice approved')
      router.refresh()
      await loadInvoice()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setActionLoading(true)
    try {
      await reviewInvoice({
        invoice_id: invoiceId,
        action: 'reject',
        comment: rejectComment,
      })
      toast.success('Invoice rejected and returned to draft')
      setShowRejectForm(false)
      setRejectComment('')
      router.refresh()
      await loadInvoice()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid() {
    setActionLoading(true)
    try {
      await markInvoicePaid(invoiceId)
      toast.success('Invoice marked as paid')
      router.refresh()
      await loadInvoice()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as paid')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    try {
      await addInvoiceComment({ invoice_id: invoiceId, comment: newComment })
      setNewComment('')
      await loadInvoice()
    } catch (err) {
      toast.error('Failed to add comment')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Back
        </Button>
      </div>
    )
  }

  const invoiceDate = new Date(invoice.year, invoice.month - 1)
  const periodLabel = invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  // Group line items by type
  const groupedItems = invoice.line_items.reduce(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type].push(item)
      return acc
    },
    {} as Record<string, typeof invoice.line_items>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {invoice.agency.name} - {periodLabel}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <InvoiceStatusBadge status={invoice.status} />
              {invoice.submitted_at && (
                <span className="text-xs text-gray-500">
                  Submitted {new Date(invoice.submitted_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {invoice.status === 'SUBMITTED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </>
          )}
          {invoice.status === 'APPROVED' && (
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4 mr-1" /> Mark as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            Provide a reason for rejection (invoice will return to draft):
          </p>
          <Textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Reason for rejection..."
            className="bg-white"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowRejectForm(false)
                setRejectComment('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={actionLoading || !rejectComment.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      )}

      {/* Line Items */}
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
            {Object.entries(groupedItems).map(([type, items]) => (
              items.map((item, idx) => (
                <TableRow key={item.id}>
                  {idx === 0 && (
                    <TableCell rowSpan={items.length} className="align-top">
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                          typeColors[type] || 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {type.replace('_', ' ')}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            ))}
          </TableBody>
        </Table>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            ${Number(invoice.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {invoice.comments.length === 0 ? (
            <div className="px-6 py-4 text-sm text-gray-500">No comments yet.</div>
          ) : (
            invoice.comments.map((comment) => (
              <div key={comment.id} className="px-6 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.user_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.comment}</p>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
            />
            <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
