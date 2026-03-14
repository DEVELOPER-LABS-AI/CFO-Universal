'use server';

import { prisma, Prisma } from '@/lib/prisma';
import { requireAgencyAdmin, requireAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  addLineItemSchema,
  updateLineItemSchema,
  reviewInvoiceSchema,
  addCommentSchema,
  getInvoicesFilterSchema,
} from '@/lib/validations/agency-invoice';
import type { InvoiceLineItemType } from '@prisma/client';

// ============================================================================
// AGENCY ADMIN: INVOICE MANAGEMENT
// ============================================================================

/**
 * Get or create a draft invoice for a given month/year.
 * Auto-generates line items from existing staff rates if creating new.
 */
export async function getOrCreateDraftInvoice(month: number, year: number) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  // Check for existing invoice
  let invoice = await prisma.agencyInvoice.findUnique({
    where: {
      agency_id_month_year: {
        agency_id: user.agencyId,
        month,
        year,
      },
    },
    include: {
      line_items: { orderBy: [{ type: 'asc' }, { sort_order: 'asc' }] },
      comments: { orderBy: { created_at: 'asc' } },
      agency: { select: { name: true } },
    },
  });

  if (invoice) return invoice;

  // Create new draft with auto-generated line items from staff
  const agencyStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
    include: {
      assignments: {
        where: { end_date: null },
        include: {
          client: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get bonuses for this month
  const staffIds = agencyStaff.map((s) => s.id);
  const bonuses = await prisma.staffBonus.findMany({
    where: {
      staff_id: { in: staffIds },
      month,
      year,
    },
    include: { staff: { select: { name: true } } },
  });

  // Get approved reimbursements for this month
  const reimbursements = await prisma.staffReimbursement.findMany({
    where: {
      staff_id: { in: staffIds },
      month,
      year,
      is_approved: true,
    },
    include: { staff: { select: { name: true } } },
  });

  // Build line items
  const lineItems: {
    type: InvoiceLineItemType;
    description: string;
    amount: number;
    staff_id?: string;
    bonus_id?: string;
    reimbursement_id?: string;
    metadata?: Prisma.InputJsonValue;
    sort_order: number;
  }[] = [];

  let sortOrder = 0;

  // Staff cost line items
  for (const staff of agencyStaff) {
    let monthlyAmount = Number(staff.rate);
    if (staff.rate_type === 'HOURLY') {
      monthlyAmount = monthlyAmount * 176; // Standard monthly hours
    } else if (staff.rate_type === 'DAILY') {
      monthlyAmount = monthlyAmount * 22; // Standard monthly workdays
    }

    // Build client allocation breakdown from active assignments
    const clientAllocations = staff.assignments.map((a) => ({
      assignment_id: a.id,
      client_id: a.client_id,
      client_name: a.client.name,
      assignment_type: a.assignment_type,
      base_percentage: Number(a.allocation_percentage),
      allocation_percentage: Number(a.allocation_percentage),
    }));

    lineItems.push({
      type: 'STAFF_COST',
      description: `${staff.name} - ${staff.staff_type} (${staff.rate_type})`,
      amount: monthlyAmount,
      staff_id: staff.id,
      metadata: {
        rate: Number(staff.rate),
        rate_type: staff.rate_type,
        staff_type: staff.staff_type,
        client_allocations: clientAllocations,
      } as Prisma.InputJsonValue,
      sort_order: sortOrder++,
    });
  }

  // Bonus line items
  for (const bonus of bonuses) {
    lineItems.push({
      type: 'BONUS',
      description: `${bonus.staff.name} - ${bonus.bonus_type} bonus`,
      amount: Number(bonus.amount),
      staff_id: bonus.staff_id,
      bonus_id: bonus.id,
      metadata: {
        bonus_type: bonus.bonus_type,
        description: bonus.description,
      } as Prisma.InputJsonValue,
      sort_order: sortOrder++,
    });
  }

  // Reimbursement line items (only approved ones)
  for (const reimbursement of reimbursements) {
    lineItems.push({
      type: 'REIMBURSEMENT',
      description: `${reimbursement.staff.name} - ${reimbursement.reimbursement_type.replace(/_/g, ' ')} reimbursement`,
      amount: Number(reimbursement.amount),
      staff_id: reimbursement.staff_id,
      reimbursement_id: reimbursement.id,
      metadata: {
        reimbursement_type: reimbursement.reimbursement_type,
        description: reimbursement.description,
        receipt_url: reimbursement.receipt_url,
      } as Prisma.InputJsonValue,
      sort_order: sortOrder++,
    });
  }

  // Calculate subtotal
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  // Create invoice with line items in a transaction
  invoice = await prisma.agencyInvoice.create({
    data: {
      agency_id: user.agencyId,
      month,
      year,
      status: 'DRAFT',
      subtotal,
      line_items: {
        create: lineItems,
      },
    },
    include: {
      line_items: { orderBy: [{ type: 'asc' }, { sort_order: 'asc' }] },
      comments: { orderBy: { created_at: 'asc' } },
      agency: { select: { name: true } },
    },
  });

  return invoice;
}

/**
 * Get a specific invoice by ID (agency admin can only see their own)
 */
export async function getInvoice(invoiceId: string) {
  const user = await requireAgencyAdmin();

  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: invoiceId,
      agency_id: user.agencyId,
    },
    include: {
      line_items: { orderBy: [{ type: 'asc' }, { sort_order: 'asc' }] },
      comments: { orderBy: { created_at: 'asc' } },
      agency: { select: { name: true } },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  return invoice;
}

/**
 * Get invoice history for the agency admin's agency
 */
export async function getInvoiceHistory() {
  const user = await requireAgencyAdmin();

  const invoices = await prisma.agencyInvoice.findMany({
    where: {
      agency_id: user.agencyId,
    },
    include: {
      _count: { select: { line_items: true, comments: true } },
      agency: { select: { name: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return invoices;
}

/**
 * Add a line item to a DRAFT invoice
 */
export async function addLineItem(data: unknown) {
  const user = await requireAgencyAdmin();
  const validated = addLineItemSchema.parse(data);

  // Verify invoice belongs to agency and is DRAFT
  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: validated.invoice_id,
      agency_id: user.agencyId,
      status: 'DRAFT',
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found or not editable');
  }

  // Get current max sort_order
  const maxOrder = await prisma.agencyInvoiceLineItem.aggregate({
    where: { invoice_id: invoice.id },
    _max: { sort_order: true },
  });

  const lineItem = await prisma.agencyInvoiceLineItem.create({
    data: {
      invoice_id: invoice.id,
      type: validated.type,
      description: validated.description,
      amount: validated.amount,
      staff_id: validated.staff_id ?? null,
      bonus_id: validated.bonus_id ?? null,
      metadata: validated.metadata as Prisma.InputJsonValue ?? null,
      sort_order: (maxOrder._max.sort_order ?? 0) + 1,
    },
  });

  // Recalculate subtotal
  await recalculateSubtotal(invoice.id);

  revalidatePath('/agency-portal/invoices');
  return lineItem;
}

/**
 * Update a line item on a DRAFT invoice
 */
export async function updateLineItem(lineItemId: string, data: unknown) {
  const user = await requireAgencyAdmin();
  const validated = updateLineItemSchema.parse(data);

  // Verify line item belongs to agency's DRAFT invoice
  const lineItem = await prisma.agencyInvoiceLineItem.findUnique({
    where: { id: lineItemId },
    include: { invoice: { select: { agency_id: true, status: true, id: true } } },
  });

  if (!lineItem || lineItem.invoice.agency_id !== user.agencyId) {
    throw new Error('Line item not found');
  }

  if (lineItem.invoice.status !== 'DRAFT') {
    throw new Error('Cannot edit line items on a non-draft invoice');
  }

  const updated = await prisma.agencyInvoiceLineItem.update({
    where: { id: lineItemId },
    data: {
      ...(validated.description && { description: validated.description }),
      ...(validated.amount !== undefined && { amount: validated.amount }),
      ...(validated.metadata !== undefined && { metadata: validated.metadata as Prisma.InputJsonValue ?? null }),
    },
  });

  await recalculateSubtotal(lineItem.invoice.id);

  revalidatePath('/agency-portal/invoices');
  return updated;
}

/**
 * Remove a line item from a DRAFT invoice
 */
export async function removeLineItem(lineItemId: string) {
  const user = await requireAgencyAdmin();

  const lineItem = await prisma.agencyInvoiceLineItem.findUnique({
    where: { id: lineItemId },
    include: { invoice: { select: { agency_id: true, status: true, id: true } } },
  });

  if (!lineItem || lineItem.invoice.agency_id !== user.agencyId) {
    throw new Error('Line item not found');
  }

  if (lineItem.invoice.status !== 'DRAFT') {
    throw new Error('Cannot remove line items from a non-draft invoice');
  }

  await prisma.agencyInvoiceLineItem.delete({
    where: { id: lineItemId },
  });

  await recalculateSubtotal(lineItem.invoice.id);

  revalidatePath('/agency-portal/invoices');
  return { success: true };
}

/**
 * Submit an invoice for review (DRAFT -> SUBMITTED)
 */
export async function submitInvoice(invoiceId: string) {
  const user = await requireAgencyAdmin();

  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: invoiceId,
      agency_id: user.agencyId,
      status: 'DRAFT',
    },
    include: { _count: { select: { line_items: true } } },
  });

  if (!invoice) {
    throw new Error('Invoice not found or not in draft status');
  }

  if (invoice._count.line_items === 0) {
    throw new Error('Cannot submit an invoice with no line items');
  }

  // Recalculate subtotal before submitting
  await recalculateSubtotal(invoiceId);

  const updated = await prisma.agencyInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'SUBMITTED',
      submitted_at: new Date(),
      submitted_by: user.userId,
    },
  });

  revalidatePath('/agency-portal/invoices');
  revalidatePath('/dashboard/admin/invoices');
  return updated;
}

