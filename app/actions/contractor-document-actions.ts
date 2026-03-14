'use server';

import { prisma } from '@/lib/prisma';
import { requireContractor } from '@/lib/auth/helpers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  uploadDocumentSchema,
  documentFileValidation,
} from '@/lib/validations/contractor-invoice';

/** Supabase Storage bucket name for contractor documents. */
const BUCKET = 'contractor-documents';

// ============================================================================
// DOCUMENT UPLOAD
// ============================================================================

/**
 * Upload a document to a contractor's draft invoice.
 *
 * Accepts a FormData payload with:
 * - `file` (File) - the document file to upload
 * - `invoice_id` (string) - UUID of the target invoice
 * - `document_type` (string) - one of SOW | INVOICE | TAX_FORM | OTHER
 *
 * Validates file size (max 10 MB), MIME type, invoice ownership, and DRAFT status
 * before uploading to Supabase Storage and creating a ContractorDocument record.
 *
 * @param formData - FormData containing file, invoice_id, and document_type
 * @returns Object with `success` flag and `data` (the created document) or `error` message
 */
export async function uploadDocument(formData: FormData) {
  try {
    const user = await requireContractor();

    // ---- Extract and validate form fields ----
    const invoiceId = formData.get('invoice_id') as string | null;
    const documentType = formData.get('document_type') as string | null;
    const file = formData.get('file') as File | null;

    const validated = uploadDocumentSchema.parse({
      invoice_id: invoiceId,
      document_type: documentType,
    });

    // ---- Validate file presence ----
    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false as const, error: 'No file provided' };
    }

    // ---- Validate file size ----
    if (file.size > documentFileValidation.maxSize) {
      return {
        success: false as const,
        error: `File size exceeds the maximum of ${documentFileValidation.maxSize / 1_048_576} MB`,
      };
    }

    // ---- Validate MIME type ----
    if (
      !documentFileValidation.allowedMimeTypes.includes(
        file.type as (typeof documentFileValidation.allowedMimeTypes)[number]
      )
    ) {
      return {
        success: false as const,
        error: `File type "${file.type}" is not allowed. Accepted types: PDF, DOCX, PNG, JPEG`,
      };
    }

    // ---- Verify invoice belongs to this contractor and is DRAFT ----
    const invoice = await prisma.contractorInvoice.findFirst({
      where: {
        id: validated.invoice_id,
        contractor_id: user.contractorId,
        status: 'DRAFT',
      },
      select: { id: true, organization_id: true },
    });

    if (!invoice) {
      return {
        success: false as const,
        error: 'Invoice not found or is not in DRAFT status',
      };
    }

    // ---- Build storage path and upload ----
    const fileId = crypto.randomUUID();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${invoice.organization_id}/${user.contractorId}/${invoice.id}/${fileId}-${sanitizedName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false as const,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    // ---- Create database record ----
    const document = await prisma.contractorDocument.create({
      data: {
        organization_id: invoice.organization_id,
        contractor_id: user.contractorId,
        invoice_id: invoice.id,
        document_type: validated.document_type,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
      },
    });

    revalidatePath('/contractor-portal/invoices');
    return { success: true as const, data: document };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to upload document',
    };
  }
}

// ============================================================================
// DOCUMENT DELETION
// ============================================================================

/**
 * Delete a contractor document and its corresponding file from Supabase Storage.
 *
 * Verifies that the document belongs to the authenticated contractor and that
 * the associated invoice (if any) is still in DRAFT status before proceeding.
 *
 * @param documentId - UUID of the ContractorDocument to delete
 * @returns Object with `success` flag or `error` message
 */
export async function deleteDocument(documentId: string) {
  try {
    const user = await requireContractor();

    // ---- Find document and verify ownership ----
    const document = await prisma.contractorDocument.findUnique({
      where: { id: documentId },
      include: {
        invoice: { select: { status: true } },
      },
    });

    if (!document || document.contractor_id !== user.contractorId) {
      return { success: false as const, error: 'Document not found' };
    }

    // ---- Verify associated invoice is still DRAFT (if linked) ----
    if (document.invoice && document.invoice.status !== 'DRAFT') {
      return {
        success: false as const,
        error: 'Cannot delete documents from a non-DRAFT invoice',
      };
    }

    // ---- Remove file from Supabase Storage ----
    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([document.file_path]);

    if (storageError) {
      return {
        success: false as const,
        error: `Storage deletion failed: ${storageError.message}`,
      };
    }

    // ---- Delete database record ----
    await prisma.contractorDocument.delete({
      where: { id: documentId },
    });

    revalidatePath('/contractor-portal/invoices');
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete document',
    };
  }
}

// ============================================================================
// SIGNED URL GENERATION
// ============================================================================

/**
 * Generate a time-limited signed URL for viewing a contractor document.
 *
 * Verifies that the document belongs to the authenticated contractor before
 * creating a signed URL with a 1-hour expiry from Supabase Storage.
 *
 * @param documentId - UUID of the ContractorDocument to generate a URL for
 * @returns Object with `success` flag and `data.url` (signed URL) or `error` message
 */
export async function getDocumentUrl(documentId: string) {
  try {
    const user = await requireContractor();

    // ---- Find document and verify ownership ----
    const document = await prisma.contractorDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.contractor_id !== user.contractorId) {
      return { success: false as const, error: 'Document not found' };
    }

    // ---- Create signed URL (1 hour = 3600 seconds) ----
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(document.file_path, 3600);

    if (urlError || !signedUrlData?.signedUrl) {
      return {
        success: false as const,
        error: `Failed to generate signed URL: ${urlError?.message ?? 'Unknown error'}`,
      };
    }

    return { success: true as const, data: { url: signedUrlData.signedUrl } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get document URL',
    };
  }
}
