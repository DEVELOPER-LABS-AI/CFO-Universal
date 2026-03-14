/**
 * GET/POST /api/mercury/merchants/[merchantId]/rules
 * List and create categorization rules scoped to a specific merchant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recategorizePerTransactionMerchant } from '@/lib/mercury/categorization-engine';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

/**
 * GET - List rules scoped to this merchant, enriched with entity display names
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    await requireAdminOrExecutive();
    const { merchantId } = await params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Get merchant mapping to extract merchant name
    const mapping = await prisma.merchantMappingCache.findUnique({
      where: { id: merchantId },
      select: { mercury_merchant_name: true, connection: { select: { organization_id: true } } },
    });

    if (!mapping || mapping.connection.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Merchant mapping not found' }, { status: 404 });
    }

    // Fetch rules scoped to this merchant
    const rules = await prisma.transactionCategorizationRule.findMany({
      where: {
        organization_id: organizationId,
        merchant_name_scope: mapping.mercury_merchant_name,
      },
      select: {
        id: true,
        rule_type: true,
        pattern: true,
        category: true,
        priority: true,
        is_active: true,
        contractor_id: true,
        subscription_id: true,
        agency_id: true,
        client_id: true,
        expense_category_id: true,
        staff_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Collect unique entity IDs for batch lookup
    const contractorIds = rules.map((r) => r.contractor_id).filter(Boolean) as string[];
    const subscriptionIds = rules.map((r) => r.subscription_id).filter(Boolean) as string[];
    const agencyIds = rules.map((r) => r.agency_id).filter(Boolean) as string[];
    const clientIds = rules.map((r) => r.client_id).filter(Boolean) as string[];
    const categoryIds = rules.map((r) => r.expense_category_id).filter(Boolean) as string[];
    const staffIds = rules.map((r) => r.staff_id).filter(Boolean) as string[];

    const [contractors, subscriptions, agencies, clients, categories, staff] = await Promise.all([
      contractorIds.length > 0
        ? prisma.contractor.findMany({ where: { id: { in: contractorIds } }, select: { id: true, name: true } })
        : [],
      subscriptionIds.length > 0
        ? prisma.subscription.findMany({ where: { id: { in: subscriptionIds } }, select: { id: true, name: true } })
        : [],
      agencyIds.length > 0
        ? prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } })
        : [],
      clientIds.length > 0
        ? prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
        : [],
      categoryIds.length > 0
        ? prisma.vendorExpenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
        : [],
      staffIds.length > 0
        ? prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const contractorMap = new Map(contractors.map((c) => [c.id, c.name]));
    const subscriptionMap = new Map(subscriptions.map((s) => [s.id, s.name]));
    const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const staffMap = new Map(staff.map((s) => [s.id, s.name]));

    const enrichedRules = rules.map((rule) => ({
      ...rule,
      contractor_name: rule.contractor_id ? contractorMap.get(rule.contractor_id) ?? null : null,
      subscription_name: rule.subscription_id ? subscriptionMap.get(rule.subscription_id) ?? null : null,
      agency_name: rule.agency_id ? agencyMap.get(rule.agency_id) ?? null : null,
      client_name: rule.client_id ? clientMap.get(rule.client_id) ?? null : null,
      expense_category_name: rule.expense_category_id ? categoryMap.get(rule.expense_category_id) ?? null : null,
      staff_name: rule.staff_id ? staffMap.get(rule.staff_id) ?? null : null,
    }));

    return NextResponse.json({ rules: enrichedRules, merchant_name: mapping.mercury_merchant_name });
  } catch (error: unknown) {
    console.error('Error fetching merchant rules:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new rule scoped to this merchant
 * Sets merchant_name_scope automatically from the merchant mapping.
 * Triggers recategorization of existing expense records for this merchant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    await requireAdminOrExecutive();
    const { merchantId } = await params;
    const body = await request.json();
    const {
      organizationId,
      rule_type,
      pattern,
      category,
      priority,
      contractorId,
      subscriptionId,
      agencyId,
      clientId,
      expenseCategoryId,
      staffId,
    } = body;

    if (!organizationId || !rule_type || !pattern || !category) {
      return NextResponse.json(
        { error: 'Missing required parameters: organizationId, rule_type, pattern, category' },
        { status: 400 }
      );
    }

    // Validate mutual exclusivity of entity targets
    const targetCount = [contractorId, subscriptionId, agencyId, clientId, expenseCategoryId, staffId].filter(Boolean).length;
    if (targetCount > 1) {
      return NextResponse.json(
        { error: 'Entity targets are mutually exclusive — provide at most one' },
        { status: 400 }
      );
    }

    // Get merchant mapping
    const mapping = await prisma.merchantMappingCache.findUnique({
      where: { id: merchantId },
      select: {
        mercury_merchant_name: true,
        mapping_mode: true,
        connection: { select: { organization_id: true } },
      },
    });

    if (!mapping || mapping.connection.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Merchant mapping not found' }, { status: 404 });
    }

    if (mapping.mapping_mode !== 'PER_TRANSACTION') {
      return NextResponse.json(
        { error: 'Merchant must be in PER_TRANSACTION mode to add rules' },
        { status: 400 }
      );
    }

    // Create the rule
    const rule = await prisma.transactionCategorizationRule.create({
      data: {
        organization_id: organizationId,
        rule_type,
        pattern,
        category,
        priority: priority ?? 100,
        merchant_name_scope: mapping.mercury_merchant_name,
        contractor_id: contractorId || null,
        subscription_id: subscriptionId || null,
        agency_id: agencyId || null,
        client_id: clientId || null,
        expense_category_id: expenseCategoryId || null,
        staff_id: staffId || null,
        created_by_user_id: 'admin',
      },
    });

    // Recategorize existing expense records
    const recatResult = await recategorizePerTransactionMerchant(
      organizationId,
      mapping.mercury_merchant_name
    );

    console.log(
      `[Rule Create] Created rule ${rule.id} for merchant "${mapping.mercury_merchant_name}", ` +
      `recategorized ${recatResult.updated} expense records`
    );

    return NextResponse.json({
      success: true,
      rule: {
        id: rule.id,
        rule_type: rule.rule_type,
        pattern: rule.pattern,
        category: rule.category,
        priority: rule.priority,
        merchant_name_scope: rule.merchant_name_scope,
      },
      recategorized_count: recatResult.updated,
    });
  } catch (error: unknown) {
    console.error('Error creating merchant rule:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
