'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createShareClass,
  updateShareClass,
} from '@/app/actions/cap-table';

/** Shape of a share class passed to this component. */
interface ShareClass {
  id: string;
  name: string;
  authorized_shares: number;
  reserved_shares: number;
  issued_shares: number;
  available_shares: number;
  price_per_share: number | null;
}

interface ShareClassConfigProps {
  /** Array of share classes to display. */
  shareClasses: ShareClass[];
}

/** Default form state for the share class dialog. */
interface ShareClassFormData {
  name: string;
  authorized_shares: string;
  reserved_shares: string;
  price_per_share: string;
}

const EMPTY_FORM: ShareClassFormData = {
  name: '',
  authorized_shares: '',
  reserved_shares: '0',
  price_per_share: '',
};

/**
 * Formats a number with locale-aware thousands separators.
 */
function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * T021: ShareClassConfig component.
 *
 * Displays share class cards in a responsive grid with add/edit capabilities.
 * Each card shows the class name, authorized, issued, reserved, and available
 * share counts. An "Add Share Class" button and per-card edit buttons open
 * dialogs backed by server actions.
 */
export function ShareClassConfig({ shareClasses }: ShareClassConfigProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ShareClass | null>(null);
  const [formData, setFormData] = useState<ShareClassFormData>(EMPTY_FORM);

  /**
   * Opens the dialog in "add" mode with a blank form.
   */
  function handleOpenAdd() {
    setEditingClass(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  /**
   * Opens the dialog in "edit" mode, pre-filling the form with the
   * selected share class data.
   */
  function handleOpenEdit(sc: ShareClass) {
    setEditingClass(sc);
    setFormData({
      name: sc.name,
      authorized_shares: String(sc.authorized_shares),
      reserved_shares: String(sc.reserved_shares),
      price_per_share: sc.price_per_share !== null ? String(sc.price_per_share) : '',
    });
    setDialogOpen(true);
  }

  /**
   * Handles dialog close and resets internal state.
   */
  function handleDialogClose(open: boolean) {
    if (!open) {
      setEditingClass(null);
      setFormData(EMPTY_FORM);
    }
    setDialogOpen(open);
  }

  /**
   * Submits the form, calling the appropriate server action (create or update)
   * inside a transition for non-blocking UI updates.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...(editingClass ? { id: editingClass.id } : {}),
      name: formData.name.trim(),
      authorized_shares: parseInt(formData.authorized_shares, 10),
      reserved_shares: parseInt(formData.reserved_shares || '0', 10),
      price_per_share: formData.price_per_share
        ? parseFloat(formData.price_per_share)
        : null,
    };

    startTransition(async () => {
      try {
        if (editingClass) {
          await updateShareClass(payload);
          toast.success(`${payload.name} updated successfully`);
        } else {
          await createShareClass(payload);
          toast.success(`${payload.name} created successfully`);
        }
        setDialogOpen(false);
        setEditingClass(null);
        setFormData(EMPTY_FORM);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'An unexpected error occurred';
        toast.error(message);
      }
    });
  }

  const isEdit = editingClass !== null;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Share Classes</h3>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Share Class
        </Button>
      </div>

      {/* Share class cards grid */}
      {shareClasses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No share classes configured yet. Add one to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shareClasses.map((sc) => (
            <Card key={sc.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{sc.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenEdit(sc)}
                  aria-label={`Edit ${sc.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Authorized</dt>
                  <dd className="text-right font-medium">
                    {formatNumber(sc.authorized_shares)}
                  </dd>

                  <dt className="text-muted-foreground">Issued</dt>
                  <dd className="text-right font-medium">
                    {formatNumber(sc.issued_shares)}
                  </dd>

                  <dt className="text-muted-foreground">Reserved</dt>
                  <dd className="text-right font-medium">
                    {formatNumber(sc.reserved_shares)}
                  </dd>

                  <dt className="text-muted-foreground">Available</dt>
                  <dd className="text-right font-medium">
                    {formatNumber(sc.available_shares)}
                  </dd>

                  {sc.price_per_share !== null && (
                    <>
                      <dt className="text-muted-foreground">Price/Share</dt>
                      <dd className="text-right font-medium">
                        ${sc.price_per_share.toFixed(2)}
                      </dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEdit ? 'Edit Share Class' : 'Add Share Class'}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? `Update the configuration for ${editingClass?.name}.`
                  : 'Define a new share class for your cap table.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="sc-name">Name *</Label>
                <Input
                  id="sc-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Common, Preferred Series A..."
                  required
                />
              </div>

              {/* Authorized Shares */}
              <div className="space-y-2">
                <Label htmlFor="sc-authorized">Authorized Shares *</Label>
                <Input
                  id="sc-authorized"
                  type="number"
                  min="1"
                  value={formData.authorized_shares}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      authorized_shares: e.target.value,
                    }))
                  }
                  placeholder="10000000"
                  required
                />
              </div>

              {/* Reserved Shares */}
              <div className="space-y-2">
                <Label htmlFor="sc-reserved">Reserved Shares</Label>
                <Input
                  id="sc-reserved"
                  type="number"
                  min="0"
                  value={formData.reserved_shares}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reserved_shares: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>

              {/* Price Per Share */}
              <div className="space-y-2">
                <Label htmlFor="sc-price">
                  Price Per Share
                  <span className="text-xs text-muted-foreground ml-2">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="sc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_share}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      price_per_share: e.target.value,
                    }))
                  }
                  placeholder="1.00"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEdit
                    ? 'Updating...'
                    : 'Creating...'
                  : isEdit
                    ? 'Update Share Class'
                    : 'Create Share Class'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
