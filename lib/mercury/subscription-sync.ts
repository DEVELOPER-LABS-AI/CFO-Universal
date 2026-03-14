/**
 * Subscription Transaction Sync Engine (T017)
 *
 * Handles linking Mercury expense records to subscriptions and
 * back-filling historical transaction records.
 *
 * Core principle: Every individual Mercury transaction matched to a subscription
 * is stored as its own SubscriptionTransactionRecord. The subscription's
 * total_cost is computed dynamically (SUM of records), never stored.
 */

import { prisma } from '@/lib/prisma';
import { normalizeName, extractBaseVendorName, calculateSimilarity } from './utils';
import { getErrorMessage } from '@/lib/utils/error';

interface LinkedTransactionResult {
  created: boolean;
  recordId?: string;
  skipped?: boolean; // true if mercury_transaction_id already linked
}

interface BackfillResult {
  linked: number;
  skipped: number;
  errors: string[];
  computedPeriodCost: number;
}

interface BatchProcessResult {
  subscriptionTransactionsCreated: number;
  errors: string[];
}

/**
 * Link a single Mercury transaction to a subscription.
 * Skips silently if already linked (idempotent).
 *
 * @param mercuryTransactionId - Unique Mercury transaction ID
 * @param subscriptionId - Subscription to link to
 * @param organizationId - Scoping organization
 * @param amount - Transaction amount
 * @param transactionDate - Date of the transaction
 * @param merchantName - Raw merchant name from Mercury
 */
export async function linkTransactionToSubscription(
  mercuryTransactionId: string,
  subscriptionId: string,
  organizationId: string,
  amount: number,
  transactionDate: Date,
  merchantName: string
): Promise<LinkedTransactionResult> {
  // Idempotent: skip if already linked
  const existing = await prisma.subscriptionTransactionRecord.findUnique({
    where: { mercury_transaction_id: mercuryTransactionId },
  });

  if (existing) {
    return { created: false, skipped: true, recordId: existing.id };
  }

  const period_month = transactionDate.getMonth() + 1;
  const period_year = transactionDate.getFullYear();

  const record = await prisma.subscriptionTransactionRecord.create({
    data: {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      mercury_transaction_id: mercuryTransactionId,
      amount,
      transaction_date: transactionDate,
      merchant_name: merchantName,
      period_month,
      period_year,
    },
  });

  return { created: true, recordId: record.id };
}

/**
 * Back-fill historical subscription transaction records.
 * Queries ALL financial_expense_records matching the given merchant name,
 * creating SubscriptionTransactionRecord for each.
 *
 * Called when an admin first maps a merchant to a subscription.
 *
 * @returns count of linked, skipped records, and computed period cost
 */
export async function backfillSubscriptionTransactions(
  connectionId: string,
  organizationId: string,
  subscriptionId: string,
  merchantName: string
): Promise<BackfillResult> {
  const baseName = extractBaseVendorName(merchantName);

  // Find DEBIT expense records using base vendor name for broad matching.
  // Only debits (is_credit=false) are linked — credits represent refunds from
  // failed payments and must never inflate subscription costs.
  const matchingExpenses = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
      is_credit: false,
      merchant_name: { contains: baseName.split(/\s/)[0], mode: 'insensitive' },
    },
    select: {
      id: true,
      mercury_transaction_id: true,
      amount: true,
      transaction_date: true,
      merchant_name: true,
    },
    orderBy: { transaction_date: 'desc' },
  });

  // Refine: match if the expense's base vendor name matches ours
  // Uses exact match first, then similarity >= 0.80 to catch variants
  // without over-matching (e.g. "google gsuite" won't match "google cloud")
  const merchantMatches = matchingExpenses.filter((e) => {
    if (!e.merchant_name) return false;
    const expenseBase = extractBaseVendorName(e.merchant_name);
    if (expenseBase === baseName) return true;
    const similarity = calculateSimilarity(expenseBase, baseName);
    return similarity >= 0.80;
  });

  const errors: string[] = [];

  // Build batch data for createMany (much faster than individual inserts)
  const batchData = merchantMatches.map((expense) => {
    const txDate = expense.transaction_date;
    return {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      mercury_transaction_id: expense.mercury_transaction_id!,
      amount: Math.abs(Number(expense.amount)),
      transaction_date: txDate,
      merchant_name: expense.merchant_name || merchantName,
      period_month: txDate.getMonth() + 1,
      period_year: txDate.getFullYear(),
    };
  });

  // Batch insert, skipping duplicates (idempotent via unique mercury_transaction_id)
  let linked = 0;
  try {
    const result = await prisma.subscriptionTransactionRecord.createMany({
      data: batchData,
      skipDuplicates: true,
    });
    linked = result.count;
  } catch (err: unknown) {
    errors.push(`Batch insert error: ${getErrorMessage(err)}`);
  }

  const actualSkipped = merchantMatches.length - linked - errors.length;

  // Compute current period cost for the response
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const periodAgg = await prisma.subscriptionTransactionRecord.aggregate({
    where: {
      subscription_id: subscriptionId,
      period_month: currentMonth,
      period_year: currentYear,
    },
    _sum: { amount: true },
  });

  const computedPeriodCost = Number(periodAgg._sum.amount || 0);

  return { linked, skipped: actualSkipped, errors, computedPeriodCost };
}

