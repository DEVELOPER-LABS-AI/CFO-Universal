/**
 * T025: Data migration script — converts existing ClientService records into ServiceContract records.
 *
 * For each ClientService record:
 * 1. Get client.start_date for start_month/start_year
 * 2. Use custom_rate if set, else service.standard_rate
 * 3. Create ServiceContract with billing_model=RETAINER, status=ACTIVE
 *    (or COMPLETED if client status is CHURNED/INACTIVE), no end date
 * 4. Preserve all ServiceRateHistory entries unchanged
 *
 * Run with: npx tsx scripts/migrate-client-services-to-contracts.ts
 * Add --dry-run to preview without writing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`\n=== Migrate ClientService to ServiceContract ===`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  // Get all ClientService records with their client and service data
  const clientServices = await prisma.clientService.findMany({
    include: {
      client: {
        select: {
          id: true,
          name: true,
          organization_id: true,
          start_date: true,
          status: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          standard_rate: true,
        },
      },
    },
  });

  console.log(`Found ${clientServices.length} ClientService records to migrate.\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const cs of clientServices) {
    // Check if a contract already exists for this client-service pair
    const existingContract = await prisma.serviceContract.findFirst({
      where: {
        client_id: cs.client_id,
        service_id: cs.service_id,
      },
    });

    if (existingContract) {
      console.log(`  SKIP: ${cs.client.name} / ${cs.service.name} — contract already exists (${existingContract.id})`);
      skipped++;
      continue;
    }

    // Resolve rate: custom_rate if set, else standard_rate
    const monthlyRate = cs.custom_rate
      ? Number(cs.custom_rate)
      : Number(cs.service.standard_rate);

    // Determine start from client's start_date
    const startMonth = cs.client.start_date.getMonth() + 1;
    const startYear = cs.client.start_date.getFullYear();

    // Determine status: COMPLETED if client is CHURNED or INACTIVE
    const contractStatus = cs.client.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED';

    // Determine end date for COMPLETED contracts: use client churn_date or current month
    let endMonth: number | null = null;
    let endYear: number | null = null;
    if (contractStatus === 'COMPLETED') {
      // For churned/inactive clients, we don't know when exactly, so leave end open
      // The COMPLETED status itself indicates the contract is no longer active
      const now = new Date();
      endMonth = now.getMonth() + 1;
      endYear = now.getFullYear();
    }

    console.log(`  ${isDryRun ? 'WOULD CREATE' : 'CREATE'}: ${cs.client.name} / ${cs.service.name} — RETAINER $${monthlyRate}/mo from ${startMonth}/${startYear}, status=${contractStatus}`);

    if (!isDryRun) {
      try {
        await prisma.serviceContract.create({
          data: {
            organization_id: cs.client.organization_id,
            client_id: cs.client_id,
            service_id: cs.service_id,
            billing_model: 'RETAINER',
            status: contractStatus,
            start_month: startMonth,
            start_year: startYear,
            end_month: endMonth,
            end_year: endYear,
            monthly_rate: monthlyRate,
            project_fee: null,
            term_months: null,
            notes: 'Auto-migrated from ClientService record',
          },
        });
        created++;
      } catch (err: any) {
        console.error(`  ERROR: ${cs.client.name} / ${cs.service.name} — ${err.message}`);
        errors++;
      }
    } else {
      created++;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`  Total ClientService records: ${clientServices.length}`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  ServiceRateHistory: preserved (unchanged)\n`);

  if (isDryRun) {
    console.log('This was a dry run. Run without --dry-run to apply changes.\n');
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
