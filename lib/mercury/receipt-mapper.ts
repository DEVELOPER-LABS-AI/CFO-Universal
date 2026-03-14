/**
 * Mercury Deposit → Client Receipt Mapping Service (T014)
 *
 * Handles linking of Mercury credit (deposit) transactions to clients
 * for the invoiced-vs-received revenue reconciliation view.
 *
 * Key rules:
 * - Only CREDIT transactions (positive amounts) can be linked as receipts
 * - mercury_transaction_id is unique — one deposit maps to one client
 * - Suggestions use Jaro-Winkler fuzzy match against client names
 * - Admin always links manually; no automatic linking for revenue
 */

import { prisma } from '@/lib/prisma';
import { normalizeName, calculateSimilarity } from './utils';

interface UnassociatedDeposit {
  mercuryTransactionId: string;
  amount: number;
  transactionDate: string;
  counterpartyName: string | null;
  description: string | null;
  suggestedClientId: string | null;
  suggestedClientName: string | null;
  suggestionConfidence: number | null;
}

interface ClientSuggestion {
  clientId: string;
  clientName: string;
  confidence: number;
}

/**
 * Get Mercury credit transactions not yet linked to a ClientCashReceipt.
 * Calls suggestClientForDeposit for each to enrich the response.
 *
 * @param organizationId - Organization to scope suggestions
 * @param page - 1-based page number (default: 1)
 * @param limit - Results per page (default: 20)
 */
export async function getUnassociatedDeposits(
  connectionId: string,
  organizationId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ deposits: UnassociatedDeposit[]; total: number }> {
  const offset = (page - 1) * limit;

  // Get Mercury credit transactions (is_credit = true) that don't yet
  // have a ClientCashReceipt.  Note: amounts are stored as Math.abs(),
  // so we MUST use the is_credit flag — not the amount sign — to
  // distinguish deposits from expenses.
  // Find mercury transaction IDs already linked as receipts
  const linkedIds = await prisma.clientCashReceipt.findMany({
    where: { organization_id: organizationId },
    select: { mercury_transaction_id: true },
  });
  const linkedSet = new Set(linkedIds.map((r) => r.mercury_transaction_id));

  const allCredits = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
      is_credit: true, // Only actual deposits/credits
    },
    select: {
      mercury_transaction_id: true,
      amount: true,
      transaction_date: true,
      merchant_name: true,
      description: true,
    },
    orderBy: { transaction_date: 'desc' },
  });

  // Filter out already-linked deposits
  const unlinked = allCredits.filter(
    (e) =>
      e.mercury_transaction_id &&
      !linkedSet.has(e.mercury_transaction_id)
  );

  const total = unlinked.length;
  const page_items = unlinked.slice(offset, offset + limit);

  // Enrich with client suggestions
  const deposits: UnassociatedDeposit[] = await Promise.all(
    page_items.map(async (tx) => {
      const suggestion = tx.merchant_name
        ? await suggestClientForDeposit(tx.merchant_name, organizationId)
        : null;

      return {
        mercuryTransactionId: tx.mercury_transaction_id!,
        amount: Number(tx.amount),
        transactionDate: tx.transaction_date.toISOString(),
        counterpartyName: tx.merchant_name,
        description: tx.description,
        suggestedClientId: suggestion?.clientId || null,
        suggestedClientName: suggestion?.clientName || null,
        suggestionConfidence: suggestion?.confidence || null,
      };
    })
  );

  return { deposits, total };
}

/**
 * Suggest a client for a deposit using Jaro-Winkler fuzzy match
 * against client names.
 *
 * @param counterpartyName - Merchant/counterparty name from Mercury
 * @param organizationId - Organization to scope search
 * @returns Best client match or null if below threshold
 */
export async function suggestClientForDeposit(
  counterpartyName: string,
  organizationId: string
): Promise<ClientSuggestion | null> {
  const normalizedCounterparty = normalizeName(counterpartyName);

  const clients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: 'ACTIVE',
    },
    select: { id: true, name: true },
  });

  const matches: ClientSuggestion[] = clients
    .map((client) => ({
      clientId: client.id,
      clientName: client.name,
      confidence: calculateSimilarity(normalizedCounterparty, normalizeName(client.name)),
    }))
    .filter((m) => m.confidence >= 0.7) // Lower threshold for suggestions (not auto-linking)
    .sort((a, b) => b.confidence - a.confidence);

  return matches[0] || null;
}

/**
 * Options for enhanced deposit linking with fee tracking and payment allocations.
 */
