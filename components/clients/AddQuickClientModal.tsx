'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createQuickClient } from '@/app/actions/client-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AddQuickClientModalProps {
  trigger: React.ReactNode;
  /** Pre-fill the client name (e.g. from a merchant name). */
  defaultName?: string;
  /** Called after successful creation with the new client's id and name. */
  onCreated?: (client: { id: string; name: string }) => void;
}

/**
 * Lightweight client creation modal for the Vendor Mapping page.
 * Only requires a name — defaults relationship_type to RETAINER.
 */
export function AddQuickClientModal({ trigger, defaultName, onCreated }: AddQuickClientModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(defaultName ?? '');

  useEffect(() => {
    if (defaultName !== undefined) {
      setName(defaultName);
    }
  }, [defaultName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Client name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createQuickClient({ name: name.trim() });
      toast.success(`${created.name} added successfully`);
      setOpen(false);
      setName(defaultName ?? '');
      onCreated?.({ id: created.id, name: created.name });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Quick Add Client</DialogTitle>
            <DialogDescription>
              Create a new client for revenue mapping. You can add full details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name *</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
