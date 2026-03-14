'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, XCircle } from 'lucide-react';
import { updateEmailSettings, sendTestEmail } from '@/app/actions/email-settings';
import { toast } from 'sonner';

interface EmailSettingsProps {
  emailEnabled: boolean;
  emailFromName: string;
  emailFromAddress: string | null;
  emailReplyTo: string | null;
  apiKeyConfigured: boolean;
  envFromEmail: string | null;
}

/**
 * Admin settings component for configuring Resend email integration.
 * Allows setting sender name, from address, reply-to, and sending test emails.
 */
export function EmailSettings({
  emailEnabled: initialEnabled,
  emailFromName: initialFromName,
  emailFromAddress: initialFromAddress,
  emailReplyTo: initialReplyTo,
  apiKeyConfigured,
  envFromEmail,
}: EmailSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [fromName, setFromName] = useState(initialFromName);
  const [fromAddress, setFromAddress] = useState(initialFromAddress || '');
  const [replyTo, setReplyTo] = useState(initialReplyTo || '');
  const [testEmail, setTestEmail] = useState('');

  /**
   * Save email settings to the database.
   */
  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateEmailSettings({
          emailEnabled: enabled,
          emailFromName: fromName,
          emailFromAddress: fromAddress || null,
          emailReplyTo: replyTo || null,
        });
        toast.success('Email settings updated');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update email settings';
        toast.error(message);
      }
    });
  };

  /**
   * Send a test email to verify the configuration.
   */
  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Enter a recipient email address');
      return;
    }
    setIsSendingTest(true);
    try {
      const result = await sendTestEmail(testEmail);
      if (result.success) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.error(result.error || 'Failed to send test email');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send test email';
      toast.error(message);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Status */}
      <div className="flex items-center gap-3 p-4 border rounded-lg">
        {apiKeyConfigured ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Resend API Key</span>
            <Badge variant={apiKeyConfigured ? 'default' : 'destructive'}>
              {apiKeyConfigured ? 'Connected' : 'Not Configured'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {apiKeyConfigured
              ? 'API key is set via RESEND_API_KEY environment variable.'
              : 'Set RESEND_API_KEY in your environment variables to enable email sending.'}
          </p>
        </div>
      </div>

      {/* Email Enabled Toggle */}
      <div className="flex items-start space-x-3 p-4 border rounded-lg">
        <Checkbox
          id="email-enabled"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="email-enabled" className="font-medium cursor-pointer">
            Enable Email Notifications
          </Label>
          <p className="text-sm text-muted-foreground">
            When disabled, all outbound emails (reminders, status notifications) are suppressed.
          </p>
        </div>
      </div>

      {/* Sender Configuration */}
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email-from-name">From Name</Label>
          <Input
            id="email-from-name"
            placeholder="DevLabs CFO"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Display name shown in the &quot;From&quot; field of outbound emails.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email-from-address">From Email Address</Label>
          <Input
            id="email-from-address"
            type="email"
            placeholder={envFromEmail || 'notifications@yourdomain.com'}
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Must be a verified sender in Resend.
            {envFromEmail && !fromAddress
              ? ` Currently using env default: ${envFromEmail}`
              : ' Leave blank to use the RESEND_FROM_EMAIL environment variable.'}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email-reply-to">Reply-To Address (optional)</Label>
          <Input
            id="email-reply-to"
            type="email"
            placeholder="support@yourdomain.com"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Replies to outbound emails will go to this address. Leave blank to omit.
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isPending} size="sm">
        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Email Settings
      </Button>

      {/* Test Email */}
      {apiKeyConfigured && (
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium mb-2">Send Test Email</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Verify your configuration by sending a test email. Save settings first to use updated values.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-sm"
            />
            <Button
              onClick={handleSendTest}
              disabled={isSendingTest || !enabled}
              variant="outline"
              size="sm"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
