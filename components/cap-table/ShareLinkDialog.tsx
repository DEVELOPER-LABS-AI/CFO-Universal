'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { Copy, Link2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateShareLink } from '@/app/actions/cap-table';

interface ShareLinkDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback fired when the open state changes. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for generating and sharing a time-limited cap table link.
 * Allows configuring expiration days, generates the URL via a server action,
 * and provides a copy-to-clipboard button.
 */
export function ShareLinkDialog({ open, onOpenChange }: ShareLinkDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [expirationDays, setExpirationDays] = useState(30);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** Reset all local state when the dialog closes. */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setGeneratedUrl(null);
      setExpiresAt(null);
      setExpirationDays(30);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  /** Call the server action to generate a share link. */
  function handleGenerate() {
    startTransition(async () => {
      try {
        const result = await generateShareLink({ expires_in_days: expirationDays });
        setGeneratedUrl(result.url);
        setExpiresAt(result.expires_at);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || 'Failed to generate share link');
      }
    });
  }

  /** Copy the generated URL to the clipboard. */
  async function handleCopy() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }

  /** Format the expiration date for display. */
  function formatExpiration(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share Cap Table
          </DialogTitle>
          <DialogDescription>
            Generate a read-only link to share your cap table externally.
          </DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expiration-days">Link expires after (days)</Label>
              <Input
                id="expiration-days"
                type="number"
                min={1}
                max={365}
                value={expirationDays}
                onChange={(e) =>
                  setExpirationDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))
                }
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Choose between 1 and 365 days.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isPending}>
                {isPending ? 'Generating...' : 'Generate Link'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-url">Share URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="share-url"
                  readOnly
                  value={generatedUrl}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {expiresAt && (
              <p className="text-sm text-muted-foreground">
                Expires on{' '}
                <span className="font-medium text-foreground">
                  {formatExpiration(expiresAt)}
                </span>
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
