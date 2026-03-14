'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmModalProps {
  /** Entity type label shown in dialog, e.g. "agency", "staff member" */
  entityName: string;
  /** The specific record name shown, e.g. "Acme Agency" */
  displayName: string;
  /** Called when the user confirms deletion */
  onConfirm: () => Promise<void>;
  /** Element that opens the dialog */
  trigger: React.ReactNode;
}

export function DeleteConfirmModal({
  entityName,
  displayName,
  onConfirm,
  trigger,
}: DeleteConfirmModalProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      toast.success(`${displayName} deleted successfully`);
      setOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || `Failed to delete ${entityName}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {entityName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-foreground">{displayName}</span>? This action cannot
          be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
