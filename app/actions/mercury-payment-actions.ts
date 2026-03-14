'use server';

import { requireAdmin } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { getMercuryClient } from '@/lib/mercury/client-factory';
import { revalidatePath } from 'next/cache';
import { initiatePaymentSchema } from '@/lib/validations/contractor-invoice';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Month names used to build human-readable payment memos.
 */
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Map our Prisma PaymentMethod enum values to Mercury API payment method strings.
 *
 * @param method - Prisma PaymentMethod enum value (ACH, DOMESTIC_WIRE, INTERNATIONAL_WIRE)
 * @returns Mercury API payment method identifier
 */
function toMercuryPaymentMethod(
  method: 'ACH' | 'DOMESTIC_WIRE' | 'INTERNATIONAL_WIRE'
): 'ach' | 'domesticWire' | 'check' {
  const mapping: Record<string, 'ach' | 'domesticWire' | 'check'> = {
    ACH: 'ach',
    DOMESTIC_WIRE: 'domesticWire',
    // Mercury API does not expose internationalWire via request-send-money;
    // fall back to domesticWire. Adjust if Mercury adds support.
    INTERNATIONAL_WIRE: 'domesticWire',
  };
  return mapping[method] ?? 'ach';
}

/**
 * Get the organization ID for a given user by looking up UserOrganization.
 *
 * @param userId - The Supabase auth user ID
 * @returns The organization ID
 * @throws {Error} If no organization is found for the user
 */
async function getOrganizationId(userId: string): Promise<string> {
  const userOrg = await prisma.userOrganization.findFirst({
    where: { user_id: userId },
    select: { organization_id: true },
  });
  if (!userOrg) throw new Error('No organization found');
  return userOrg.organization_id;
}

// ============================================================================
// INITIATE CONTRACTOR PAYMENT
// ============================================================================

/**
 * Initiate a contractor payment via Mercury's request-send-money API.
 *
 * Validates the incoming data against `initiatePaymentSchema`, verifies the
 * invoice is in APPROVED status, ensures the contractor has a linked Mercury
 * recipient, selects the first active checking account, and submits a payment
 * request through the Lambda-proxied Mercury client.
 *
 * On success a `ContractorPayment` record is created with PENDING status and
 * the invoice status is updated to PAID.
 *
 * @param data - Unknown input validated against initiatePaymentSchema
 *               (fields: invoice_id, payment_method)
 * @returns Object with `success: true` and `data` containing the payment record,
 *          or `success: false` with an `error` message
 */
export async function initiateContractorPayment(data: unknown) {
  try {
    // 1. Auth & validation
    const admin = await requireAdmin();
    const validated = initiatePaymentSchema.parse(data);

    // 2. Resolve org
    const organizationId = await getOrganizationId(admin.userId);

    // 3. Fetch admin UserProfile (for initiated_by FK)
    const adminProfile = await prisma.userProfile.findUnique({
      where: { user_id: admin.userId },
      select: { id: true },
    });

    if (!adminProfile) {
      return { success: false, error: 'Admin profile not found' };
    }

    // 4. Load invoice and verify ownership + status
    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: validated.invoice_id,
        organization_id: organizationId,
      },
      include: {
        contractor: {
          select: {
            id: true,
            name: true,
            mercury_recipient_id: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'APPROVED') {
      return { success: false, error: 'Invoice must be in APPROVED status to initiate payment' };
    }

    // 5. Verify contractor has a linked Mercury recipient
    const { contractor } = invoice;

    if (!contractor.mercury_recipient_id) {
      return {
        success: false,
        error: 'Contractor does not have a linked Mercury recipient. Please link a recipient first.',
      };
    }

    // 6. Get Mercury client and find the first active checking account
    const mercuryClient = await getMercuryClient(organizationId);
    const { accounts } = await mercuryClient.getAccounts();

    const checkingAccount = accounts.find(
      (a) => a.type === 'checking' && a.status === 'active'
    );

    if (!checkingAccount) {
      return { success: false, error: 'No active Mercury checking account found' };
    }

    // 7. Build the payment memo
    const memo = `Contractor payment: ${contractor.name} - ${monthNames[invoice.month - 1]} ${invoice.year}`;

    // 8. Request send money via Mercury
    const response = await mercuryClient.requestSendMoney(checkingAccount.id, {
      recipientId: contractor.mercury_recipient_id,
      amount: Number(invoice.total_amount),
      paymentMethod: toMercuryPaymentMethod(validated.payment_method),
      memo,
      idempotencyKey: `contractor-payment-${invoice.id}`,
    });

    // 9. Create ContractorPayment record
    const payment = await prisma.contractorPayment.create({
      data: {
        invoice_id: invoice.id,
        contractor_id: contractor.id,
        organization_id: organizationId,
        amount: invoice.total_amount,
        payment_method: validated.payment_method,
        status: 'PENDING',
        mercury_request_id: response.id,
        initiated_by: adminProfile.id,
      },
    });

    // 10. Update invoice status to PAID
    await prisma.contractorInvoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID' },
    });

    console.log(`[audit] Payment INITIATED: payment=${payment.id}, invoice=${invoice.id}, contractor=${contractor.id}, amount=${Number(invoice.total_amount)}, method=${validated.payment_method}, mercury_request=${response.id}, admin=${admin.userId}`);

    // 11. Revalidate admin and contractor portal paths
    revalidatePath('/dashboard/admin/contractor-invoices');
    revalidatePath('/dashboard/contractors');
    revalidatePath('/contractor-portal');
    revalidatePath('/contractor-portal/invoices');

    return { success: true, data: payment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate contractor payment',
    };
  }
}

