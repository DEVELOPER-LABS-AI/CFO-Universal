'use server';

import { requireAdmin } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  inviteContractorSchema,
  updateContractorPortalSettingsSchema,
  updateGlobalContractorSettingsSchema,
  getContractorInvoicesFilterSchema,
  reviewContractorInvoiceSchema,
} from '@/lib/validations/contractor-invoice';

// ============================================================================
// HELPERS
// ============================================================================

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
// CONTRACTOR INVITATION
// ============================================================================

/**
 * Invite a contractor to the portal by creating a Supabase auth user,
 * linking their UserProfile with CONTRACTOR role, and setting invitation status.
 *
 * @param data - Must match inviteContractorSchema (contractor_id, email, full_name)
 * @returns Success with created user info, or error
 */
export async function inviteContractor(data: unknown) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);
    const validated = inviteContractorSchema.parse(data);

    // Verify contractor belongs to this organization
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: validated.contractor_id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!contractor) {
      return { success: false, error: 'Contractor not found in this organization' };
    }

    // Update contractor email
    await prisma.contractor.update({
      where: { id: validated.contractor_id },
      data: { email: validated.email },
    });

    // Create Supabase auth user (or get existing)
    let authUserId: string;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      email_confirm: true,
    });

    if (createError) {
      // If user already exists, look them up
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email === validated.email);
        if (!existing) {
          return { success: false, error: 'Failed to find existing user with this email' };
        }
        authUserId = existing.id;
      } else {
        return { success: false, error: `Failed to create auth user: ${createError.message}` };
      }
    } else {
      authUserId = newUser.user.id;
    }

    // Create or update UserProfile with CONTRACTOR role
    const profile = await prisma.userProfile.upsert({
      where: { user_id: authUserId },
      update: {
        role: 'CONTRACTOR',
        contractor_id: validated.contractor_id,
        status: 'ACTIVE',
        full_name: validated.full_name,
      },
      create: {
        user_id: authUserId,
        full_name: validated.full_name,
        role: 'CONTRACTOR',
        status: 'ACTIVE',
        contractor_id: validated.contractor_id,
      },
    });

    // Link user to organization via UserOrganization
    await prisma.userOrganization.upsert({
      where: {
        user_id_organization_id: {
          user_id: authUserId,
          organization_id: organizationId,
        },
      },
      update: {},
      create: {
        user_id: authUserId,
        organization_id: organizationId,
        role: 'member',
      },
    });

    // Set contractor portal invitation status to PENDING
    await prisma.contractor.update({
      where: { id: validated.contractor_id },
      data: { portal_invitation_status: 'PENDING' },
    });

    revalidatePath('/dashboard/contractors');

    return {
      success: true,
      data: {
        userId: authUserId,
        email: validated.email,
        fullName: validated.full_name,
        profileId: profile.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invite contractor',
    };
  }
}

// ============================================================================
// CONTRACTOR PORTAL SETTINGS (per-contractor)
// ============================================================================

/**
 * Update portal settings for a specific contractor (reminder day override,
 * reminder enabled, required document types).
 *
 * @param contractorId - The contractor ID to update
 * @param data - Must match updateContractorPortalSettingsSchema
 * @returns Success or error
 */
export async function updateContractorPortalSettings(contractorId: string, data: unknown) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);
    const validated = updateContractorPortalSettingsSchema.parse(data);

    // Verify contractor belongs to this organization
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: contractorId,
        organization_id: organizationId,
        deleted_at: null,
      },
    });

    if (!contractor) {
      return { success: false, error: 'Contractor not found in this organization' };
    }

    await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        reminder_day_override: validated.reminder_day_override,
        reminder_enabled: validated.reminder_enabled,
        required_doc_types: validated.required_doc_types,
      },
    });

    revalidatePath('/dashboard/contractors');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update contractor portal settings',
    };
  }
}

// ============================================================================
// GLOBAL CONTRACTOR SETTINGS (organization-level)
// ============================================================================

