/**
 * POST /api/mercury/merchants/map
 * Save manual merchant-to-contractor, agency, subscription, or client mapping.
 *
 * Accepts mutually exclusive entity targets:
 *   - contractorId — maps merchant to contractor + triggers 90-day backfill (T023, T024)
 *   - subscriptionId — maps merchant to subscription + triggers 90-day backfill (T020)
 *   - clientId — maps CREDIT merchant to client + creates ClientCashReceipt records
 *
 * Response includes backfill_count (T025).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backfillContractorTransactions } from '@/lib/mercury/subscription-sync';
import { cacheSubscriptionMapping } from '@/lib/mercury/subscription-mapper';
import { backfillSubscriptionTransactions } from '@/lib/mercury/subscription-sync';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    const body = await request.json();
    const { merchantMappingId, contractorId, agencyId, subscriptionId, clientId, expenseCategoryId, expenseClientId, staffId, perTransaction } = body;

    if (!merchantMappingId) {
      return NextResponse.json(
        { error: 'Missing required parameter: merchantMappingId' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Branch G: Per-Transaction mapping mode
    // -----------------------------------------------------------------------
    if (perTransaction) {
      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          mapping_mode: 'PER_TRANSACTION',
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          client_id: null,
          expense_category_id: null,
          staff_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          confidence_score: 1.0,
          mapped_at: new Date(),
        },
      });

      const mapping = await prisma.merchantMappingCache.findUnique({
        where: { id: merchantMappingId },
        select: { mercury_merchant_name: true },
      });

      console.log(
        `[Manual Mapping] Set merchant "${mapping?.mercury_merchant_name}" to PER_TRANSACTION mode`
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping?.mercury_merchant_name,
          mapping_mode: 'PER_TRANSACTION',
          mapped_at: new Date(),
        },
        backfill_count: 0,
      });
    }

    // Validate mutual exclusivity of entity targets
    const targetCount = [contractorId, agencyId, subscriptionId, clientId, expenseCategoryId, staffId].filter(Boolean).length;
    if (targetCount === 0) {
      return NextResponse.json(
        { error: 'Must provide contractorId, agencyId, subscriptionId, clientId, expenseCategoryId, staffId, or perTransaction' },
        { status: 400 }
      );
    }
    if (targetCount > 1) {
      return NextResponse.json(
        { error: 'contractorId, agencyId, subscriptionId, clientId, expenseCategoryId, and staffId are mutually exclusive' },
        { status: 400 }
      );
    }

    // Get merchant mapping
    const mapping = await prisma.merchantMappingCache.findUnique({
      where: { id: merchantMappingId },
      select: {
        id: true,
        mercury_merchant_name: true,
        normalized_merchant_name: true,
        connection_id: true,
      },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: 'Merchant mapping not found' },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // Branch A: Subscription mapping (T020)
    // -----------------------------------------------------------------------
    if (subscriptionId) {
      const subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, organization_id: organizationId },
        select: { id: true, name: true },
      });

      if (!subscription) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      await cacheSubscriptionMapping(
        mapping.connection_id,
        mapping.mercury_merchant_name,
        subscriptionId,
        'EXACT',
        1.0
      );

      const backfillResult = await backfillSubscriptionTransactions(
        mapping.connection_id,
        organizationId,
        subscriptionId,
        mapping.mercury_merchant_name
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping.mercury_merchant_name,
          subscription_id: subscriptionId,
          subscription_name: subscription.name,
          mapped_at: new Date(),
        },
        backfill_count: backfillResult.linked,
      });
    }

    // -----------------------------------------------------------------------
    // Branch D: Agency mapping
    // -----------------------------------------------------------------------
    if (agencyId) {
      const agency = await prisma.agency.findFirst({
        where: { id: agencyId, organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
      });

      if (!agency) {
        return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
      }

      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          agency_id: agencyId,
          contractor_id: null,
          subscription_id: null,
          client_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          confidence_score: 1.0,
          mapped_at: new Date(),
        },
      });

      // Backfill: tag existing expense records with agency_id
      const backfillResult = await prisma.expenseRecord.updateMany({
        where: {
          organization_id: organizationId,
          merchant_name: mapping.mercury_merchant_name,
          agency_id: null,
        },
        data: { agency_id: agencyId },
      });

      console.log(
        `[Manual Mapping] Mapped merchant "${mapping.mercury_merchant_name}" to agency "${agency.name}", ` +
        `backfilled ${backfillResult.count} expense records`
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping.mercury_merchant_name,
          agency_id: agencyId,
          agency_name: agency.name,
          mapped_at: new Date(),
        },
        backfill_count: backfillResult.count,
      });
    }

    // -----------------------------------------------------------------------
    // Branch E: Expense Category mapping
    // -----------------------------------------------------------------------
    if (expenseCategoryId) {
      const category = await prisma.vendorExpenseCategory.findFirst({
        where: { id: expenseCategoryId, organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
      });

      if (!category) {
        return NextResponse.json({ error: 'Expense category not found' }, { status: 404 });
      }

      // Optional: allocate expense to a specific client
      let allocatedClient: { id: string; name: string } | null = null;
      if (expenseClientId) {
        const client = await prisma.client.findFirst({
          where: { id: expenseClientId, organization_id: organizationId, deleted_at: null },
          select: { id: true, name: true },
        });
        if (!client) {
          return NextResponse.json({ error: 'Client not found for expense allocation' }, { status: 404 });
        }
        allocatedClient = client;
      }

      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          expense_category_id: expenseCategoryId,
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          client_id: allocatedClient?.id ?? null,
          staff_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          confidence_score: 1.0,
          mapped_at: new Date(),
        },
      });

      console.log(
        `[Manual Mapping] Mapped merchant "${mapping.mercury_merchant_name}" to expense category "${category.name}"` +
        (allocatedClient ? ` (allocated to client "${allocatedClient.name}")` : '')
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping.mercury_merchant_name,
          expense_category_id: expenseCategoryId,
          expense_category_name: category.name,
          client_id: allocatedClient?.id ?? null,
          client_name: allocatedClient?.name ?? null,
          mapped_at: new Date(),
        },
        backfill_count: 0,
      });
    }

    // -----------------------------------------------------------------------
    // Branch C: Client mapping (CREDIT merchants → ClientCashReceipt)
    // -----------------------------------------------------------------------
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
      });

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      // Update merchant mapping cache
      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          client_id: clientId,
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          confidence_score: 1.0,
          mapped_at: new Date(),
        },
      });

      // Backfill: Create ClientCashReceipt for all CREDIT transactions from this merchant
      const creditTransactions = await prisma.expenseRecord.findMany({
        where: {
          organization_id: organizationId,
          merchant_name: mapping.mercury_merchant_name,
          is_credit: true,
          mercury_transaction_id: { not: null },
        },
        select: {
          mercury_transaction_id: true,
          amount: true,
          transaction_date: true,
        },
      });

      let backfillCount = 0;
      for (const tx of creditTransactions) {
        if (!tx.mercury_transaction_id) continue;
        // Skip if already linked
        const existing = await prisma.clientCashReceipt.findUnique({
          where: { mercury_transaction_id: tx.mercury_transaction_id },
          select: { id: true },
        });
        if (existing) continue;

        const receiptDate = tx.transaction_date;
        await prisma.clientCashReceipt.create({
          data: {
            organization_id: organizationId,
            client_id: clientId,
            mercury_transaction_id: tx.mercury_transaction_id,
            amount: tx.amount,
            receipt_date: receiptDate,
            period_month: receiptDate.getMonth() + 1,
            period_year: receiptDate.getFullYear(),
            linked_by_user_id: 'admin',
          },
        });
        backfillCount++;
      }

      console.log(
        `[Manual Mapping] Mapped CREDIT merchant "${mapping.mercury_merchant_name}" to client "${client.name}", ` +
        `backfilled ${backfillCount} cash receipts`
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping.mercury_merchant_name,
          client_id: clientId,
          client_name: client.name,
          mapped_at: new Date(),
        },
        backfill_count: backfillCount,
      });
    }

    // -----------------------------------------------------------------------
    // Branch F: Owner (Staff) mapping — for owner pay tracking
    // -----------------------------------------------------------------------
    if (staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: staffId, organization_id: organizationId, engagement_type: 'OWNER', deleted_at: null },
        select: { id: true, name: true },
      });

      if (!staff) {
        return NextResponse.json({ error: 'Owner staff member not found' }, { status: 404 });
      }

      await prisma.merchantMappingCache.update({
        where: { id: merchantMappingId },
        data: {
          staff_id: staffId,
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          client_id: null,
          expense_category_id: null,
          mapping_confidence: 'MANUAL',
          mapped_by: 'ADMIN_USER',
          confidence_score: 1.0,
          mapped_at: new Date(),
        },
      });

      // Backfill: tag matching expense records with staff_id and PAYROLL category
      const backfillResult = await prisma.expenseRecord.updateMany({
        where: {
          organization_id: organizationId,
          merchant_name: mapping.mercury_merchant_name,
        },
        data: { staff_id: staffId, category: 'PAYROLL' },
      });

      console.log(
        `[Manual Mapping] Mapped merchant "${mapping.mercury_merchant_name}" to owner "${staff.name}", ` +
        `backfilled ${backfillResult.count} expense records to PAYROLL`
      );

      return NextResponse.json({
        success: true,
        mapping: {
          id: merchantMappingId,
          merchant_name: mapping.mercury_merchant_name,
          staff_id: staffId,
          staff_name: staff.name,
          mapped_at: new Date(),
        },
        backfill_count: backfillResult.count,
      });
    }

    // -----------------------------------------------------------------------
    // Branch B: Contractor mapping (original path + T023-T025 backfill)
    // -----------------------------------------------------------------------
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: contractorId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!contractor) {
      return NextResponse.json(
        { error: 'Contractor not found or does not belong to organization' },
        { status: 404 }
      );
    }

    // Update merchant mapping
    const updated = await prisma.merchantMappingCache.update({
      where: { id: merchantMappingId },
      data: {
        contractor_id: contractorId,
        agency_id: null,
        subscription_id: null,
        client_id: null,
        mapping_confidence: 'MANUAL',
        mapped_by: 'ADMIN_USER',
        confidence_score: 1.0,
        mapped_at: new Date(),
      },
    });

    // T023+T024: Backfill historical contractor transactions (last 90 days)
    const backfillResult = await backfillContractorTransactions(
      mapping.connection_id,
      organizationId,
      contractorId,
      mapping.mercury_merchant_name
    );

    console.log(
      `[Manual Mapping] Mapped merchant "${mapping.mercury_merchant_name}" to contractor "${contractor.name}", ` +
      `backfilled ${backfillResult.updated} records`
    );

    return NextResponse.json({
      success: true,
      mapping: {
        id: updated.id,
        merchant_name: updated.mercury_merchant_name,
        contractor_id: updated.contractor_id,
        contractor_name: contractor.name,
        mapped_at: updated.mapped_at,
      },
      backfill_count: backfillResult.updated, // T025
    });
  } catch (error: unknown) {
    console.error('Error saving merchant mapping:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
