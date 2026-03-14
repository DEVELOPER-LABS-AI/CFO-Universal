'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  createStakeholder,
  updateStakeholder,
} from '@/app/actions/cap-table';

/** Shape of a stakeholder passed for edit mode. */
interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
}

interface AddStakeholderModalProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Callback to toggle dialog visibility. */
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog operates in edit mode with pre-filled fields. */
  stakeholder?: Stakeholder;
}

/** Default form state for the stakeholder dialog. */
interface StakeholderFormData {
  name: string;
  email: string;
  role_title: string;
}

const EMPTY_FORM: StakeholderFormData = {
  name: '',
  email: '',
  role_title: '',
};

/**
 * T022: AddStakeholderModal component.
 *
 * A controlled Dialog for creating or editing a cap table stakeholder.
 * In edit mode (when the `stakeholder` prop is provided), the form is
 * pre-filled and submission calls `updateStakeholder`. Otherwise it
 * calls `createStakeholder`. Toast feedback is shown on success or error.
 */
export function AddStakeholderModal({
  open,
  onOpenChange,
  stakeholder,
}: AddStakeholderModalProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<StakeholderFormData>(EMPTY_FORM);

  const isEdit = !!stakeholder;

  /**
   * Sync form data when the stakeholder prop changes or the dialog opens.
   * Resets to empty when closing or when no stakeholder is provided.
   */
  useEffect(() => {
    if (open && stakeholder) {
      setFormData({
        name: stakeholder.name,
        email: stakeholder.email ?? '',
        role_title: stakeholder.role_title ?? '',
      });
    } else if (!open) {
      setFormData(EMPTY_FORM);
    }
  }, [open, stakeholder]);

  /**
   * Handles dialog open/close state changes.
   * Resets the form when the dialog is closed.
   */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFormData(EMPTY_FORM);
    }
    onOpenChange(nextOpen);
  }

  /**
   * Submits the form, calling the appropriate server action (create or update)
   * inside a transition for non-blocking UI updates.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...(stakeholder ? { id: stakeholder.id } : {}),
      name: formData.name.trim(),
      email: formData.email.trim() || undefined,
      role_title: formData.role_title.trim() || undefined,
    };

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateStakeholder(payload);
          toast.success(`${payload.name} updated successfully`);
        } else {
          await createStakeholder(payload);
          toast.success(`${payload.name} added successfully`);
        }
        onOpenChange(false);
        setFormData(EMPTY_FORM);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'An unexpected error occurred';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Edit Stakeholder' : 'Add Stakeholder'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Update details for ${stakeholder?.name}.`
                : 'Add a new stakeholder to your cap table.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="sh-name">Name *</Label>
              <Input
                id="sh-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Jane Smith"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="sh-email">
                Email
                <span className="text-xs text-muted-foreground ml-2">
                  (optional)
                </span>
              </Label>
              <Input
                id="sh-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="jane@example.com"
              />
            </div>

            {/* Role / Title */}
            <div className="space-y-2">
              <Label htmlFor="sh-role">
                Role / Title
                <span className="text-xs text-muted-foreground ml-2">
                  (optional)
                </span>
              </Label>
              <Input
                id="sh-role"
                value={formData.role_title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role_title: e.target.value,
                  }))
                }
                placeholder="Co-Founder, Advisor, Investor..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? 'Updating...'
                  : 'Adding...'
                : isEdit
                  ? 'Update Stakeholder'
                  : 'Add Stakeholder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
