/**
 * Expense Cleanup Script
 *
 * Performs the following cleanups:
 *   1. Remove internal bank transfers from expense records
 *   2. Remove suspicious true duplicate charges (same vendor, same amount, days apart in same month)
 *   3. Merge duplicate Loom subscription entries
 *   4. Deactivate stale subscriptions with no recent transactions
 *
 * Usage:
 *   npx tsx scripts/cleanup-expenses.ts              # Dry run
 *   npx tsx scripts/cleanup-expenses.ts --execute     # Execute changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');

/** Merchant name patterns that indicate internal bank transfers */
const TRANSFER_PATTERNS = [
  'mercury checking',
  'mercury savings',
  'mercury credit',
  'mercury treasury',
  'chase - checking',
  'chase - savings',
];

/**
 * Check if a merchant name represents an internal bank transfer.
 */
function isInternalTransfer(merchantName: string): boolean {
  const lower = merchantName.toLowerCase();
  return TRANSFER_PATTERNS.some((p) => lower.startsWith(p)) ||
    /internal\s*transfer/i.test(merchantName);
}

/**
 * Normalize merchant name for grouping (mirrors extractBaseVendorName).
 */
function normalizeMerchantName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\*/g, ' ')
    .replace(/\binv[#\s]*\S+/gi, '')
    .replace(/_\S+$/g, '')
    .replace(/[*#_@!]/g, '')
    .replace(/[,\.]/g, '')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/-\d+\b/g, '')
    .replace(
      /\b(inc|llc|corp|ltd|co|corporation|limited|company)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

// =========================================================================
// 1. Re-categorize internal bank transfers as TRANSFER
// =========================================================================

async function recategorizeInternalTransfers(): Promise<number> {
  console.log('\n--- 1. Internal Bank Transfers → TRANSFER Category ---\n');

  const transfers = await prisma.expenseRecord.findMany({
    where: {
      mercury_transaction_id: { not: null },
      category: { not: 'TRANSFER' },
    },
    select: {
      id: true,
      mercury_transaction_id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
      is_credit: true,
      category: true,
    },
  });

  const toRecategorize = transfers.filter((r) =>
    isInternalTransfer(r.merchant_name ?? '')
  );

  if (toRecategorize.length === 0) {
    console.log('  No miscategorized internal transfers found.');
    return 0;
  }

  const totalAmount = toRecategorize.reduce(
    (sum, r) => sum + Number(r.amount),
    0
  );

  console.log(`  Found ${toRecategorize.length} internal transfers to re-categorize ($${totalAmount.toFixed(2)}):`);
  for (const r of toRecategorize) {
    const date = r.transaction_date.toISOString().split('T')[0];
    console.log(
      `    ${date}  ${(r.merchant_name ?? '').padEnd(35)}  $${Number(r.amount).toFixed(2).padStart(12)}  ${r.is_credit ? 'CREDIT' : 'DEBIT'}  (was: ${r.category})`
    );
  }

  if (EXECUTE) {
    const ids = toRecategorize.map((r) => r.id);

    // Unlink from subscriptions/entities since transfers aren't real expenses
    const updated = await prisma.expenseRecord.updateMany({
      where: { id: { in: ids } },
      data: {
        category: 'TRANSFER',
        categorization_confidence: 1.0,
        contractor_id: null,
        agency_id: null,
        subscription_id: null,
        expense_category_id: null,
        staff_id: null,
        categorization_rule_id: null,
      },
    });
    console.log(`  Re-categorized ${updated.count} records as TRANSFER`);
  } else {
    console.log(`  [DRY RUN] Would re-categorize ${toRecategorize.length} records as TRANSFER`);
  }

  return toRecategorize.length;
}

// =========================================================================
// 2. Remove suspicious true duplicates
// =========================================================================

interface DupeGroup {
  normalizedMerchant: string;
  amount: number;
  yearMonth: string;
  records: {
    id: string;
    mercury_transaction_id: string | null;
    merchant_name: string | null;
    amount: number;
    transaction_date: Date;
  }[];
}

/**
 * Known multi-account vendors where multiple charges per month are legitimate.
 * These will be SKIPPED during duplicate cleanup.
 */
const MULTI_ACCOUNT_VENDORS = new Set([
  'instantly',
  'calcom',
  'cal com',
  'linkedin',
  'we-connect',
  'openai',
  'clay labs',
  'rb2b',
  'rb2bcom',
  'twenty three systems',
]);

async function removeSuspiciousDuplicates(): Promise<number> {
  console.log('\n--- 2. Suspicious True Duplicates ---\n');

  const records = await prisma.expenseRecord.findMany({
    where: {
      mercury_transaction_id: { not: null },
      is_credit: false,
    },
    select: {
      id: true,
      mercury_transaction_id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
    },
    orderBy: { transaction_date: 'asc' },
  });

  // Filter out internal transfers first
  const nonTransfers = records.filter(
    (r) => !isInternalTransfer(r.merchant_name ?? '')
  );

  // Group by: normalized merchant + amount + YYYY-MM
  const groups = new Map<string, DupeGroup>();

  for (const r of nonTransfers) {
    const normalized = normalizeMerchantName(r.merchant_name ?? '');
    if (!normalized) continue;

    const d = r.transaction_date;
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const amount = Number(r.amount);
    const key = `${normalized}|${amount}|${yearMonth}`;

    if (!groups.has(key)) {
      groups.set(key, {
        normalizedMerchant: normalized,
        amount,
        yearMonth,
        records: [],
      });
    }
    groups.get(key)!.records.push({
      ...r,
      amount,
    });
  }

  // Only groups with count > 1, excluding known multi-account vendors
  const dupeGroups = [...groups.values()]
    .filter((g) => g.records.length > 1)
    .filter((g) => !MULTI_ACCOUNT_VENDORS.has(g.normalizedMerchant))
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth) || b.amount - a.amount);

  if (dupeGroups.length === 0) {
    console.log('  No suspicious duplicates found (after excluding multi-account vendors).');
    return 0;
  }

  let totalToDelete = 0;
  const idsToDelete: string[] = [];
  const mercuryIdsToDelete: string[] = [];

  console.log(`  Found ${dupeGroups.length} duplicate groups:\n`);

  for (const group of dupeGroups) {
    // Keep the earliest record, delete the rest
    const sorted = group.records.sort(
      (a, b) =>
        a.transaction_date.getTime() - b.transaction_date.getTime()
    );
    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(
      `  ${group.normalizedMerchant} | $${group.amount.toFixed(2)} | ${group.yearMonth} | ` +
      `${group.records.length} records -> keep 1, delete ${remove.length}`
    );
    console.log(
      `    KEEP:   ${keep.transaction_date.toISOString().split('T')[0]}  ${keep.mercury_transaction_id}`
    );
    for (const r of remove) {
      console.log(
        `    DELETE: ${r.transaction_date.toISOString().split('T')[0]}  ${r.mercury_transaction_id}`
      );
      idsToDelete.push(r.id);
      if (r.mercury_transaction_id) mercuryIdsToDelete.push(r.mercury_transaction_id);
    }
    totalToDelete += remove.length;
  }

  const totalOvercharge = dupeGroups.reduce(
    (sum, g) => sum + (g.records.length - 1) * g.amount,
    0
  );

  console.log(`\n  Total to delete: ${totalToDelete} records ($${totalOvercharge.toFixed(2)} overcharge)`);

  if (EXECUTE && idsToDelete.length > 0) {
    // Delete linked records first
    const strs = await prisma.subscriptionTransactionRecord.deleteMany({
      where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
    });
    console.log(`  Deleted ${strs.count} linked SubscriptionTransactionRecords`);

    const ccrs = await prisma.clientCashReceipt.deleteMany({
      where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
    });
    console.log(`  Deleted ${ccrs.count} linked ClientCashReceipts`);

    const deleted = await prisma.expenseRecord.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    console.log(`  DELETED ${deleted.count} duplicate expense records`);
  } else if (!EXECUTE) {
    console.log(`  [DRY RUN] Would delete ${totalToDelete} records`);
  }

  return totalToDelete;
}

// =========================================================================
// 3. Merge duplicate Loom subscriptions
// =========================================================================

async function mergeLoomSubscriptions(): Promise<void> {
  console.log('\n--- 3. Merge Duplicate Loom Subscriptions ---\n');

  const looms = await prisma.subscription.findMany({
    where: {
      name: { contains: 'loom', mode: 'insensitive' },
      is_active: true,
      deleted_at: null,
    },
    include: {
      allocations: true,
      transaction_records: { orderBy: { transaction_date: 'desc' }, take: 1 },
    },
  });

  if (looms.length <= 1) {
    console.log('  No duplicate Loom subscriptions found.');
    return;
  }

  console.log(`  Found ${looms.length} Loom subscriptions:`);
  for (const l of looms) {
    const lastTxn = l.transaction_records[0];
    console.log(
      `    "${l.name}" (${l.id}) — ${l.allocations.length} allocations, ` +
      `last txn: ${lastTxn ? lastTxn.transaction_date.toISOString().split('T')[0] : 'none'}`
    );
  }

  // Keep the one with the most recent transaction, soft-delete the other
  const sorted = looms.sort((a, b) => {
    const aDate = a.transaction_records[0]?.transaction_date?.getTime() ?? 0;
    const bDate = b.transaction_records[0]?.transaction_date?.getTime() ?? 0;
    return bDate - aDate;
  });
  const keep = sorted[0];
  const remove = sorted.slice(1);

  console.log(`  Keep: "${keep.name}" (${keep.id})`);
  for (const r of remove) {
    console.log(`  Soft-delete: "${r.name}" (${r.id})`);
  }

  if (EXECUTE) {
    for (const r of remove) {
      // Reassign transaction records to the kept subscription
      const reassigned = await prisma.subscriptionTransactionRecord.updateMany({
        where: { subscription_id: r.id },
        data: { subscription_id: keep.id },
      });
      console.log(`  Reassigned ${reassigned.count} transaction records from "${r.name}" -> "${keep.name}"`);

      // Reassign expense records
      const expenses = await prisma.expenseRecord.updateMany({
        where: { subscription_id: r.id },
        data: { subscription_id: keep.id },
      });
      console.log(`  Reassigned ${expenses.count} expense records from "${r.name}" -> "${keep.name}"`);

      // Soft-delete the duplicate
      await prisma.subscription.update({
        where: { id: r.id },
        data: { is_active: false, deleted_at: new Date() },
      });
      console.log(`  Soft-deleted "${r.name}"`);
    }
  } else {
    console.log(`  [DRY RUN] Would merge ${remove.length} duplicate(s) into "${keep.name}"`);
  }
}

// =========================================================================
// 4. Deactivate stale subscriptions
// =========================================================================

async function deactivateStaleSubscriptions(): Promise<void> {
  console.log('\n--- 4. Stale Subscriptions (no txns in 3+ months) ---\n');

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const subs = await prisma.subscription.findMany({
    where: {
      is_active: true,
      deleted_at: null,
    },
    include: {
      transaction_records: {
        orderBy: { transaction_date: 'desc' },
        take: 1,
      },
      allocations: true,
    },
  });

  const stale = subs.filter((s) => {
    const lastTxn = s.transaction_records[0];
    if (!lastTxn) return true; // No transactions ever
    return lastTxn.transaction_date < threeMonthsAgo;
  });

  if (stale.length === 0) {
    console.log('  No stale subscriptions found.');
    return;
  }

  console.log(`  Found ${stale.length} stale subscriptions:\n`);
  for (const s of stale) {
    const lastTxn = s.transaction_records[0];
    const lastDate = lastTxn
      ? lastTxn.transaction_date.toISOString().split('T')[0]
      : 'NEVER';
    console.log(
      `    "${s.name}" — last txn: ${lastDate}, allocations: ${s.allocations.length}`
    );
  }

  if (EXECUTE) {
    for (const s of stale) {
      await prisma.subscription.update({
        where: { id: s.id },
        data: { is_active: false },
      });
      console.log(`  Deactivated "${s.name}"`);
    }
  } else {
    console.log(`\n  [DRY RUN] Would deactivate ${stale.length} subscriptions`);
  }
}

// =========================================================================
// Main
// =========================================================================

async function main(): Promise<void> {
  console.log('\n  DevLabs CFO — Expense Cleanup');
  console.log(`  Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`  Generated: ${new Date().toISOString()}`);

  const transfersRecategorized = await recategorizeInternalTransfers();
  const dupesRemoved = await removeSuspiciousDuplicates();
  await mergeLoomSubscriptions();
  await deactivateStaleSubscriptions();

  console.log('\n=== SUMMARY ===');
  console.log(`  Internal transfers re-categorized: ${transfersRecategorized} records`);
  console.log(`  Suspicious duplicates: ${dupesRemoved} records`);
  console.log(`  Mode: ${EXECUTE ? 'EXECUTED' : 'DRY RUN — pass --execute to apply'}\n`);
}

main()
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
