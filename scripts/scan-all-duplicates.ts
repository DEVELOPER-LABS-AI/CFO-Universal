/**
 * Scan ALL Mercury expense records for business-level duplicates.
 * Groups by extractBaseVendorName(merchant) + amount + transaction_date.
 * Reports duplicate groups and optionally cleans them (keeping earliest).
 *
 * Usage:
 *   npx tsx scripts/scan-all-duplicates.ts           # Dry-run scan
 *   npx tsx scripts/scan-all-duplicates.ts --clean    # Delete duplicates
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Inline extractBaseVendorName to avoid path alias issues in scripts
function extractBaseVendorName(name: string): string {
  if (!name) return ''
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
    .replace(/\b(inc|llc|corp|ltd|co|corporation|limited|company)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface DuplicateGroup {
  baseVendor: string
  amount: string
  date: string
  records: Array<{
    id: string
    mercury_transaction_id: string | null
    merchant_name: string | null
    description: string | null
    created_at: Date
    subscription_id: string | null
    contractor_id: string | null
    agency_id: string | null
    staff_id: string | null
    expense_category_id: string | null
    categorization_rule_id: string | null
  }>
}

async function main() {
  const cleanMode = process.argv.includes('--clean')

  console.log(`\n=== Mercury Transaction Duplicate Scanner ===`)
  console.log(`Mode: ${cleanMode ? 'CLEAN (will delete duplicates)' : 'SCAN (dry run)'}\n`)

  // Fetch all Mercury-synced expense records
  const records = await prisma.expenseRecord.findMany({
    where: {
      mercury_transaction_id: { not: null },
    },
    select: {
      id: true,
      mercury_transaction_id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
      description: true,
      created_at: true,
      subscription_id: true,
      contractor_id: true,
      agency_id: true,
      staff_id: true,
      expense_category_id: true,
      categorization_rule_id: true,
    },
    orderBy: { created_at: 'asc' },
  })

  console.log(`Total Mercury expense records: ${records.length}\n`)

  // Group by business key: baseVendor + amount + date
  const groups = new Map<string, DuplicateGroup>()

  for (const r of records) {
    const baseVendor = extractBaseVendorName(r.merchant_name || '')
    const dateKey = r.transaction_date.toISOString().split('T')[0]
    const amountKey = r.amount.toString()
    const key = `${baseVendor}|${amountKey}|${dateKey}`

    if (!groups.has(key)) {
      groups.set(key, {
        baseVendor,
        amount: amountKey,
        date: dateKey,
        records: [],
      })
    }

    groups.get(key)!.records.push({
      id: r.id,
      mercury_transaction_id: r.mercury_transaction_id,
      merchant_name: r.merchant_name,
      description: r.description,
      created_at: r.created_at,
      subscription_id: r.subscription_id,
      contractor_id: r.contractor_id,
      agency_id: r.agency_id,
      staff_id: r.staff_id,
      expense_category_id: r.expense_category_id,
      categorization_rule_id: r.categorization_rule_id,
    })
  }

  // Filter to only duplicate groups
  const dupeGroups = [...groups.values()].filter(g => g.records.length > 1)

  if (dupeGroups.length === 0) {
    console.log('No duplicates found!')
    return
  }

  // Sort by record count descending
  dupeGroups.sort((a, b) => b.records.length - a.records.length)

  // Report
  let totalDupes = 0
  let totalDupeAmount = 0
  const idsToDelete: string[] = []
  const mercuryIdsToDelete: string[] = []

  console.log(`=== DUPLICATE GROUPS (${dupeGroups.length} groups) ===\n`)

  for (const group of dupeGroups) {
    const [keep, ...dupes] = group.records
    totalDupes += dupes.length
    const dupeAmount = dupes.reduce((sum, d) => sum + Number(group.amount), 0)
    totalDupeAmount += dupeAmount

    console.log(
      `${group.baseVendor} | $${group.amount} | ${group.date} — ` +
      `${group.records.length} records (${dupes.length} to delete)`
    )
    console.log(
      `  KEEP: ${keep.id.slice(0, 8)}... Mercury: ${keep.mercury_transaction_id?.slice(0, 12)} | ` +
      `${(keep.merchant_name ?? '').slice(0, 40)}`
    )
    for (const d of dupes) {
      console.log(
        `  DEL:  ${d.id.slice(0, 8)}... Mercury: ${d.mercury_transaction_id?.slice(0, 12)} | ` +
        `${(d.merchant_name ?? '').slice(0, 40)}`
      )
      idsToDelete.push(d.id)
      if (d.mercury_transaction_id) {
        mercuryIdsToDelete.push(d.mercury_transaction_id)
      }
    }
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`Duplicate groups: ${dupeGroups.length}`)
  console.log(`Records to delete: ${totalDupes}`)
  console.log(`Over-counted expense amount: $${totalDupeAmount.toFixed(2)}`)

  // Check related records
  console.log(`\n=== RELATED RECORDS CHECK ===`)

  const withEntities = idsToDelete.length > 0
    ? await prisma.expenseRecord.findMany({
        where: { id: { in: idsToDelete } },
        select: {
          id: true,
          subscription_id: true,
          contractor_id: true,
          agency_id: true,
          staff_id: true,
          expense_category_id: true,
        },
      })
    : []

  const entityCounts = {
    subscription: withEntities.filter(e => e.subscription_id).length,
    contractor: withEntities.filter(e => e.contractor_id).length,
    agency: withEntities.filter(e => e.agency_id).length,
    staff: withEntities.filter(e => e.staff_id).length,
    expense_category: withEntities.filter(e => e.expense_category_id).length,
  }

  console.log(`  With subscription_id: ${entityCounts.subscription}`)
  console.log(`  With contractor_id: ${entityCounts.contractor}`)
  console.log(`  With agency_id: ${entityCounts.agency}`)
  console.log(`  With staff_id: ${entityCounts.staff}`)
  console.log(`  With expense_category_id: ${entityCounts.expense_category}`)

  const subTxnCount = mercuryIdsToDelete.length > 0
    ? await prisma.subscriptionTransactionRecord.count({
        where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
      })
    : 0

  const cashReceiptCount = mercuryIdsToDelete.length > 0
    ? await prisma.clientCashReceipt.count({
        where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
      })
    : 0

  console.log(`  SubscriptionTransactionRecord refs: ${subTxnCount}`)
  console.log(`  ClientCashReceipt refs: ${cashReceiptCount}`)

  if (!cleanMode) {
    console.log(`\n=== DRY RUN — No records deleted ===`)
    console.log(`Run with --clean to delete duplicates.`)
    return
  }

  // Clean mode: delete duplicates
  console.log(`\n=== PERFORMING DELETION ===`)

  // Delete related records first (FK constraints)
  if (subTxnCount > 0) {
    const res = await prisma.subscriptionTransactionRecord.deleteMany({
      where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
    })
    console.log(`Deleted ${res.count} SubscriptionTransactionRecord(s)`)
  }

  if (cashReceiptCount > 0) {
    const res = await prisma.clientCashReceipt.deleteMany({
      where: { mercury_transaction_id: { in: mercuryIdsToDelete } },
    })
    console.log(`Deleted ${res.count} ClientCashReceipt(s)`)
  }

  // Delete duplicate expense records in batches (avoid query size limits)
  const batchSize = 500
  let deletedTotal = 0
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize)
    const res = await prisma.expenseRecord.deleteMany({
      where: { id: { in: batch } },
    })
    deletedTotal += res.count
  }

  console.log(`Deleted ${deletedTotal} duplicate ExpenseRecord(s)`)

  // Verify
  const remaining = await prisma.expenseRecord.count({
    where: { mercury_transaction_id: { not: null } },
  })
  console.log(`\nRemaining Mercury expense records: ${remaining}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
