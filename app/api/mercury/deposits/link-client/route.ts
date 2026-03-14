/**
 * POST /api/mercury/deposits/link-client
 *
 * Links a Mercury deposit transaction to a client, creating a ClientCashReceipt
 * with optional fee tracking and payment allocations across periods/services.
 *
 * Error codes:
 *   NOT_A_DEPOSIT        — transaction is a debit, not a credit
 *   ALREADY_LINKED       — mercury_transaction_id already has a ClientCashReceipt
 *   CLIENT_NOT_FOUND     — clientId does not exist in this organization
 *   TRANSACTION_NOT_FOUND — mercuryTransactionId not found in expense records
 *   ALLOCATION_MISMATCH  — allocation amounts don't sum to net deposit amount
 */

import { NextRequest, NextResponse } from 'next/server';
import { linkDepositWithAllocationsSchema } from '@/lib/validations/payment';
import { linkDepositSchema } from '@/lib/validations/subscription';
import { linkDepositToClient } from '@/lib/mercury/receipt-mapper';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();
    const body = await request.json();

    const userId = user.userId;

    // Try enhanced schema first (with allocations), fall back to legacy
    const enhanced = linkDepositWithAllocationsSchema.safeParse(body);
    if (enhanced.success) {
      const { mercuryTransactionId, clientId, ...options } = enhanced.data;

      const receiptId = await linkDepositToClient(
        mercuryTransactionId,
        clientId,
        userId,
        organizationId,
        {
          paymentMethod: options.paymentMethod ?? undefined,
          grossAmount: options.grossAmount,
          feeAmount: options.feeAmount,
          feePercentage: options.feePercentage,
          notes: options.notes,
          allocations: options.allocations,
        }
      );

      return NextResponse.json({
        success: true,
        receiptId,
        clientId,
        mercuryTransactionId,
        allocationCount: options.allocations.length,
      }, { status: 201 });
    }

    // Fallback: legacy schema (no allocations)
    const legacy = linkDepositSchema.safeParse(body);
    if (!legacy.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: legacy.error.flatten() },
        { status: 400 }
      );
    }

    const { mercuryTransactionId, clientId } = legacy.data;
    const receiptId = await linkDepositToClient(
      mercuryTransactionId,
      clientId,
      userId,
      organizationId
    );

    return NextResponse.json({
      success: true,
      receiptId,
      clientId,
      mercuryTransactionId,
    }, { status: 201 });
  } catch (error: unknown) {
    const code = (error as any)?.code as string | undefined;

    if (code === 'TRANSACTION_NOT_FOUND' || code === 'CLIENT_NOT_FOUND') {
      return NextResponse.json({ error: code, message: getErrorMessage(error) }, { status: 404 });
    }
    if (code === 'NOT_A_DEPOSIT' || code === 'ALREADY_LINKED' || code === 'ALLOCATION_MISMATCH') {
      return NextResponse.json({ error: code, message: getErrorMessage(error) }, { status: 400 });
    }

    console.error('[POST /api/mercury/deposits/link-client]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
