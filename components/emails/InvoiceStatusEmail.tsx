import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

interface InvoiceStatusEmailProps {
  contractorName: string
  invoiceMonth: string
  invoiceAmount: string
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'
  rejectionReason?: string
  portalUrl?: string
}

const statusConfig: Record<string, { subject: string; color: string; message: (month: string, amount?: string) => string }> = {
  SUBMITTED: {
    subject: 'Invoice Submitted for Review',
    color: '#2563eb',
    message: (month) => `Your invoice for ${month} has been submitted for review.`,
  },
  APPROVED: {
    subject: 'Invoice Approved',
    color: '#16a34a',
    message: (month) => `Your invoice for ${month} has been approved and is pending payment.`,
  },
  REJECTED: {
    subject: 'Invoice Requires Revisions',
    color: '#dc2626',
    message: (month) => `Your invoice for ${month} requires revisions.`,
  },
  PAID: {
    subject: 'Payment Completed',
    color: '#16a34a',
    message: (month, amount) => `Payment of ${amount} for ${month} has been completed.`,
  },
}

/**
 * React Email template for contractor invoice status notifications.
 * Used by sendInvoiceStatusNotification in contractor-email-actions.ts.
 */
export function InvoiceStatusEmail({
  contractorName,
  invoiceMonth,
  invoiceAmount,
  status,
  rejectionReason,
  portalUrl,
}: InvoiceStatusEmailProps) {
  const config = statusConfig[status]

  return (
    <Html>
      <Head />
      <Preview>{config.subject} - DevLabs CFO</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>DevLabs CFO</Heading>
          </Section>

          <Section style={contentSection}>
            <div style={{ ...statusBar, backgroundColor: config.color }} />
            <Heading style={heading}>{config.subject}</Heading>

            <Text style={greeting}>Hi {contractorName},</Text>

            <Text style={messageText}>
              {status === 'PAID'
                ? config.message(invoiceMonth, invoiceAmount)
                : config.message(invoiceMonth)}
            </Text>

            {status !== 'PAID' && (
              <Text style={amountText}>
                Invoice Amount: <strong>{invoiceAmount}</strong>
              </Text>
            )}

            {status === 'REJECTED' && rejectionReason && (
              <Section style={rejectionBox}>
                <Text style={rejectionLabel}>Reason for revision:</Text>
                <Text style={rejectionText}>{rejectionReason}</Text>
              </Section>
            )}

            {portalUrl && (
              <Text style={messageText}>
                <a href={portalUrl} style={linkStyle}>View in Contractor Portal</a>
              </Text>
            )}
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerText}>
              This is an automated notification from DevLabs CFO.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default InvoiceStatusEmail

// Inline styles for React Email
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden' as const,
}

const headerSection = {
  backgroundColor: '#1e293b',
  padding: '24px 32px',
}

const logo = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0',
}

const contentSection = {
  padding: '32px',
}

const statusBar = {
  height: '4px',
  borderRadius: '2px',
  marginBottom: '24px',
}

const heading = {
  fontSize: '22px',
  fontWeight: '600' as const,
  color: '#1e293b',
  margin: '0 0 16px',
}

const greeting = {
  fontSize: '16px',
  color: '#334155',
  margin: '0 0 12px',
}

const messageText = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const amountText = {
  fontSize: '15px',
  color: '#334155',
  margin: '0 0 16px',
}

const rejectionBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  padding: '16px',
  margin: '16px 0',
}

const rejectionLabel = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#991b1b',
  margin: '0 0 4px',
}

const rejectionText = {
  fontSize: '14px',
  color: '#b91c1c',
  margin: '0',
}

const linkStyle = {
  color: '#2563eb',
  textDecoration: 'underline',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '0',
}

const footerSection = {
  padding: '16px 32px',
}

const footerText = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '0',
}
