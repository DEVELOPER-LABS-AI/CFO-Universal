'use server';

import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/email/resend-client';
import { logEmailSend } from '@/lib/email/logger';

// ============================================================================
// TYPES
// ============================================================================

interface InvoiceStatusNotificationParams {
  contractorEmail: string;
  contractorName: string;
  invoiceMonth: string;
  invoiceAmount: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  rejectionReason?: string;
  portalUrl?: string;
}

interface ContractorReminderEmailParams {
  email: string;
  name: string;
  month: string;
  year: number;
  portalUrl: string;
}

interface EmailResult {
  success: boolean;
  error?: string;
}

interface MonthlyReminderResult {
  success: boolean;
  remindersSent: number;
  errors: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'DevLabs CFO <notifications@devlabscfo.com>';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Map invoice status to a human-readable subject line fragment.
 */
const STATUS_SUBJECT_MAP: Record<InvoiceStatusNotificationParams['status'], string> = {
  SUBMITTED: 'Invoice Submitted',
  APPROVED: 'Invoice Approved',
  REJECTED: 'Invoice Requires Changes',
  PAID: 'Invoice Payment Processed',
};

/**
 * Map invoice status to a human-readable description for the email body.
 */
const STATUS_BODY_MAP: Record<InvoiceStatusNotificationParams['status'], string> = {
  SUBMITTED: 'Your invoice has been submitted and is pending review.',
  APPROVED: 'Your invoice has been approved and is queued for payment.',
  REJECTED: 'Your invoice requires changes before it can be approved.',
  PAID: 'Your invoice has been paid. Please allow 1-3 business days for the funds to appear in your account.',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check whether the Resend API key is configured.
 * Returns true if email sending is available, false otherwise.
 * Logs a warning when the key is missing.
 *
 * @returns Whether email sending is available
 */
function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_your_resend_api_key_here') {
    console.warn('[contractor-email] RESEND_API_KEY is not configured. Skipping email send.');
    return false;
  }
  return true;
}

/**
 * Build the invoice status notification HTML email body.
 * Uses plain HTML instead of React Email to avoid a hard dependency
 * on the InvoiceStatusEmail component (which may not exist yet).
 *
 * @param params - The notification parameters
 * @returns HTML string for the email body
 */
