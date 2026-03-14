/**
 * Cleanup Invalid Subscription Transaction Records
 *
 * Removes SubscriptionTransactionRecord entries that were incorrectly created:
 *   1. Credit/refund records (from is_credit=true expense records)
 *   2. Orphaned records (no matching expense record — from non-settled Mercury
 *      transactions like failed payment retries)
 *
 * These inflate subscription costs because Math.abs() makes refunds look like
 * charges, and orphaned records from failed/pending transactions were never
 * validated as settled.
 *
 * Usage:
 *   npx tsx scripts/cleanup-credit-subscription-records.ts              # Dry run
 *   npx tsx scripts/cleanup-credit-subscription-records.ts --execute    # Execute deletions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');

async function main() {
  console.log(`\n=== Cleanup Invalid Subscription Transaction Records ===`);
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  const allBadRecordIds: string[] = [];

  // --- Phase 1: Credit records ---
  console.log('--- Phase 1: Credit/Refund Records ---');

  const creditExpenses = await prisma.expenseRecord.findMany({
    where: {
      is_credit: true,
      mercury_transaction_id: { not: null },
    },
    select: { mercury_transaction_id: true },
  });

  const creditMercuryIds = creditExpenses
    .map((e) => e.mercury_transaction_id)
    .filter((id): id is string => id != null);

  const creditSubRecords = creditMercuryIds.length > 0
    ? await prisma.subscriptionTransactionRecord.findMany({
        where: { mercury_transaction_id: { in: creditMercuryIds } },
        include: { subscription: { select: { id: true, name: true } } },
        orderBy: [{ subscription: { name: 'asc' } }, { transaction_date: 'desc' }],
      })
    : [];

  console.log(`Found ${creditSubRecords.length} subscription records from credit transactions`);
  reportBySubscription(creditSubRecords);
  allBadRecordIds.push(...creditSubRecords.map((r) => r.id));

  // --- Phase 2: Orphaned records (no matching expense record) ---
  console.log('\n--- Phase 2: Orphaned Records (no matching expense record) ---');

  const allSubRecords = await prisma.subscriptionTransactionRecord.findMany({
    select: { id: true, mercury_transaction_id: true, amount: true, subscription_id: true, transaction_date: true },
  });

  // Batch check which mercury_transaction_ids exist in expense records
  const allMercIds = allSubRecords.map((r) => r.mercury_transaction_id).filter(Boolean);
  const existingExpenses = await prisma.expenseRecord.findMany({
    where: { mercury_transaction_id: { in: allMercIds } },
    select: { mercury_transaction_id: true },
  });
  const existingMercIds = new Set(existingExpenses.map((e) => e.mercury_transaction_id));

  const orphanedRecords = allSubRecords.filter(
    (r) => r.mercury_transaction_id && !existingMercIds.has(r.mercury_transaction_id)
  );

  // Exclude any already counted in Phase 1
  const phase1Ids = new Set(allBadRecordIds);
  const newOrphans = orphanedRecords.filter((r) => !phase1Ids.has(r.id));

  // Get subscription names for reporting
  const orphanSubIds = [...new Set(newOrphans.map((r) => r.subscription_id))];
  const orphanSubs = orphanSubIds.length > 0
    ? await prisma.subscription.findMany({
        where: { id: { in: orphanSubIds } },
        select: { id: true, name: true },
      })
    : [];
  const subNameMap = new Map(orphanSubs.map((s) => [s.id, s.name]));

  console.log(`Found ${newOrphans.length} orphaned subscription records (no expense record)`);

  // Group orphans by subscription
  const orphansBySubMap = new Map<string, { name: string; count: number; totalAmount: number }>();
  for (const record of newOrphans) {
    const key = record.subscription_id;
    const existing = orphansBySubMap.get(key) || {
      name: subNameMap.get(key) || 'Unknown',
      count: 0,
      totalAmount: 0,
    };
    existing.count++;
    existing.totalAmount += Number(record.amount);
    orphansBySubMap.set(key, existing);
  }

  if (orphansBySubMap.size > 0) {
    console.log('\nAffected subscriptions:');
    for (const [subId, info] of orphansBySubMap) {
      console.log(`  ${info.name} (${subId}): ${info.count} orphaned records, $${info.totalAmount.toFixed(2)} inflated`);
    }

    console.log('\nOrphaned records:');
    for (const record of newOrphans) {
      const date = record.transaction_date.toISOString().split('T')[0];
      const subName = subNameMap.get(record.subscription_id) || 'Unknown';
      console.log(
        `  ${date}  ${subName.padEnd(30)}  $${Number(record.amount).toFixed(2).padStart(10)}  mercury_tx=${record.mercury_transaction_id}`
      );
    }
  }

  allBadRecordIds.push(...newOrphans.map((r) => r.id));

  // --- Summary & Execute ---
  console.log(`\n=== Summary ===`);
  console.log(`Credit records to remove: ${creditSubRecords.length}`);
  console.log(`Orphaned records to remove: ${newOrphans.length}`);
  console.log(`Total records to remove: ${allBadRecordIds.length}`);

  if (allBadRecordIds.length === 0) {
    console.log('\nNo bad records to clean up. Done.');
    await prisma.$disconnect();
    return;
  }

  if (EXECUTE) {
    const result = await prisma.subscriptionTransactionRecord.deleteMany({
      where: { id: { in: allBadRecordIds } },
    });
    console.log(`\nDeleted ${result.count} invalid subscription transaction records.`);
  } else {
    console.log(`\nDRY RUN: Would delete ${allBadRecordIds.length} records.`);
    console.log('Run with --execute to apply changes.');
  }

  await prisma.$disconnect();
}

/**
 * Report records grouped by subscription.
 */
function reportBySubscription(records: Array<{ subscription_id: string; amount: any; transaction_date: Date; mercury_transaction_id: string; subscription?: { id: string; name: string } | null }>) {
  const bySubscription = new Map<string, { name: string; count: number; totalAmount: number }>();
  for (const record of records) {
    const key = record.subscription_id;
    const existing = bySubscription.get(key) || {
      name: record.subscription?.name || 'Unknown',
      count: 0,
      totalAmount: 0,
    };
    existing.count++;
    existing.totalAmount += Number(record.amount);
    bySubscription.set(key, existing);
  }

  if (bySubscription.size > 0) {
    console.log('\nAffected subscriptions:');
    for (const [subId, info] of bySubscription) {
      console.log(`  ${info.name} (${subId}): ${info.count} records, $${info.totalAmount.toFixed(2)} inflated`);
    }

    console.log('\nRecords:');
    for (const record of records) {
      const date = record.transaction_date.toISOString().split('T')[0];
      console.log(
        `  ${date}  ${(record.subscription?.name || '').padEnd(30)}  $${Number(record.amount).toFixed(2).padStart(10)}  mercury_tx=${record.mercury_transaction_id}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
