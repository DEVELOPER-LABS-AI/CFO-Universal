import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Find Rego Consulting client
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'Rego', mode: 'insensitive' } },
    select: { id: true, name: true, organization_id: true },
  });
  console.log('Client:', client);
  if (!client) return;

  // 2. Find ClientCashReceipts for Rego
  const receipts = await prisma.clientCashReceipt.findMany({
    where: { client_id: client.id },
    orderBy: { receipt_date: 'desc' },
  });
  console.log(`\nClientCashReceipts: ${receipts.length}`);
  for (const r of receipts) {
    console.log(`  ${r.receipt_date.toISOString().split('T')[0]}  $${Number(r.amount).toFixed(2)}  period=${r.period_month}/${r.period_year}  mercury_id=${r.mercury_transaction_id}`);
  }

  // 3. Find ExpenseRecords linked to Rego (credits = revenue)
  const credits = await prisma.expenseRecord.findMany({
    where: {
      client_id: client.id,
      is_credit: true,
    },
    orderBy: { transaction_date: 'desc' },
    select: {
      id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
      is_credit: true,
      mercury_transaction_id: true,
      category: true,
    },
  });
  console.log(`\nCredit ExpenseRecords for Rego: ${credits.length}`);
  for (const c of credits) {
    console.log(`  ${c.transaction_date.toISOString().split('T')[0]}  $${Number(c.amount).toFixed(2)}  ${c.merchant_name}  mercury=${c.mercury_transaction_id}  cat=${c.category}`);
  }

  // 4. Find ALL ExpenseRecords for Rego (both credits and debits)
  const allRecords = await prisma.expenseRecord.findMany({
    where: { client_id: client.id },
    orderBy: { transaction_date: 'desc' },
    take: 20,
    select: {
      id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
      is_credit: true,
      mercury_transaction_id: true,
      category: true,
    },
  });
  console.log(`\nAll ExpenseRecords for Rego (last 20): ${allRecords.length}`);
  for (const r of allRecords) {
    console.log(`  ${r.transaction_date.toISOString().split('T')[0]}  $${Number(r.amount).toFixed(2)}  ${r.is_credit ? 'CREDIT' : 'DEBIT'}  ${r.merchant_name}  cat=${r.category}`);
  }

  // 5. Look for Mercury deposits that SHOULD be Rego's (search by merchant name patterns)
  const regoDeposits = await prisma.expenseRecord.findMany({
    where: {
      mercury_transaction_id: { not: null },
      is_credit: true,
      OR: [
        { merchant_name: { contains: 'Rego', mode: 'insensitive' } },
        { merchant_name: { contains: 'REGO', mode: 'insensitive' } },
        { description: { contains: 'Rego', mode: 'insensitive' } },
      ],
    },
    orderBy: { transaction_date: 'desc' },
    select: {
      id: true,
      merchant_name: true,
      description: true,
      amount: true,
      transaction_date: true,
      client_id: true,
      category: true,
    },
  });
  console.log(`\nMercury credits mentioning "Rego": ${regoDeposits.length}`);
  for (const d of regoDeposits) {
    console.log(`  ${d.transaction_date.toISOString().split('T')[0]}  $${Number(d.amount).toFixed(2)}  "${d.merchant_name}"  client_id=${d.client_id}  cat=${d.category}`);
  }

  // 6. Check merchant mapping for Rego
  const mappings = await prisma.merchantMappingCache.findMany({
    where: {
      OR: [
        { mercury_merchant_name: { contains: 'Rego', mode: 'insensitive' } },
        { client_id: client.id },
      ],
    },
  });
  console.log(`\nMerchant mappings for Rego:`, JSON.stringify(mappings, null, 2));

  // 7. Check if there are ANY credit expense records linked to ANY client
  const anyClientCredits = await prisma.expenseRecord.findMany({
    where: {
      is_credit: true,
      client_id: { not: null },
    },
    take: 10,
    select: {
      client_id: true,
      merchant_name: true,
      amount: true,
      transaction_date: true,
    },
  });
  console.log(`\nAny credit records linked to ANY client: ${anyClientCredits.length}`);
  for (const c of anyClientCredits) {
    console.log(`  client=${c.client_id}  $${Number(c.amount)}  ${c.merchant_name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