function buildInvoiceStatusHtml(params: InvoiceStatusNotificationParams): string {
  const { contractorName, invoiceMonth, invoiceAmount, status, rejectionReason, portalUrl } = params;
  const portalLink = portalUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.devlabscfo.com'}/contractor-portal`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${STATUS_SUBJECT_MAP[status]}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background-color: #18181b; padding: 24px 32px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">DevLabs CFO</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 16px; color: #18181b; margin: 0 0 16px;">Hi ${contractorName},</p>
        <p style="font-size: 16px; color: #3f3f46; margin: 0 0 24px;">${STATUS_BODY_MAP[status]}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px 16px;">
              <p style="font-size: 14px; color: #71717a; margin: 0 0 4px;">Invoice Period</p>
              <p style="font-size: 16px; color: #18181b; font-weight: 600; margin: 0;">${invoiceMonth}</p>
            </td>
            <td style="padding: 12px 16px; text-align: right;">
              <p style="font-size: 14px; color: #71717a; margin: 0 0 4px;">Amount</p>
              <p style="font-size: 16px; color: #18181b; font-weight: 600; margin: 0;">$${invoiceAmount}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 12px 16px;">
              <p style="font-size: 14px; color: #71717a; margin: 0 0 4px;">Status</p>
              <p style="font-size: 16px; color: #18181b; font-weight: 600; margin: 0;">${status}</p>
            </td>
          </tr>
        </table>
        ${
          status === 'REJECTED' && rejectionReason
            ? `
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 0 0 24px;">
          <p style="font-size: 14px; color: #991b1b; font-weight: 600; margin: 0 0 8px;">Reason for rejection:</p>
          <p style="font-size: 14px; color: #991b1b; margin: 0;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <a href="${portalLink}" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View in Contractor Portal</a>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 32px; background-color: #f4f4f5; text-align: center;">
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">This is an automated notification from DevLabs CFO. Please do not reply to this email.</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Build the monthly reminder HTML email body.
 *
 * @param params - The reminder parameters
 * @returns HTML string for the email body
 */
function buildReminderHtml(params: ContractorReminderEmailParams): string {
  const { name, month, year, portalUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice Reminder - ${month} ${year}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background-color: #18181b; padding: 24px 32px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">DevLabs CFO</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="font-size: 16px; color: #18181b; margin: 0 0 16px;">Hi ${name},</p>
        <p style="font-size: 16px; color: #3f3f46; margin: 0 0 24px;">This is a reminder to submit your invoice for <strong>${month} ${year}</strong>. Please log in to your contractor portal to submit your invoice.</p>
        <a href="${portalUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">Submit Invoice</a>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 32px; background-color: #f4f4f5; text-align: center;">
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">This is an automated reminder from DevLabs CFO. Please do not reply to this email.</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Send an email notification when a contractor invoice status changes.
 *
 * Renders an HTML email with invoice details (period, amount, status)
 * and sends it via Resend. Includes rejection reason when applicable.
 *
 * @param params - The notification parameters
 * @param params.contractorEmail - Recipient email address
 * @param params.contractorName - Contractor display name for greeting
 * @param params.invoiceMonth - Human-readable invoice period (e.g. "January 2026")
 * @param params.invoiceAmount - Formatted invoice amount (e.g. "5,000.00")
 * @param params.status - New invoice status (SUBMITTED | APPROVED | REJECTED | PAID)
 * @param params.rejectionReason - Reason for rejection (only for REJECTED status)
 * @param params.portalUrl - Optional custom portal URL override
 * @returns Object with success boolean and optional error message
 *
 * @example
 * const result = await sendInvoiceStatusNotification({
 *   contractorEmail: 'contractor@example.com',
 *   contractorName: 'Jane Doe',
 *   invoiceMonth: 'January 2026',
 *   invoiceAmount: '5,000.00',
 *   status: 'APPROVED',
 * });
 */
export async function sendInvoiceStatusNotification(
  params: InvoiceStatusNotificationParams,
): Promise<EmailResult> {
  try {
    if (!isEmailConfigured()) {
      return { success: false, error: 'Email service not configured (RESEND_API_KEY missing)' };
    }

    const resend = getResendClient();
    const subject = `${STATUS_SUBJECT_MAP[params.status]} - ${params.invoiceMonth}`;
    const html = buildInvoiceStatusHtml(params);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.contractorEmail,
      subject,
      html,
    });

    if (error) {
      console.error('[contractor-email] Failed to send invoice status notification:', error);
      await logEmailSend({
        to: params.contractorEmail,
        from: FROM_EMAIL,
        subject,
        emailType: 'invoice_status',
        status: 'failed',
        errorMessage: error.message,
        metadata: { contractorName: params.contractorName, invoiceMonth: params.invoiceMonth, invoiceStatus: params.status },
      });
      return { success: false, error: error.message };
    }

    await logEmailSend({
      to: params.contractorEmail,
      from: FROM_EMAIL,
      subject,
      emailType: 'invoice_status',
      status: 'sent',
      resendId: data?.id,
      metadata: { contractorName: params.contractorName, invoiceMonth: params.invoiceMonth, invoiceStatus: params.status },
    });

    return { success: true };
  } catch (error) {
    console.error('[contractor-email] Unexpected error sending invoice status notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invoice status notification',
    };
  }
}

/**
 * Send monthly invoice reminders to all eligible contractors across all organizations.
 *
 * This function is designed to be called by a cron job. For each organization:
 * 1. Determines the reminder day (org-level `contractor_reminder_day`, default 24)
 * 2. Checks if today's day-of-month matches the reminder day
 * 3. For each contractor with `reminder_enabled` (default true) and a non-null email:
 *    - Skips if a reminder was already sent for the current month/year
 *    - Respects per-contractor `reminder_day_override` if set
 *    - Sends a reminder email
 *    - Updates `last_reminder_sent_at`, `last_reminder_month`, `last_reminder_year`
 *
 * @returns Object with success boolean, count of reminders sent, and any errors
 *
 * @example
 * // Called from a Vercel Cron route handler
 * const result = await sendMonthlyReminders();
 * console.log(`Sent ${result.remindersSent} reminders`);
 */
export async function sendMonthlyReminders(): Promise<MonthlyReminderResult> {
  const errors: string[] = [];
  let remindersSent = 0;

  try {
    if (!isEmailConfigured()) {
      return {
        success: false,
        remindersSent: 0,
        errors: ['Email service not configured (RESEND_API_KEY missing)'],
      };
    }

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const currentYear = today.getFullYear();
    const currentMonthName = MONTH_NAMES[currentMonth - 1];
    const portalBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.devlabscfo.com';

    // Fetch all organizations that have contractors, including their contractors
    const organizations = await prisma.organization.findMany({
      where: {
        contractors: {
          some: {
            deleted_at: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        contractor_reminder_day: true,
        contractors: {
          where: {
            deleted_at: null,
            email: { not: null },
          },
          select: {
            id: true,
            name: true,
            email: true,
            reminder_enabled: true,
            reminder_day_override: true,
            last_reminder_month: true,
            last_reminder_year: true,
          },
        },
      },
    });

    for (const org of organizations) {
      const orgReminderDay = org.contractor_reminder_day ?? 24;

      for (const contractor of org.contractors) {
        // Determine effective reminder day: per-contractor override or org default
        const effectiveReminderDay = contractor.reminder_day_override ?? orgReminderDay;

        // Skip if today is not the reminder day for this contractor
        if (currentDay !== effectiveReminderDay) {
          continue;
        }

        // Skip if reminder is explicitly disabled
        if (contractor.reminder_enabled === false) {
          continue;
        }

        // Skip if already sent a reminder for this month/year
        if (
          contractor.last_reminder_month === currentMonth &&
          contractor.last_reminder_year === currentYear
        ) {
          continue;
        }

        // Send the reminder
        const portalUrl = `${portalBaseUrl}/contractor-portal`;
        const result = await sendContractorReminderEmail({
          email: contractor.email!,
          name: contractor.name,
          month: currentMonthName,
          year: currentYear,
          portalUrl,
        });

        if (result.success) {
          // Update contractor tracking fields
          await prisma.contractor.update({
            where: { id: contractor.id },
            data: {
              last_reminder_sent_at: new Date(),
              last_reminder_month: currentMonth,
              last_reminder_year: currentYear,
            },
          });
          remindersSent++;
        } else {
          const errorMsg = `Failed to send reminder to ${contractor.name} (${contractor.email}): ${result.error}`;
          console.error(`[contractor-email] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    return {
      success: true,
      remindersSent,
      errors,
    };
  } catch (error) {
    console.error('[contractor-email] Unexpected error in sendMonthlyReminders:', error);
    return {
      success: false,
      remindersSent,
      errors: [
        ...errors,
        error instanceof Error ? error.message : 'Unexpected error in sendMonthlyReminders',
      ],
    };
  }
}