/**
 * Get the organization-level contractor settings (reminder day, default doc types).
 *
 * @returns Success with settings data, or error
 */
export async function getGlobalContractorSettings() {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        contractor_reminder_day: true,
        contractor_default_doc_types: true,
      },
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    return {
      success: true,
      data: {
        contractor_reminder_day: organization.contractor_reminder_day,
        contractor_default_doc_types: organization.contractor_default_doc_types,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get global contractor settings',
    };
  }
}

/**
 * Update the organization-level contractor settings (reminder day, default doc types).
 *
 * @param data - Must match updateGlobalContractorSettingsSchema
 * @returns Success or error
 */
export async function updateGlobalContractorSettings(data: unknown) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);
    const validated = updateGlobalContractorSettingsSchema.parse(data);

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        contractor_reminder_day: validated.contractor_reminder_day,
        contractor_default_doc_types: validated.contractor_default_doc_types,
      },
    });

    revalidatePath('/dashboard/settings');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update global contractor settings',
    };
  }
}

// ============================================================================
// MANUAL REMINDER
// ============================================================================

const MAX_MANUAL_REMINDERS_PER_MONTH = 3;

/**
 * Send a manual invoice reminder to a specific contractor.
 *
 * Guards against spam by limiting manual reminders to 3 per contractor per month.
 * Uses the same email template as the automated cron-based reminders.
 *
 * @param contractorId - The contractor to send a reminder to
 * @returns Success with reminder count, or error
 */
export async function sendManualReminder(contractorId: string) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    const contractor = await prisma.contractor.findFirst({
      where: {
        id: contractorId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        last_reminder_month: true,
        last_reminder_year: true,
        manual_reminder_count: true,
      },
    });

    if (!contractor) {
      return { success: false, error: 'Contractor not found' };
    }

    if (!contractor.email) {
      return { success: false, error: 'Contractor does not have an email address' };
    }

    // Check rate limit: max 3 manual reminders per month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const isCurrentMonth =
      contractor.last_reminder_month === currentMonth &&
      contractor.last_reminder_year === currentYear;
    const currentCount = isCurrentMonth ? (contractor.manual_reminder_count ?? 0) : 0;

    if (currentCount >= MAX_MANUAL_REMINDERS_PER_MONTH) {
      return {
        success: false,
        error: `Maximum of ${MAX_MANUAL_REMINDERS_PER_MONTH} manual reminders per month reached for this contractor`,
      };
    }

    // Send reminder using the email action
    const { sendContractorReminderEmail } = await import('@/app/actions/contractor-email-actions');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.devlabscfo.com'}/contractor-portal`;

    const result = await sendContractorReminderEmail({
      email: contractor.email,
      name: contractor.name,
      month: monthNames[currentMonth - 1],
      year: currentYear,
      portalUrl,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to send reminder email' };
    }

    // Update tracking: increment manual count, update last_reminder fields
    await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        last_reminder_sent_at: new Date(),
        last_reminder_month: currentMonth,
        last_reminder_year: currentYear,
        manual_reminder_count: isCurrentMonth ? currentCount + 1 : 1,
      },
    });

    console.log(`[audit] Manual reminder sent: contractor=${contractorId}, admin=${admin.userId}, count=${currentCount + 1}/${MAX_MANUAL_REMINDERS_PER_MONTH}`);

    revalidatePath('/dashboard/contractors');

    return { success: true, remainingReminders: MAX_MANUAL_REMINDERS_PER_MONTH - (currentCount + 1) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send manual reminder',
    };
  }
}

// ============================================================================
// CONTRACTOR INVOICE LIST (admin view)
// ============================================================================

/**
 * Get all contractor invoices for the organization, with optional filters
 * for status, contractor, month, and year.
 *
 * @param filters - Optional filters matching getContractorInvoicesFilterSchema
 * @returns Success with invoices array, or error
 */