/**
 * Batch processor: Given a set of Mercury transactions and active subscription
 * mappings, link each transaction to its subscription.
 *
 * Called by the auto-association engine after each sync.
 *
 * @param connectionId - Mercury connection ID
 * @param organizationId - Organization ID
 * @param transactions - Array of mercury transactions with {mercuryTransactionId, amount, transactionDate, merchantName}
 */
export async function processSubscriptionMappings(
  connectionId: string,
  organizationId: string,
  transactions: Array<{
    mercuryTransactionId: string;
    amount: number;
    transactionDate: Date;
    merchantName: string;
  }>
): Promise<BatchProcessResult> {
  let subscriptionTransactionsCreated = 0;
  const errors: string[] = [];

  // Load all subscription mappings for this connection in one query
  const mappings = await prisma.merchantMappingCache.findMany({
    where: {
      connection_id: connectionId,
      subscription_id: { not: null },
    },
    select: {
      normalized_merchant_name: true,
      subscription_id: true,
    },
  });

  // Build lookup map: normalized name → subscription_id
  const subscriptionMap = new Map<string, string>();
  for (const m of mappings) {
    if (m.subscription_id) {
      subscriptionMap.set(m.normalized_merchant_name, m.subscription_id);
    }
  }

  for (const tx of transactions) {
    try {
      const { normalizeName: normalize } = await import('./utils');
      const normalizedMerchant = normalize(tx.merchantName);
      const subscriptionId = subscriptionMap.get(normalizedMerchant);

      if (!subscriptionId) continue; // No subscription mapping for this merchant

      const result = await linkTransactionToSubscription(
        tx.mercuryTransactionId,
        subscriptionId,
        organizationId,
        Math.abs(tx.amount),
        tx.transactionDate,
        tx.merchantName
      );

      if (result.created) {
        subscriptionTransactionsCreated++;
      }
    } catch (err: unknown) {
      errors.push(`${tx.mercuryTransactionId}: ${getErrorMessage(err)}`);
    }
  }

  return { subscriptionTransactionsCreated, errors };
}

/**
 * Back-fill contractor transaction history.
 * Queries financial_expense_records from last 90 days matching merchant,
 * sets contractor_id = contractorId where currently null.
 *
 * Called when admin first maps a merchant to a contractor (T023).
 */
export async function backfillContractorTransactions(
  connectionId: string,
  organizationId: string,
  contractorId: string,
  merchantName: string
): Promise<{ updated: number; errors: string[] }> {
  const normalizedMerchant = normalizeName(merchantName);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const matchingExpenses = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
      contractor_id: null, // Only update unlinked expense records
      transaction_date: { gte: cutoff },
    },
    select: {
      id: true,
      merchant_name: true,
    },
  });

  const toUpdate = matchingExpenses.filter(
    (e) => e.merchant_name && normalizeName(e.merchant_name) === normalizedMerchant
  );

  let updated = 0;
  const errors: string[] = [];

  for (const expense of toUpdate) {
    try {
      await prisma.expenseRecord.update({
        where: { id: expense.id },
        data: {
          contractor_id: contractorId,
          mercury_sync_status: 'SYNCED',
        },
      });
      updated++;
    } catch (err: unknown) {
      errors.push(`${expense.id}: ${getErrorMessage(err)}`);
    }
  }

  return { updated, errors };
}