// ============================================================================
// RETRY FAILED PAYMENT
// ============================================================================

/**
 * Retry a previously failed contractor payment via Mercury.
 *
 * Looks up the existing `ContractorPayment` record, verifies it belongs to the
 * admin's organization, confirms the payment is in FAILED status, and resubmits
 * the request through Mercury's request-send-money API with a new idempotency key.
 *
 * @param paymentId - UUID of the ContractorPayment to retry
 * @returns Object with `success: true` and updated payment data, or `success: false` with error
 */
export async function retryPayment(paymentId: string) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    // Load existing payment with invoice and contractor details
    const payment = await prisma.contractorPayment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            organization_id: true,
            month: true,
            year: true,
            total_amount: true,
            status: true,
            contractor: {
              select: {
                id: true,
                name: true,
                mercury_recipient_id: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.invoice.organization_id !== organizationId) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.status !== 'FAILED') {
      return { success: false, error: 'Only FAILED payments can be retried' };
    }

    const { contractor } = payment.invoice;

    if (!contractor.mercury_recipient_id) {
      return { success: false, error: 'Contractor does not have a linked Mercury recipient' };
    }

    // Get Mercury client and find active checking account
    const mercuryClient = await getMercuryClient(organizationId);
    const { accounts } = await mercuryClient.getAccounts();
    const checkingAccount = accounts.find(
      (a) => a.type === 'checking' && a.status === 'active'
    );

    if (!checkingAccount) {
      return { success: false, error: 'No active Mercury checking account found' };
    }

    const memo = `Contractor payment (retry): ${contractor.name} - ${monthNames[payment.invoice.month - 1]} ${payment.invoice.year}`;

    // Resubmit with a new idempotency key for the retry
    const response = await mercuryClient.requestSendMoney(checkingAccount.id, {
      recipientId: contractor.mercury_recipient_id,
      amount: Number(payment.amount),
      paymentMethod: toMercuryPaymentMethod(payment.payment_method as 'ACH' | 'DOMESTIC_WIRE' | 'INTERNATIONAL_WIRE'),
      memo,
      idempotencyKey: `contractor-payment-retry-${payment.id}-${Date.now()}`,
    });

    // Update payment record
    const updatedPayment = await prisma.contractorPayment.update({
      where: { id: paymentId },
      data: {
        status: 'PENDING',
        mercury_request_id: response.id,
        failure_reason: null,
      },
    });

    console.log(`[audit] Payment retried: payment=${paymentId}, invoice=${payment.invoice.id}, admin=${admin.userId}`);

    revalidatePath('/dashboard/admin/contractor-invoices');
    revalidatePath('/contractor-portal/payments');

    return { success: true, data: updatedPayment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry payment',
    };
  }
}

// ============================================================================
// GET PAYMENT STATUS
// ============================================================================

/**
 * Retrieve the current status of a contractor payment.
 *
 * Looks up the `ContractorPayment` by ID, verifies it belongs to the
 * admin's organization (via the related invoice), and returns the payment
 * record.
 *
 * @param paymentId - UUID of the ContractorPayment to retrieve
 * @returns Object with `success: true` and `data` containing the payment record,
 *          or `success: false` with an `error` message
 */
export async function getPaymentStatus(paymentId: string) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    const payment = await prisma.contractorPayment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            organization_id: true,
            month: true,
            year: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    // Verify payment belongs to admin's organization
    if (payment.invoice.organization_id !== organizationId) {
      return { success: false, error: 'Payment not found' };
    }

    return { success: true, data: payment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payment status',
    };
  }
}
