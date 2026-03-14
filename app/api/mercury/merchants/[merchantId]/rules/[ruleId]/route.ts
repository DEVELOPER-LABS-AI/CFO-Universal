/**
 * PUT/DELETE /api/mercury/merchants/[merchantId]/rules/[ruleId]
 * Update or deactivate a per-transaction categorization rule.
 * Both trigger recategorization of existing expense records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recategorizePerTransactionMerchant } from '@/lib/mercury/categorization-engine';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

/**
 * PUT - Update rule fields (pattern, category, priority, entity FK)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string; ruleId: string }> }
) {
  try {
    await requireAdminOrExecutive();
    const { merchantId, ruleId } = await params;
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

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Verify rule exists and belongs to this merchant
    const rule = await prisma.transactionCategorizationRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        organization_id: true,
        merchant_name_scope: true,
      },
    });

    if (!rule || rule.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Validate mutual exclusivity if entity targets are provided
    const entityTargets = [contractorId, subscriptionId, agencyId, clientId, expenseCategoryId, staffId];
    const providedTargets = entityTargets.filter((t) => t !== undefined);
    const nonNullTargets = providedTargets.filter(Boolean);

    if (nonNullTargets.length > 1) {
      return NextResponse.json(
        { error: 'Entity targets are mutually exclusive — provide at most one' },
        { status: 400 }
      );
    }

    // Build update data — only update fields that are provided
    const updateData: Record<string, any> = {};
    if (rule_type !== undefined) updateData.rule_type = rule_type;
    if (pattern !== undefined) updateData.pattern = pattern;
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;

    // Entity FKs — if any are explicitly provided (even as null), update all to maintain exclusivity
    if (providedTargets.length > 0) {
      updateData.contractor_id = contractorId || null;
      updateData.subscription_id = subscriptionId || null;
      updateData.agency_id = agencyId || null;
      updateData.client_id = clientId || null;
      updateData.expense_category_id = expenseCategoryId || null;
      updateData.staff_id = staffId || null;
    }

    const updated = await prisma.transactionCategorizationRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Recategorize existing expense records
    let recategorizedCount = 0;
    if (rule.merchant_name_scope) {
      const recatResult = await recategorizePerTransactionMerchant(
        organizationId,
        rule.merchant_name_scope
      );
      recategorizedCount = recatResult.updated;
    }

    return NextResponse.json({
      success: true,
      rule: {
        id: updated.id,
        rule_type: updated.rule_type,
        pattern: updated.pattern,
        category: updated.category,
        priority: updated.priority,
      },
      recategorized_count: recategorizedCount,
    });
  } catch (error: unknown) {
    console.error('Error updating merchant rule:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Deactivate a rule (soft delete via is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string; ruleId: string }> }
) {
  try {
    await requireAdminOrExecutive();
    const { merchantId, ruleId } = await params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Verify rule exists
    const rule = await prisma.transactionCategorizationRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        organization_id: true,
        merchant_name_scope: true,
        is_active: true,
      },
    });

    if (!rule || rule.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Deactivate
    await prisma.transactionCategorizationRule.update({
      where: { id: ruleId },
      data: { is_active: false },
    });

    // Recategorize existing expense records
    let recategorizedCount = 0;
    if (rule.merchant_name_scope) {
      const recatResult = await recategorizePerTransactionMerchant(
        organizationId,
        rule.merchant_name_scope
      );
      recategorizedCount = recatResult.updated;
    }

    return NextResponse.json({
      success: true,
      deactivated: true,
      recategorized_count: recategorizedCount,
    });
  } catch (error: unknown) {
    console.error('Error deactivating merchant rule:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
