/**
 * POST /api/mercury/expenses/categorize
 *
 * Update the category and entity assignment of a Mercury expense.
 * Supports all entity types with mutual exclusivity enforcement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const body = await request.json();
    const {
      expenseId, category, organizationId,
      contractorId, clientId, agencyId,
      subscriptionId, staffId, expenseCategoryId,
    } = body;

    if (!expenseId || !category || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameters: expenseId, category, organizationId' },
        { status: 400 }
      );
    }

    // Validate category is a valid ExpenseCategory enum value
    const validCategories = [
      'CONTRACTOR_COST',
      'SUBSCRIPTION',
      'TOOLS',
      'PAYROLL',
      'OVERHEAD',
      'MARKETING',
      'OTHER',
    ];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Enforce mutual exclusivity -- at most one entity FK
    const entityIds = [contractorId, clientId, agencyId, subscriptionId, staffId, expenseCategoryId].filter(Boolean);
    if (entityIds.length > 1) {
      return NextResponse.json(
        { error: 'Only one entity can be assigned per transaction' },
        { status: 400 }
      );
    }

    // Verify the expense exists and belongs to the organization
    const expense = await prisma.expenseRecord.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        organization_id: true,
        mercury_transaction_id: true,
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    if (expense.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Expense does not belong to this organization' },
        { status: 403 }
      );
    }

    if (!expense.mercury_transaction_id) {
      return NextResponse.json(
        { error: 'This is not a Mercury expense' },
        { status: 400 }
      );
    }

    // Clear all entity FKs then set the one provided (mutual exclusivity)
    const updateData: Record<string, any> = {
      category,
      updated_at: new Date(),
      contractor_id: null,
      client_id: null,
      agency_id: null,
      subscription_id: null,
      expense_category_id: null,
      staff_id: null,
    };

    if (contractorId) updateData.contractor_id = contractorId;
    if (clientId) updateData.client_id = clientId;
    if (agencyId) updateData.agency_id = agencyId;
    if (subscriptionId) updateData.subscription_id = subscriptionId;
    if (staffId) updateData.staff_id = staffId;
    if (expenseCategoryId) updateData.expense_category_id = expenseCategoryId;

    const updatedExpense = await prisma.expenseRecord.update({
      where: { id: expenseId },
      data: updateData,
      select: {
        id: true,
        category: true,
        amount: true,
        transaction_date: true,
        description: true,
        contractor_id: true,
        client_id: true,
        agency_id: true,
        subscription_id: true,
        expense_category_id: true,
        staff_id: true,
      },
    });

    return NextResponse.json({
      success: true,
      expense: updatedExpense,
      message: `Expense categorized as ${category}`,
    });
  } catch (error: unknown) {
    console.error('Error categorizing expense:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
