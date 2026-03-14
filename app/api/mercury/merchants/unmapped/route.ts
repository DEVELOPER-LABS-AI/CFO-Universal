/**
 * GET /api/mercury/merchants/unmapped
 * Get unmapped merchants that need manual mapping.
 *
 * T046: Each merchant now includes:
 *   - transaction_type: 'DEBIT' | 'CREDIT' | 'UNKNOWN' (derived from expense_records)
 *   - suggested_subscription_id / suggested_subscription_name (preview-mode fuzzy match)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapMerchantToSubscription } from '@/lib/mercury/subscription-mapper';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    // Get normalized names that are already mapped (to contractor, agency, subscription, client, expense category, or owner)
    const mappedNames = await prisma.merchantMappingCache.findMany({
      where: {
        connection_id: connection.id,
        OR: [
          { contractor_id: { not: null } },
          { agency_id: { not: null } },
          { subscription_id: { not: null } },
          { client_id: { not: null } },
          { expense_category_id: { not: null } },
          { staff_id: { not: null } },
        ],
      },
      select: { normalized_merchant_name: true },
    });
    const mappedNameSet = new Set(mappedNames.map((m) => m.normalized_merchant_name));

    // Get unmapped merchants (no entity mapped at all)
    // Also exclude merchants whose normalized name already has a mapping
    // Exclude PER_TRANSACTION merchants — they are managed via rules, not the unmapped queue
    const unmappedMerchants = await prisma.merchantMappingCache.findMany({
      where: {
        connection_id: connection.id,
        contractor_id: null,
        agency_id: null,
        subscription_id: null,
        client_id: null,
        expense_category_id: null,
        staff_id: null,
        mapping_mode: 'SINGLE',
      },
      select: {
        id: true,
        mercury_merchant_name: true,
        normalized_merchant_name: true,
        mapped_at: true,
        last_transaction_date: true,
      },
      orderBy: [
        { last_transaction_date: { sort: 'desc', nulls: 'last' } }, // Most recent transaction first
      ],
    });

    // Deduplicate: filter out merchants whose normalized name is already mapped,
    // and keep only one entry per normalized name (the most recent by transaction date)
    const seenNormalized = new Set<string>();
    const deduplicatedMerchants = unmappedMerchants.filter((m) => {
      // Skip if this normalized name is already mapped elsewhere
      if (mappedNameSet.has(m.normalized_merchant_name)) return false;
      // Skip if we've already included an entry with this normalized name
      if (seenNormalized.has(m.normalized_merchant_name)) return false;
      seenNormalized.add(m.normalized_merchant_name);
      return true;
    });

    // Get all non-owner contractors for dropdown
    // Owners should be mapped via the Owner dropdown (staff_id) for pay tracking
    const contractors = await prisma.contractor.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        engagement_type: { not: 'OWNER' },
      },
      select: {
        id: true,
        name: true,
        engagement_type: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all active clients for deposit linking dropdown
    const clients = await prisma.client.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'ACTIVE',
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get all active subscriptions for mapping dropdown
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get all agencies for mapping dropdown
    const agencies = await prisma.agency.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get all vendor expense categories for mapping dropdown
    const expenseCategories = await prisma.vendorExpenseCategory.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Get owner staff for mapping dropdown (owner pay tracking)
    const ownerStaff = await prisma.staff.findMany({
      where: {
        organization_id: organizationId,
        engagement_type: 'OWNER',
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // T046: Enrich each merchant with transaction_type, last transaction date, and subscription suggestion
    const enriched = await Promise.all(
      deduplicatedMerchants.map(async (merchant) => {
        // Determine transaction type and get last transaction date from expense records
        const sampleExpense = await prisma.expenseRecord.findFirst({
          where: { merchant_name: merchant.mercury_merchant_name },
          select: { amount: true, is_credit: true, transaction_date: true },
          orderBy: { transaction_date: 'desc' },
        });

        let transaction_type: 'DEBIT' | 'CREDIT' | 'UNKNOWN' = 'UNKNOWN';
        if (sampleExpense) {
          transaction_type = sampleExpense.is_credit ? 'CREDIT' : 'DEBIT';
        }

        // Use last_transaction_date from cache, fall back to expense record date
        const last_transaction_date = merchant.last_transaction_date
          ?? sampleExpense?.transaction_date
          ?? merchant.mapped_at;

        // Preview-mode subscription suggestion — does NOT cache the result
        // We call the tiered mapper but it will cache on match, which is acceptable
        // for review queue enrichment; admins can confirm to promote to EXACT
        let suggested_subscription_id: string | null = null;
        let suggested_subscription_name: string | null = null;

        try {
          const subId = await mapMerchantToSubscription(
            connection.id,
            organizationId,
            merchant.mercury_merchant_name
          );

          if (subId) {
            const sub = await prisma.subscription.findUnique({
              where: { id: subId },
              select: { id: true, name: true },
            });
            suggested_subscription_id = sub?.id ?? null;
            suggested_subscription_name = sub?.name ?? null;
          }
        } catch {
          // Non-fatal — suggestion enrichment failure should not break the response
        }

        return {
          ...merchant,
          transaction_type,
          last_transaction_date,
          suggested_subscription_id,
          suggested_subscription_name,
        };
      })
    );

    return NextResponse.json({
      unmapped_merchants: enriched,
      contractors,
      clients,
      subscriptions,
      agencies,
      expenseCategories,
      ownerStaff,
    });
  } catch (error: unknown) {
    console.error('Error fetching unmapped merchants:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