interface LinkDepositOptions {
  paymentMethod?: 'ACH' | 'DOMESTIC_WIRE' | 'INTERNATIONAL_WIRE' | 'CREDIT_CARD' | 'CHECK';
  grossAmount?: number | null;
  feeAmount?: number;
  feePercentage?: number | null;
  notes?: string | null;
  allocations?: Array<{
    periodMonth: number;
    periodYear: number;
    serviceId?: string | null;
    amount: number;
    description?: string | null;
  }>;
}

/**
 * Link a Mercury deposit transaction to a client as a cash receipt.
 *
 * Rules enforced:
 * - Amount must be positive (credit/deposit — not a debit)
 * - mercury_transaction_id must be unique (one deposit → one client)
 * - Client must belong to the same organization
 * - If allocations provided, their sum must equal the net amount (within $0.01)
 *
 * @returns Created ClientCashReceipt ID
 * @throws Error with code if validation fails
 */
export async function linkDepositToClient(
  mercuryTransactionId: string,
  clientId: string,
  userId: string,
  organizationId: string,
  options?: LinkDepositOptions
): Promise<string> {
  // Verify client belongs to organization
  const client = await prisma.client.findFirst({
    where: { id: clientId, organization_id: organizationId, deleted_at: null },
    select: { id: true },
  });
  if (!client) {
    const err = new Error('Client not found or does not belong to this organization');
    (err as NodeJS.ErrnoException).code = 'CLIENT_NOT_FOUND';
    throw err;
  }

  // Find the Mercury transaction in expense records
  const tx = await prisma.expenseRecord.findFirst({
    where: {
      organization_id: organizationId,
      mercury_transaction_id: mercuryTransactionId,
    },
    select: { amount: true, transaction_date: true, is_credit: true },
  });

  if (!tx) {
    const err = new Error('Mercury transaction not found');
    (err as NodeJS.ErrnoException).code = 'TRANSACTION_NOT_FOUND';
    throw err;
  }

  // Enforce: must be a credit/deposit (amounts are stored as Math.abs, so check is_credit flag)
  if (!tx.is_credit) {
    const err = new Error('Transaction is a debit, not a deposit');
    (err as NodeJS.ErrnoException).code = 'NOT_A_DEPOSIT';
    throw err;
  }

  // Check for existing link (unique constraint)
  const existing = await prisma.clientCashReceipt.findUnique({
    where: { mercury_transaction_id: mercuryTransactionId },
  });
  if (existing) {
    const err = new Error('This deposit is already linked to a client');
    (err as NodeJS.ErrnoException).code = 'ALREADY_LINKED';
    throw err;
  }

  const netAmount = Number(tx.amount);
  const feeAmount = options?.feeAmount ?? 0;
  const grossAmount = options?.grossAmount ?? (feeAmount > 0 ? netAmount + feeAmount : null);

  // Validate allocation sum matches net amount
  if (options?.allocations && options.allocations.length > 0) {
    const allocationSum = options.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (Math.abs(allocationSum - netAmount) > 0.01) {
      const err = new Error(
        `Allocation total ($${allocationSum.toFixed(2)}) does not match net deposit amount ($${netAmount.toFixed(2)})`
      );
      (err as NodeJS.ErrnoException).code = 'ALLOCATION_MISMATCH';
      throw err;
    }
  }

  const receiptDate = tx.transaction_date;
  // Use first allocation's period if provided, otherwise derive from receipt date
  const period_month = options?.allocations?.[0]?.periodMonth ?? (receiptDate.getMonth() + 1);
  const period_year = options?.allocations?.[0]?.periodYear ?? receiptDate.getFullYear();

  // Create receipt + allocations in a transaction
  const result = await prisma.$transaction(async (prismaClient) => {
    const receipt = await prismaClient.clientCashReceipt.create({
      data: {
        organization_id: organizationId,
        client_id: clientId,
        mercury_transaction_id: mercuryTransactionId,
        amount: netAmount,
        gross_amount: grossAmount,
        fee_amount: feeAmount,
        fee_percentage: options?.feePercentage ?? null,
        payment_method: options?.paymentMethod ?? null,
        notes: options?.notes ?? null,
        receipt_date: receiptDate,
        period_month,
        period_year,
        linked_by_user_id: userId,
      },
    });

    // Create allocation rows
    const allocations = options?.allocations && options.allocations.length > 0
      ? options.allocations
      : [{ periodMonth: period_month, periodYear: period_year, amount: netAmount, serviceId: null, description: null }];

    await prismaClient.paymentAllocation.createMany({
      data: allocations.map((a, idx) => ({
        client_cash_receipt_id: receipt.id,
        service_id: a.serviceId ?? null,
        period_month: a.periodMonth,
        period_year: a.periodYear,
        amount: a.amount,
        description: a.description ?? null,
        sort_order: idx,
      })),
    });

    return receipt;
  });

  return result.id;
}
