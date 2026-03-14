'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReceiptUpload } from './ReceiptUpload';
import { createBDRExpense, getExpenseCategories } from '@/app/actions/bdr-portal-actions';
import { toast } from 'sonner';

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Dialog form for BDR to submit an expense with optional receipt.
 */
export function ExpenseForm({ open, onOpenChange, onSuccess }: ExpenseFormProps) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      getExpenseCategories().then((result) => {
        if (result.success) setCategories(result.data);
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('expense_date', expenseDate);
    formData.set('category_id', categoryId);
    formData.set('amount', amount);
    if (description) formData.set('description', description);
    if (receiptFile) formData.set('receipt', receiptFile);

    const result = await createBDRExpense(formData);

    if (result.success) {
      toast.success('Expense submitted');
      onOpenChange(false);
      // Reset form
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setCategoryId('');
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      onSuccess();
    } else {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Expense</DialogTitle>
          <DialogDescription>Submit an expense for reimbursement</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Date</Label>
              <Input
                id="expenseDate"
                type="date"
                value={expenseDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Receipt (optional)</Label>
            <ReceiptUpload onFileSelect={setReceiptFile} selectedFile={receiptFile} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !categoryId}>
              {isSubmitting ? 'Submitting...' : 'Submit Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