// ============================================================================
// PLATFORM ADMIN: INVOICE REVIEW
// ============================================================================

/**
 * Get all invoices across agencies (admin only)
 */
export async function getAllInvoices(filters?: unknown) {
  await requireAdmin();
  const organizationId = await getOrganizationId();
  const validated = filters ? getInvoicesFilterSchema.parse(filters) : {};

  const where: Prisma.AgencyInvoiceWhereInput = {
    agency: {
      organization_id: organizationId,
    },
    ...(validated.status && { status: validated.status }),
    ...(validated.agency_id && { agency_id: validated.agency_id }),
    ...(validated.year && { year: validated.year }),
    ...(validated.month && { month: validated.month }),
  };

  const invoices = await prisma.agencyInvoice.findMany({
    where,
    include: {
      agency: { select: { id: true, name: true } },
      _count: { select: { line_items: true, comments: true } },
    },
    orderBy: [{ status: 'asc' }, { year: 'desc' }, { month: 'desc' }],
  });

  return invoices;
}

/**
 * Get a specific invoice with full details (admin only)
 */
export async function getInvoiceForReview(invoiceId: string) {
  await requireAdmin();
  const organizationId = await getOrganizationId();

  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: invoiceId,
      agency: { organization_id: organizationId },
    },
    include: {
      line_items: { orderBy: [{ type: 'asc' }, { sort_order: 'asc' }] },
      comments: { orderBy: { created_at: 'asc' } },
      agency: { select: { id: true, name: true } },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  return invoice;
}

