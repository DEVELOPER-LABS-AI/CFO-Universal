'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { InvoiceStatusBadge } from '@/components/agency-portal/InvoiceStatusBadge'
import { AddCustomLineItemModal } from '@/components/agency-portal/AddCustomLineItemModal'
import { submitInvoice, removeLineItem, addInvoiceComment, updateLineItem } from '@/app/actions/agency-invoice-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trash2, Send, Plus, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'

interface ClientAllocation {
  assignment_id: string
  client_id: string
  client_name: string
  assignment_type: 'PROJECT' | 'RETAINER'
  base_percentage: number
  allocation_percentage: number
}

interface LineItemMetadata {
  rate?: number
  rate_type?: string
  staff_type?: string
  client_allocations?: ClientAllocation[]
  [key: string]: unknown
}

interface LineItem {
  id: string
  type: 'STAFF_COST' | 'BONUS' | 'SERVICE' | 'CUSTOM' | 'REIMBURSEMENT'
  description: string
  amount: unknown
  sort_order: number
  metadata?: unknown
}

/** Type-safe accessor for line item metadata. */
function getMetadata(item: LineItem): LineItemMetadata | null {
  if (!item.metadata || typeof item.metadata !== 'object') return null
  return item.metadata as LineItemMetadata
}

interface Comment {
  id: string
  user_name: string
  comment: string
  created_at: string | Date
}

interface Invoice {
  id: string
  month: number
  year: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'
  subtotal: unknown
  submitted_at: string | Date | null
  reviewed_at: string | Date | null
  paid_at: string | Date | null
  line_items: LineItem[]
  comments: Comment[]
  agency: {
    name: string
  }
}