export async function getAllContractorInvoices(filters?: unknown) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    // Validate filters if provided
    const validated = filters ? getContractorInvoicesFilterSchema.parse(filters) : undefined;

    const invoices = await prisma.contractorInvoice.findMany({
      where: {
        organization_id: organizationId,
        ...(validated?.status && { status: validated.status }),
        ...(validated?.contractor_id && { contractor_id: validated.contractor_id }),
        ...(validated?.month && { month: validated.month }),
        ...(validated?.year && { year: validated.year }),
      },
      include: {
        contractor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return {
      success: true,
      data: invoices,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get contractor invoices',
    };
  }
}

// ============================================================================
// CONTRACTOR INVOICE REVIEW (single invoice detail)
// ============================================================================

/**
 * Get a single contractor invoice with full details for admin review,
 * including line items, documents, contractor info, and payment.
 *
 * @param invoiceId - The invoice UUID to retrieve
 * @returns Success with invoice data, or error
 */
export async function getContractorInvoiceForReview(invoiceId: string) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);

    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: invoiceId,
        organization_id: organizationId,
      },
      include: {
        line_items: {
          orderBy: { sort_order: 'asc' },
        },
        documents: {
          orderBy: { uploaded_at: 'desc' },
        },
        contractor: {
          select: {
            id: true,
            name: true,
            email: true,
            rate: true,
            rate_type: true,
            engagement_type: true,
          },
        },
        payment: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get contractor invoice',
    };
  }
}

// ============================================================================
// CONTRACTOR INVOICE APPROVE / REJECT
// ============================================================================

/**
 * Review (approve or reject) a submitted contractor invoice.
 * Approve sets status to APPROVED. Reject reverts status to DRAFT
 * and records the rejection reason.
 *
 * @param data - Must match reviewContractorInvoiceSchema (invoice_id, action, rejection_reason?)
 * @returns Success or error
 */
export async function reviewContractorInvoice(data: unknown) {
  try {
    const admin = await requireAdmin();
    const organizationId = await getOrganizationId(admin.userId);
    const validated = reviewContractorInvoiceSchema.parse(data);

    // Verify invoice belongs to org and is in SUBMITTED status
    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: validated.invoice_id,
        organization_id: organizationId,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'SUBMITTED') {
      return { success: false, error: 'Invoice must be in SUBMITTED status to review' };
    }

    // Get the admin's UserProfile ID for the reviewed_by field
    const adminProfile = await prisma.userProfile.findUnique({
      where: { user_id: admin.userId },
      select: { id: true },
    });

    if (!adminProfile) {
      return { success: false, error: 'Admin profile not found' };
    }

    if (validated.action === 'approve') {
      await prisma.contractorInvoice.update({
        where: { id: validated.invoice_id },
        data: {
          status: 'APPROVED',
          reviewed_at: new Date(),
          reviewed_by: adminProfile.id,
        },
      });
      console.log(`[audit] Invoice APPROVED: invoice=${validated.invoice_id}, admin=${admin.userId}, contractor=${invoice.contractor_id}`);
    } else {
      // Reject: revert to DRAFT so contractor can revise and resubmit
      await prisma.contractorInvoice.update({
        where: { id: validated.invoice_id },
        data: {
          status: 'DRAFT',
          reviewed_at: new Date(),
          reviewed_by: adminProfile.id,
          rejection_reason: validated.rejection_reason,
        },
      });
      console.log(`[audit] Invoice REJECTED: invoice=${validated.invoice_id}, admin=${admin.userId}, contractor=${invoice.contractor_id}, reason="${validated.rejection_reason}"`);
    }

    // Revalidate both admin and contractor portal paths
    revalidatePath('/dashboard/contractors');
    revalidatePath('/dashboard/contractors/invoices');
    revalidatePath('/contractor-portal');
    revalidatePath('/contractor-portal/invoices');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to review contractor invoice',
    };
  }
}
