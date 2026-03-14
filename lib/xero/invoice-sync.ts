/**
 * Xero Invoice Sync Service
 *
 * Syncs APPROVED and PAID invoices from Xero to revenue_records.
 *
 * Flow:
 * 1. Get last_sync_at timestamp (incremental sync)
 * 2. Fetch modified invoices from Xero API
 * 3. Map Xero contacts to internal clients
 * 4. Create/update revenue records (only for successfully mapped clients)
 * 5. Update sync timestamp and counts
 *
 * Handles duplicate prevention with upsert on xero_invoice_id.
 *
 * Note: Invoices without client mapping are logged as MAPPING_FAILED
 * and can be manually mapped later via the admin dashboard.
 */

import { XeroClient } from 'xero-node';
import { PrismaClient } from '@prisma/client';
import { mapContactToClient } from './contact-mapper';

/**
 * Get or create default Xero service for revenue records
 * All Xero-synced invoices are assigned to this service
 */
async function getOrCreateXeroService(
  prisma: PrismaClient,
  organizationId: string
): Promise<string> {
  const serviceName = 'Xero Import';

  let service = await prisma.service.findFirst({
    where: {
      organization_id: organizationId,
      name: serviceName,
    },
  });

  if (!service) {
    service = await prisma.service.create({
      data: {
        organization_id: organizationId,
        name: serviceName,
        description: 'Auto-created service for Xero invoice imports',
        standard_rate: 0,
        target_margin: 0,
        is_active: true,
      },
    });
  }

  return service.id;
}

const prisma = new PrismaClient();

export interface SyncResult {
  invoicesProcessed: number;
  invoicesFailed: number;
  invoicesMapped: number;
  invoicesUnmapped: number;
  errors: any[];
}

/**
 * Sync invoices from Xero to revenue records
 *
 * @param organizationId - Organization UUID
 * @param connectionId - Xero connection UUID
 * @param xeroClient - Initialized Xero client
 * @param tenantId - Xero tenant ID
 * @returns Sync result with counts and errors
 */
export async function syncInvoices(
  organizationId: string,
  connectionId: string,
  xeroClient: XeroClient,
  tenantId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    invoicesProcessed: 0,
    invoicesFailed: 0,
    invoicesMapped: 0,
    invoicesUnmapped: 0,
    errors: [],
  };

  try {
    // Get last sync timestamp for incremental sync
    const connection = await prisma.xeroConnection.findUnique({
      where: { id: connectionId },
      select: { last_sync_at: true },
    });

    const lastSyncAt = connection?.last_sync_at;

    console.log(
      `Syncing invoices for organization ${organizationId}`,
      lastSyncAt ? `since ${lastSyncAt.toISOString()}` : '(full sync)'
    );

    // Get or create default Xero service for all invoices
    const xeroServiceId = await getOrCreateXeroService(prisma, organizationId);

    // Fetch invoices from Xero API
    // Filter: APPROVED and PAID invoices only
    // ModifiedAfter: Incremental sync (fetch only new/updated invoices)
    const invoicesResponse = await xeroClient.accountingApi.getInvoices(
      tenantId,
      lastSyncAt || undefined, // ModifiedAfter as Date | undefined
      undefined, // where
      undefined, // order
      undefined, // IDs
      undefined, // InvoiceNumbers
      undefined, // ContactIDs
      ['APPROVED', 'PAID'], // Statuses - only sync approved/paid invoices
      undefined, // page
      false // includeArchived
    );

    const invoices = invoicesResponse.body.invoices || [];
    console.log(`Fetched ${invoices.length} invoices from Xero`);

    // Process each invoice
    for (const invoice of invoices) {
      try {
        result.invoicesProcessed++;

        // Validate invoice data
        if (!invoice.invoiceID || !invoice.contact) {
          throw new Error('Missing invoice ID or contact');
        }

        // Map Xero contact to internal client
        const mapping = await mapContactToClient(
          organizationId,
          connectionId,
          {
            ContactID: invoice.contact.contactID!,
            Name: invoice.contact.name!,
            EmailAddress: invoice.contact.emailAddress,
          }
        );

        // Only create revenue record if we have a client mapping
        // (client_id is required in schema)
        if (mapping.clientId) {
          // Prepare revenue record data with all required fields
          const revenueRecordData = {
            organization_id: organizationId,
            client_id: mapping.clientId,
            service_id: xeroServiceId,
            amount: invoice.total || 0,
            transaction_date: invoice.date ? new Date(invoice.date) : new Date(),
            status: (invoice.status?.toString() === 'PAID' ? 'PAID' : 'PENDING') as any,
            description: invoice.reference || `Xero Invoice ${invoice.invoiceNumber}`,
            external_id: invoice.invoiceID,
            sync_source: 'XERO' as any,
            xero_invoice_id: invoice.invoiceID,
            xero_invoice_number: invoice.invoiceNumber || null,
            revenue_sync_status: 'SYNCED' as any,
            last_synced_at: new Date(),
          };

          // Upsert revenue record (handle duplicates)
          await prisma.revenueRecord.upsert({
            where: {
              organization_id_xero_invoice_id: {
                organization_id: organizationId,
                xero_invoice_id: invoice.invoiceID,
              },
            },
            update: {
              amount: revenueRecordData.amount,
              transaction_date: revenueRecordData.transaction_date,
              status: revenueRecordData.status,
              description: revenueRecordData.description,
              xero_invoice_number: revenueRecordData.xero_invoice_number,
              revenue_sync_status: revenueRecordData.revenue_sync_status,
              last_synced_at: revenueRecordData.last_synced_at,
              updated_at: new Date(),
            },
            create: revenueRecordData,
          });

          result.invoicesMapped++;
        } else {
          // No client mapping - log as unmapped
          result.invoicesUnmapped++;
          result.errors.push({
            type: 'MAPPING_FAILED',
            invoice_id: invoice.invoiceID,
            invoice_number: invoice.invoiceNumber,
            contact_name: invoice.contact.name,
            message: 'Could not map contact to client - revenue record not created',
          });
        }
      } catch (error) {
        result.invoicesFailed++;
        result.errors.push({
          type: 'INVOICE_SYNC_ERROR',
          invoice_id: invoice.invoiceID,
          invoice_number: invoice.invoiceNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error(
          `Failed to sync invoice ${invoice.invoiceNumber}:`,
          error
        );
      }
    }

    // Update last_sync_at timestamp on successful completion
    if (result.invoicesFailed === 0) {
      await prisma.xeroConnection.update({
        where: { id: connectionId },
        data: {
          last_sync_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log('Invoice sync result:', result);
    return result;
  } catch (error) {
    // Fatal error - couldn't fetch invoices
    result.errors.push({
      type: 'API_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