/**
 * Approve or reject an invoice (admin only)
 */
export async function reviewInvoice(data: unknown) {
  const admin = await requireAdmin();
  const organizationId = await getOrganizationId();
  const validated = reviewInvoiceSchema.parse(data);

  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: validated.invoice_id,
      agency: { organization_id: organizationId },
      status: 'SUBMITTED',
    },
    include: {
      line_items: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found or not in submitted status');
  }

  const newStatus = validated.action === 'approve' ? 'APPROVED' : 'DRAFT';

  // Use transaction to update invoice and add comment
  await prisma.$transaction(async (tx) => {
    await tx.agencyInvoice.update({
      where: { id: invoice.id },
      data: {
        status: newStatus,
        reviewed_at: new Date(),
        reviewed_by: admin.userId,
      },
    });

    // Add comment if provided or auto-generate one
    const commentText = validated.comment || (
      validated.action === 'approve'
        ? 'Invoice approved.'
        : 'Invoice rejected. Please review and resubmit.'
    );

    await tx.agencyInvoiceComment.create({
      data: {
        invoice_id: invoice.id,
        user_id: admin.userId,
        user_name: admin.fullName,
        comment: `[${validated.action.toUpperCase()}] ${commentText}`,
      },
    });

    // On approval, sync monthly allocation overrides from STAFF_COST line items
    if (validated.action === 'approve') {
      const staffCostItems = invoice.line_items.filter((li) => li.type === 'STAFF_COST');

      for (const item of staffCostItems) {
        const metadata = item.metadata as Record<string, unknown> | null;
        const clientAllocations = (metadata?.client_allocations ?? []) as Array<{
          assignment_id: string;
          base_percentage: number;
          allocation_percentage: number;
        }>;

        for (const alloc of clientAllocations) {
          if (alloc.allocation_percentage !== alloc.base_percentage) {
            // Allocation differs from base — upsert an override
            await tx.monthlyAllocationOverride.upsert({
              where: {
                assignment_id_month_year: {
                  assignment_id: alloc.assignment_id,
                  month: invoice.month,
                  year: invoice.year,
                },
              },
              update: { allocation_percentage: alloc.allocation_percentage },
              create: {
                assignment_id: alloc.assignment_id,
                month: invoice.month,
                year: invoice.year,
                allocation_percentage: alloc.allocation_percentage,
              },
            });
          } else {
            // Allocation matches base — delete any existing override to revert
            await tx.monthlyAllocationOverride.deleteMany({
              where: {
                assignment_id: alloc.assignment_id,
                month: invoice.month,
                year: invoice.year,
              },
            });
          }
        }
      }
    }
  });

  revalidatePath('/dashboard/admin/invoices');
  revalidatePath('/agency-portal/invoices');
  revalidatePath('/dashboard/staff');
  revalidatePath('/dashboard/clients');
  return { success: true, status: newStatus };
}

