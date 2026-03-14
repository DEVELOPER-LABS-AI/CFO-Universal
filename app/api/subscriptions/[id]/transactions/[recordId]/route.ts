/**
 * DELETE /api/subscriptions/[id]/transactions/[recordId]
 *
 * Unlinks a specific transaction from a subscription by deleting the
 * SubscriptionTransactionRecord. Used to fix incorrect associations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

interface RouteContext {
  params: Promise<{ id: string; recordId: string }>;
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const organizationId = await getOrganizationId();
    const { id: subscriptionId, recordId } = await context.params;

    // Verify the record exists and belongs to this org + subscription
    const record = await prisma.subscriptionTransactionRecord.findUnique({
      where: { id: recordId },
      select: { id: true, subscription_id: true, organization_id: true },
    });

    if (!record || record.organization_id !== organizationId || record.subscription_id !== subscriptionId) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    await prisma.subscriptionTransactionRecord.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/subscriptions/[id]/transactions/[recordId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