interface InvoiceDetailContentProps {
  invoice: Invoice
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TYPE_BADGE_CONFIG: Record<LineItem['type'], { label: string; className: string }> = {
  STAFF_COST: { label: 'Staff Cost', className: 'bg-blue-100 text-blue-700' },
  BONUS: { label: 'Bonus', className: 'bg-purple-100 text-purple-700' },
  REIMBURSEMENT: { label: 'Reimbursement', className: 'bg-orange-100 text-orange-700' },
  SERVICE: { label: 'Service', className: 'bg-green-100 text-green-700' },
  CUSTOM: { label: 'Custom', className: 'bg-gray-100 text-gray-700' },
}

/**
 * Client component that displays full invoice details including line items,
 * comments, and action buttons for draft invoices.
 */
export function InvoiceDetailContent({ invoice }: InvoiceDetailContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [savingAllocation, setSavingAllocation] = useState<string | null>(null)

  const isDraft = invoice.status === 'DRAFT'

  /** Toggle expanded state for a line item's client allocation section. */
  function toggleExpand(itemId: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  /** Update a client allocation percentage in the line item metadata. */
  async function handleAllocationChange(item: LineItem, assignmentId: string, newPercentage: number) {
    const meta = getMetadata(item)
    if (!meta?.client_allocations) return
    setSavingAllocation(`${item.id}-${assignmentId}`)

    const updatedAllocations = meta.client_allocations.map((a) =>
      a.assignment_id === assignmentId
        ? { ...a, allocation_percentage: newPercentage }
        : a
    )

    try {
      await updateLineItem(item.id, {
        metadata: { ...meta, client_allocations: updatedAllocations },
      })
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update allocation')
    } finally {
      setSavingAllocation(null)
    }
  }

  /** Format a currency value for display. */
  function formatCurrency(amount: unknown): string {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  /** Format a date for display. */
  function formatDate(date: string | Date | null): string {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /** Submit the invoice for review. */
  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      await submitInvoice(invoice.id)
      toast.success('Invoice submitted for review')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Remove a line item from the invoice. */
  async function handleRemoveLineItem(lineItemId: string) {
    setRemovingId(lineItemId)
    try {
      await removeLineItem(lineItemId)
      toast.success('Line item removed')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove line item')
    } finally {
      setRemovingId(null)
    }
  }

  /** Add a comment to the invoice. */
  async function handleAddComment() {
    if (!commentText.trim()) return
    setIsAddingComment(true)
    try {
      await addInvoiceComment({ invoice_id: invoice.id, comment: commentText.trim() })
      setCommentText('')
      toast.success('Comment added')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add comment')
    } finally {
      setIsAddingComment(false)
    }
  }

  // Group line items by type for subtotals
  const groupedItems = invoice.line_items.reduce<Record<string, LineItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {})

  const typeOrder: LineItem['type'][] = ['STAFF_COST', 'BONUS', 'REIMBURSEMENT', 'SERVICE', 'CUSTOM']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice - {MONTH_NAMES[invoice.month - 1]} {invoice.year}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{invoice.agency.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <InvoiceStatusBadge status={invoice.status} />
          {isDraft && (
            <>
              <AddCustomLineItemModal
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Item
                  </Button>
                }
                invoiceId={invoice.id}
              />
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || invoice.line_items.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {(invoice.submitted_at || invoice.reviewed_at || invoice.paid_at) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex gap-6 text-sm text-gray-500">
            {invoice.submitted_at && (
              <div>
                <span className="font-medium text-gray-700">Submitted:</span>{' '}
                {formatDate(invoice.submitted_at)}
              </div>
            )}
            {invoice.reviewed_at && (
              <div>
                <span className="font-medium text-gray-700">Reviewed:</span>{' '}
                {formatDate(invoice.reviewed_at)}
              </div>
            )}
            {invoice.paid_at && (
              <div>
                <span className="font-medium text-gray-700">Paid:</span>{' '}
                {formatDate(invoice.paid_at)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
        </div>
        {invoice.line_items.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p className="text-sm">No line items yet. Add custom items to get started.</p>
          </div>
        ) : (
          <div>
            {typeOrder.map((type) => {
              const items = groupedItems[type]
              if (!items || items.length === 0) return null

              const typeConfig = TYPE_BADGE_CONFIG[type]
              const typeSubtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)

              return (
                <div key={type}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-32">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-36">Amount</TableHead>
                        {isDraft && <TableHead className="text-right w-20">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const meta = getMetadata(item)
                        const hasAllocations = type === 'STAFF_COST' &&
                          meta?.client_allocations &&
                          meta.client_allocations.length > 0
                        const isExpanded = expandedItems.has(item.id)

                        return (
                          <>
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {hasAllocations && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => toggleExpand(item.id)}
                                    >
                                      {isExpanded
                                        ? <ChevronDown className="h-3.5 w-3.5" />
                                        : <ChevronRight className="h-3.5 w-3.5" />}
                                    </Button>
                                  )}
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.className}`}
                                  >
                                    {typeConfig.label}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-900">
                                {item.description}
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              {isDraft && (
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLineItem(item.id)}
                                    disabled={removingId === item.id}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                            {/* Client Allocation Breakdown (expandable for STAFF_COST items) */}
                            {hasAllocations && isExpanded && (
                              <TableRow key={`${item.id}-allocations`} className="bg-blue-50/50">
                                <TableCell colSpan={isDraft ? 4 : 3} className="py-3 px-8">
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      Client Allocation for this month
                                    </p>
                                    <div className="space-y-1.5">
                                      {meta!.client_allocations!.map((alloc) => {
                                        const isSaving = savingAllocation === `${item.id}-${alloc.assignment_id}`
                                        const isChanged = alloc.allocation_percentage !== alloc.base_percentage
                                        return (
                                          <div
                                            key={alloc.assignment_id}
                                            className="flex items-center gap-3 text-sm"
                                          >
                                            <span className="font-medium text-gray-700 min-w-[140px]">
                                              {alloc.client_name}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                              {alloc.assignment_type}
                                            </Badge>
                                            <span className="text-xs text-gray-400">
                                              Base: {alloc.base_percentage}%
                                            </span>
                                            {isDraft ? (
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  step={5}
                                                  value={alloc.allocation_percentage}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value)
                                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                                      handleAllocationChange(item, alloc.assignment_id, val)
                                                    }
                                                  }}
                                                  className="w-20 h-7 text-sm"
                                                  disabled={isSaving}
                                                />
                                                <span className="text-xs text-gray-500">%</span>
                                                {isChanged && (
                                                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                                    modified
                                                  </Badge>
                                                )}
                                              </div>
                                            ) : (
                                              <span className={`text-sm font-medium ${isChanged ? 'text-amber-700' : 'text-gray-900'}`}>
                                                {alloc.allocation_percentage}%
                                                {isChanged && ' (modified)'}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                    <p className="text-xs text-gray-400">
                                      Total: {meta!.client_allocations!.reduce((s, a) => s + a.allocation_percentage, 0)}%
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                      {/* Type Subtotal Row */}
                      <TableRow className="bg-gray-50">
                        <TableCell />
                        <TableCell className="text-sm font-medium text-gray-700">
                          {typeConfig.label} Subtotal
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {formatCurrency(typeSubtotal)}
                        </TableCell>
                        {isDraft && <TableCell />}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )
            })}
          </div>
        )}

        {/* Invoice Total */}
        {invoice.line_items.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            Comments ({invoice.comments.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {invoice.comments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="text-sm">No comments yet.</p>
            </div>
          ) : (
            invoice.comments.map((comment) => (
              <div key={comment.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.user_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.comment}</p>
              </div>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
            />
            <Button
              onClick={handleAddComment}
              disabled={isAddingComment || !commentText.trim()}
              variant="outline"
              size="sm"
            >
              {isAddingComment ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
