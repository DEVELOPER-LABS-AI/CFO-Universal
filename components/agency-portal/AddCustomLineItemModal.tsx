'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { addLineItem } from '@/app/actions/agency-invoice-actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AddCustomLineItemModalProps {
  trigger: React.ReactNode
  invoiceId: string
}

/**
 * Dialog modal for adding a custom line item to a draft invoice.
 * Accepts a trigger element and the invoice ID.
 */
export function AddCustomLineItemModal({ trigger, invoiceId }: AddCustomLineItemModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  /** Reset form fields to their initial state. */
  function resetForm() {
    setDescription('')
    setAmount('')
  }

  /** Handle form submission to add a custom line item. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedAmount = parseFloat(amount)
    if (!description.trim()) {
      toast.error('Description is required')
      return
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be a positive number')
      return
    }

    setIsLoading(true)
    try {
      await addLineItem({
        invoice_id: invoiceId,
        type: 'CUSTOM',
        description: description.trim(),
        amount: parsedAmount,
      })
      toast.success('Custom line item added')
      resetForm()
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add line item')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Custom Line Item</DialogTitle>
            <DialogDescription>
              Add a custom charge to this invoice. Enter a description and amount.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Additional consulting hours"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