/**
 * Mark an approved invoice as paid (admin only)
 */
export async function markInvoicePaid(invoiceId: string) {
  const admin = await requireAdmin();
  const organizationId = await getOrganizationId();

  const invoice = await prisma.agencyInvoice.findFirst({
    where: {
      id: invoiceId,
      agency: { organization_id: organizationId },
      status: 'APPROVED',
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found or not in approved status');
  }

  await prisma.$transaction(async (tx) => {
    await tx.agencyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        paid_by: admin.userId,
      },
    });

    await tx.agencyInvoiceComment.create({
      data: {
        invoice_id: invoiceId,
        user_id: admin.userId,
        user_name: admin.fullName,
        comment: '[PAID] Invoice marked as paid.',
      },
    });
  });

  revalidatePath('/dashboard/admin/invoices');
  revalidatePath('/agency-portal/invoices');
  return { success: true };
}

/**
 * Add a comment to an invoice (both admin and agency admin)
 */
export async function addInvoiceComment(data: unknown) {
  const validated = addCommentSchema.parse(data);

  // Try agency admin first, then admin
  let userId: string;
  let userName: string;
  let agencyId: string | undefined;

  try {
    const agencyUser = await requireAgencyAdmin();
    userId = agencyUser.userId;
    userName = agencyUser.fullName;
    agencyId = agencyUser.agencyId;
  } catch {
    const admin = await requireAdmin();
    userId = admin.userId;
    userName = admin.fullName;
  }

  // Verify access to invoice
  const where: Prisma.AgencyInvoiceWhereInput = { id: validated.invoice_id };
  if (agencyId) {
    where.agency_id = agencyId;
  }

  const invoice = await prisma.agencyInvoice.findFirst({ where });
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const comment = await prisma.agencyInvoiceComment.create({
    data: {
      invoice_id: validated.invoice_id,
      user_id: userId,
      user_name: userName,
      comment: validated.comment,
    },
  });

  revalidatePath('/agency-portal/invoices');
  revalidatePath('/dashboard/admin/invoices');
  return comment;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Recalculate and update the subtotal for an invoice
 */
async function recalculateSubtotal(invoiceId: string) {
  const result = await prisma.agencyInvoiceLineItem.aggregate({
    where: { invoice_id: invoiceId },
    _sum: { amount: true },
  });

  await prisma.agencyInvoice.update({
    where: { id: invoiceId },
    data: { subtotal: result._sum.amount ?? 0 },
  });
}
