/**
 * POST /api/expense-categories
 * Create a new vendor expense category for the organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, organizationId } = body;

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameters: name, organizationId' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.vendorExpenseCategory.findFirst({
      where: {
        organization_id: organizationId,
        name: { equals: name, mode: 'insensitive' },
        deleted_at: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    const category = await prisma.vendorExpenseCategory.create({
      data: {
        organization_id: organizationId,
        name: name.trim(),
      },
    });

    return NextResponse.json({ id: category.id, name: category.name });
  } catch (error: unknown) {
    console.error('Error creating expense category:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
