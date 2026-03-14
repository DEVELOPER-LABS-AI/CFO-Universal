'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { requireAuth } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logEmailSend } from '@/lib/email/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const emailSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailFromName: z.string().min(1, 'From name is required').max(100),
  emailFromAddress: z.string().email('Invalid email address').nullable(),
  emailReplyTo: z.string().email('Invalid reply-to address').nullable(),
});

type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;

// ============================================================================
// GET EMAIL SETTINGS
// ============================================================================

/**
 * Get email settings for the current organization.
 * Admin-only: returns Resend configuration state and org-level email settings.
 */
export async function getEmailSettings() {
  const organizationId = await getOrganizationId();

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      email_enabled: true,
      email_from_name: true,
      email_from_address: true,
      email_reply_to: true,
    },
  });

  const apiKeyConfigured = !!process.env.RESEND_API_KEY &&
    process.env.RESEND_API_KEY !== 're_your_resend_api_key_here';

  return {
    emailEnabled: org.email_enabled,
    emailFromName: org.email_from_name,
    emailFromAddress: org.email_from_address,
    emailReplyTo: org.email_reply_to,
    apiKeyConfigured,
    envFromEmail: process.env.RESEND_FROM_EMAIL || null,
  };
}

// ============================================================================
// UPDATE EMAIL SETTINGS
// ============================================================================

/**
 * Update email settings for the current organization.
 * Validates input and persists to the Organization record.
 */
export async function updateEmailSettings(data: EmailSettingsInput) {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can update email settings');
  }

  const parsed = emailSettingsSchema.parse(data);
  const organizationId = await getOrganizationId();

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      email_enabled: parsed.emailEnabled,
      email_from_name: parsed.emailFromName,
      email_from_address: parsed.emailFromAddress,
      email_reply_to: parsed.emailReplyTo,
    },
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ============================================================================
// SEND TEST EMAIL
// ============================================================================

/**
 * Send a test email to the current admin user to verify Resend configuration.
 * Uses the organization's email settings for from/reply-to headers.
 */
export async function sendTestEmail(recipientEmail: string) {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Only admins can send test emails');
  }

  const organizationId = await getOrganizationId();

  // Validate recipient
  const emailSchema = z.string().email();
  const parsed = emailSchema.safeParse(recipientEmail);
  if (!parsed.success) {
    return { success: false, error: 'Invalid recipient email address' };
  }

  // Check API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_your_resend_api_key_here') {
    return { success: false, error: 'RESEND_API_KEY is not configured in environment variables' };
  }

  // Fetch org email settings
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      name: true,
      email_enabled: true,
      email_from_name: true,
      email_from_address: true,
      email_reply_to: true,
    },
  });

  if (!org.email_enabled) {
    return { success: false, error: 'Email sending is disabled for this organization' };
  }

  // Build from address
  const fromAddress = org.email_from_address
    || process.env.RESEND_FROM_EMAIL
    || 'notifications@devlabscfo.com';
  const from = `${org.email_from_name} <${fromAddress}>`;

  try {
    const { getResendClient } = await import('@/lib/email/resend-client');
    const resend = getResendClient();

    const testSubject = `Test Email from ${org.email_from_name}`;
    const { data, error } = await resend.emails.send({
      from,
      to: parsed.data,
      ...(org.email_reply_to ? { replyTo: org.email_reply_to } : {}),
      subject: testSubject,
      html: buildTestEmailHtml(org.email_from_name, org.name),
    });

    if (error) {
      console.error('[email-settings] Test email failed:', error);
      await logEmailSend({
        to: parsed.data,
        from,
        subject: testSubject,
        emailType: 'test_email',
        status: 'failed',
        errorMessage: error.message,
        metadata: { orgName: org.name },
      });
      return { success: false, error: error.message };
    }

    await logEmailSend({
      to: parsed.data,
      from,
      subject: testSubject,
      emailType: 'test_email',
      status: 'sent',
      resendId: data?.id,
      metadata: { orgName: org.name },
    });

    return { success: true };
  } catch (err) {
    console.error('[email-settings] Unexpected error sending test email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test email',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build HTML for test email.
 */
function buildTestEmailHtml(fromName: string, orgName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background-color: #18181b; padding: 24px 32px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">${fromName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="font-size: 18px; color: #18181b; margin: 0 0 16px;">Email Configuration Test</h2>
        <p style="font-size: 16px; color: #3f3f46; margin: 0 0 16px;">
          This is a test email from <strong>${orgName}</strong>. If you received this email, your Resend integration is working correctly.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 0 0 16px;">
          <p style="font-size: 14px; color: #166534; font-weight: 600; margin: 0;">Email delivery is working!</p>
        </div>
        <p style="font-size: 14px; color: #71717a; margin: 0;">
          Sent at ${new Date().toISOString()}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 32px; background-color: #f4f4f5; text-align: center;">
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">This is a test email from ${fromName}. No action is required.</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
