'use server';

import { prisma } from '@/lib/prisma';
import { requireContractor } from '@/lib/auth/helpers';
import { revalidatePath } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getOrCreateDraftInvoiceSchema,
  addContractorLineItemSchema,
  updateContractorLineItemSchema,
  submitContractorInvoiceSchema,
} from '@/lib/validations/contractor-invoice';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Recalculate an invoice's total_amount as base_amount + sum of all line items.
 */
async function recalculateInvoiceTotal(invoiceId: string): Promise<void> {
  const invoice = await prisma.contractorInvoice.findUnique({
    where: { id: invoiceId },
    include: { line_items: true },
  });
  if (!invoice) return;

  const lineItemTotal = invoice.line_items.reduce(
    (sum, item) => sum.add(item.amount),
    new Decimal(0)
  );

  await prisma.contractorInvoice.update({
    where: { id: invoiceId },
    data: { total_amount: invoice.base_amount.add(lineItemTotal) },
  });
}

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * Get the contractor dashboard data: profile, current month invoice, and summary stats.
 */
export async function getContractorDashboard() {
  try {
    const user = await requireContractor();

    const contractor = await prisma.contractor.findUnique({
      where: { id: user.contractorId },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    if (!contractor) {
      return { success: false as const, error: 'Contractor profile not found' };
    }

    // Current month invoice
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentInvoice = await prisma.contractorInvoice.findUnique({
      where: {
        contractor_id_month_year: {
          contractor_id: user.contractorId,
          month: currentMonth,
          year: currentYear,
        },
      },
      include: {
        _count: { select: { line_items: true } },
        payment: { select: { status: true, completed_at: true } },
      },
    });

    // Summary stats across all invoices
    const paidInvoices = await prisma.contractorInvoice.aggregate({
      where: { contractor_id: user.contractorId, status: 'PAID' },
      _sum: { total_amount: true },
    });

    const pendingInvoices = await prisma.contractorInvoice.aggregate({
      where: {
        contractor_id: user.contractorId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      _sum: { total_amount: true },
    });

    const invoiceCount = await prisma.contractorInvoice.count({
      where: { contractor_id: user.contractorId },
    });

    const stats = {
      totalPaid: paidInvoices._sum.total_amount ?? new Decimal(0),
      pendingAmount: pendingInvoices._sum.total_amount ?? new Decimal(0),
      invoiceCount,
    };

    return { success: true as const, data: { contractor, currentInvoice, stats } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load dashboard',
    };
  }
}

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

/**
 * Get or create a draft invoice for the given month/year.
 * If the invoice already exists, return it with line_items and documents.
 * If not, create a new DRAFT with base_amount derived from the contractor's rate.
 */
export async function getOrCreateDraftInvoice(month: number, year: number) {
  try {
    const user = await requireContractor();
    const validated = getOrCreateDraftInvoiceSchema.parse({ month, year });

    // Check for existing invoice
    const existing = await prisma.contractorInvoice.findUnique({
      where: {
        contractor_id_month_year: {
          contractor_id: user.contractorId,
          month: validated.month,
          year: validated.year,
        },
      },
      include: { line_items: { orderBy: { sort_order: 'asc' } }, documents: true },
    });

    if (existing) {
      return { success: true as const, data: existing };
    }

    // Fetch contractor to determine rate-based base_amount
    const contractor = await prisma.contractor.findUnique({
      where: { id: user.contractorId },
      select: { rate: true, rate_type: true, organization_id: true },
    });

    if (!contractor) {
      return { success: false as const, error: 'Contractor profile not found' };
    }

    let baseAmount = new Decimal(0);
    if (contractor.rate) {
      switch (contractor.rate_type) {
        case 'MONTHLY':
          baseAmount = contractor.rate;
          break;
        case 'HOURLY':
          baseAmount = contractor.rate.mul(176);
          break;
        case 'DAILY':
          baseAmount = contractor.rate.mul(22);
          break;
        default:
          baseAmount = new Decimal(0);
          break;
      }
    }

    const invoice = await prisma.contractorInvoice.create({
      data: {
        contractor_id: user.contractorId,
        organization_id: contractor.organization_id,
        month: validated.month,
        year: validated.year,
        base_amount: baseAmount,
        total_amount: baseAmount,
        status: 'DRAFT',
      },
      include: { line_items: { orderBy: { sort_order: 'asc' } }, documents: true },
    });

    return { success: true as const, data: invoice };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get or create invoice',
    };
  }
}

// ============================================================================
// LINE ITEM MANAGEMENT
// ============================================================================

/**
 * Add a line item to a draft invoice belonging to this contractor.
 */
export async function addInvoiceLineItem(data: unknown) {
  try {
    const user = await requireContractor();
    const validated = addContractorLineItemSchema.parse(data);

    // Verify invoice belongs to this contractor and is DRAFT
    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: validated.invoice_id,
        contractor_id: user.contractorId,
        status: 'DRAFT',
      },
      include: { line_items: { select: { sort_order: true } } },
    });

    if (!invoice) {
      return { success: false as const, error: 'Invoice not found or is not in DRAFT status' };
    }

    // Determine next sort_order
    const maxSortOrder = invoice.line_items.reduce(
      (max, item) => Math.max(max, item.sort_order),
      -1
    );

    const lineItem = await prisma.contractorInvoiceLineItem.create({
      data: {
        invoice_id: validated.invoice_id,
        type: validated.type,
        description: validated.description,
        amount: validated.amount,
        sort_order: maxSortOrder + 1,
      },
    });

    // Recalculate invoice total
    await recalculateInvoiceTotal(validated.invoice_id);

    revalidatePath(`/contractor-portal/invoices/${validated.invoice_id}`);

    return { success: true as const, data: lineItem };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to add line item',
    };
  }
}