/**
 * Send a single invoice submission reminder email to a contractor.
 *
 * Builds a simple HTML email reminding the contractor to submit
 * their invoice for the given month/year, and sends it via Resend.
 *
 * @param params - The reminder parameters
 * @param params.email - Contractor email address
 * @param params.name - Contractor display name for greeting
 * @param params.month - Human-readable month name (e.g. "January")
 * @param params.year - The year (e.g. 2026)
 * @param params.portalUrl - Full URL to the contractor portal
 * @returns Object with success boolean and optional error message
 *
 * @example
 * const result = await sendContractorReminderEmail({
 *   email: 'contractor@example.com',
 *   name: 'Jane Doe',
 *   month: 'February',
 *   year: 2026,
 *   portalUrl: 'https://app.devlabscfo.com/contractor-portal',
 * });
 */
export async function sendContractorReminderEmail(
  params: ContractorReminderEmailParams,
): Promise<EmailResult> {
  try {
    if (!isEmailConfigured()) {
      return { success: false, error: 'Email service not configured (RESEND_API_KEY missing)' };
    }

    const resend = getResendClient();
    const subject = `Reminder: Submit your invoice for ${params.month} ${params.year}`;
    const html = buildReminderHtml(params);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html,
    });

    if (error) {
      console.error('[contractor-email] Failed to send reminder email:', error);
      await logEmailSend({
        to: params.email,
        from: FROM_EMAIL,
        subject,
        emailType: 'contractor_reminder',
        status: 'failed',
        errorMessage: error.message,
        metadata: { contractorName: params.name, month: params.month, year: params.year },
      });
      return { success: false, error: error.message };
    }

    await logEmailSend({
      to: params.email,
      from: FROM_EMAIL,
      subject,
      emailType: 'contractor_reminder',
      status: 'sent',
      resendId: data?.id,
      metadata: { contractorName: params.name, month: params.month, year: params.year },
    });

    return { success: true };
  } catch (error) {
    console.error('[contractor-email] Unexpected error sending reminder email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder email',
    };
  }
}
