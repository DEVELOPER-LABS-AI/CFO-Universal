import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Email types tracked by the logging system.
 */
export type EmailType = 'invoice_status' | 'contractor_reminder' | 'test_email'

/**
 * Input for creating an email log entry.
 */
export interface EmailLogInput {
  to: string
  from: string
  subject: string
  emailType: EmailType
  status: 'sent' | 'failed'
  resendId?: string | null
  errorMessage?: string | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Log an outbound email send attempt.
 *
 * Fire-and-forget: errors are caught and logged to console
 * so logging failures never break email delivery.
 *
 * @param input - Email log details
 */
export async function logEmailSend(input: EmailLogInput): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to_address: input.to,
        from_address: input.from,
        subject: input.subject,
        email_type: input.emailType,
        status: input.status,
        resend_id: input.resendId ?? null,
        error_message: input.errorMessage ?? null,
        metadata: input.metadata ?? undefined,
      },
    })
  } catch (error) {
    console.error('[email-logger] Failed to write email log:', error)
  }
}