/**
 * Update an existing line item on a draft invoice belonging to this contractor.
 */
export async function updateInvoiceLineItem(lineItemId: string, data: unknown) {
  try {
    const user = await requireContractor();
    const validated = updateContractorLineItemSchema.parse(data);

    // Verify line item's invoice belongs to contractor and is DRAFT
    const lineItem = await prisma.contractorInvoiceLineItem.findUnique({
      where: { id: lineItemId },
      include: { invoice: { select: { contractor_id: true, status: true } } },
    });

    if (!lineItem) {
      return { success: false as const, error: 'Line item not found' };
    }

    if (lineItem.invoice.contractor_id !== user.contractorId) {
      return { success: false as const, error: 'Line item not found' };
    }

    if (lineItem.invoice.status !== 'DRAFT') {
      return { success: false as const, error: 'Cannot modify line items on a non-DRAFT invoice' };
    }

    const updated = await prisma.contractorInvoiceLineItem.update({
      where: { id: lineItemId },
      data: {
        ...(validated.type !== undefined && { type: validated.type }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.amount !== undefined && { amount: validated.amount }),
      },
    });

    // Recalculate invoice total
    await recalculateInvoiceTotal(lineItem.invoice_id);

    revalidatePath(`/contractor-portal/invoices/${lineItem.invoice_id}`);

    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to update line item',
    };
  }
}

/**
 * Remove a line item from a draft invoice belonging to this contractor.
 */
export async function removeInvoiceLineItem(lineItemId: string) {
  try {
    const user = await requireContractor();

    // Verify line item's invoice belongs to contractor and is DRAFT
    const lineItem = await prisma.contractorInvoiceLineItem.findUnique({
      where: { id: lineItemId },
      include: { invoice: { select: { id: true, contractor_id: true, status: true } } },
    });

    if (!lineItem) {
      return { success: false as const, error: 'Line item not found' };
    }

    if (lineItem.invoice.contractor_id !== user.contractorId) {
      return { success: false as const, error: 'Line item not found' };
    }

    if (lineItem.invoice.status !== 'DRAFT') {
      return { success: false as const, error: 'Cannot modify line items on a non-DRAFT invoice' };
    }

    await prisma.contractorInvoiceLineItem.delete({
      where: { id: lineItemId },
    });

    // Recalculate invoice total
    await recalculateInvoiceTotal(lineItem.invoice.id);

    revalidatePath('/contractor-portal/invoices');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to remove line item',
    };
  }
}

// ============================================================================
// INVOICE SUBMISSION
// ============================================================================

/**
 * Submit a draft invoice for review. Validates total > 0 and required documents.
 */
export async function submitInvoice(invoiceId: string) {
  try {
    const user = await requireContractor();
    submitContractorInvoiceSchema.parse({ invoice_id: invoiceId });

    // Verify invoice belongs to contractor and is DRAFT
    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: invoiceId,
        contractor_id: user.contractorId,
        status: 'DRAFT',
      },
      include: { documents: { select: { document_type: true } } },
    });

    if (!invoice) {
      return { success: false as const, error: 'Invoice not found or is not in DRAFT status' };
    }

    if (invoice.total_amount.lte(new Decimal(0))) {
      return { success: false as const, error: 'Invoice total must be greater than 0' };
    }

    // Check required document types
    const contractor = await prisma.contractor.findUnique({
      where: { id: user.contractorId },
      select: { required_doc_types: true },
    });

    const requiredDocTypes = (contractor?.required_doc_types as string[] | null) ?? [];

    if (requiredDocTypes.length > 0) {
      const uploadedTypes = new Set(invoice.documents.map((d) => d.document_type as string));
      const missingTypes = requiredDocTypes.filter((t) => !uploadedTypes.has(t));

      if (missingTypes.length > 0) {
        return {
          success: false as const,
          error: `Missing required documents: ${missingTypes.join(', ')}`,
        };
      }
    }

    const updated = await prisma.contractorInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'SUBMITTED',
        submitted_at: new Date(),
      },
    });

    revalidatePath('/contractor-portal/invoices');
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to submit invoice',
    };
  }
}

// ============================================================================
// INVOICE HISTORY & DETAIL
// ============================================================================

/**
 * Get all invoices for the current contractor, ordered by year DESC, month DESC.
 */
export async function getInvoiceHistory() {
  try {
    const user = await requireContractor();

    const invoices = await prisma.contractorInvoice.findMany({
      where: { contractor_id: user.contractorId },
      select: {
        id: true,
        month: true,
        year: true,
        base_amount: true,
        total_amount: true,
        status: true,
        submitted_at: true,
        reviewed_at: true,
        rejection_reason: true,
        created_at: true,
        payment: {
          select: {
            status: true,
            amount: true,
            payment_method: true,
            completed_at: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return { success: true as const, data: invoices };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load invoice history',
    };
  }
}

/**
 * Get a single invoice with full details: line_items, documents, and payment.
 */
export async function getInvoice(invoiceId: string) {
  try {
    const user = await requireContractor();

    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: invoiceId,
        contractor_id: user.contractorId,
      },
      include: {
        line_items: { orderBy: { sort_order: 'asc' } },
        documents: { orderBy: { uploaded_at: 'desc' } },
        payment: true,
      },
    });

    if (!invoice) {
      return { success: false as const, error: 'Invoice not found' };
    }

    return { success: true as const, data: invoice };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load invoice',
    };
  }
}
