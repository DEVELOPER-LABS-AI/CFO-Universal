/**
 * Test script to verify Mercury tables and enum fix
 * Run with: npx ts-node test-mercury-tables.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testMercuryTables() {
  console.log('🧪 Testing Mercury tables and enum fix...\n')

  try {
    // Test 1: Query mercury_connections table
    console.log('Test 1: Querying mercury_connections table...')
    const connections = await prisma.mercuryConnection.findMany({
      take: 1,
      select: {
        id: true,
        organization_id: true,
        connection_status: true,
        created_at: true,
      },
    })
    console.log(`✅ mercury_connections table exists and queryable`)
    console.log(`   Found ${connections.length} connections`)
    if (connections.length > 0) {
      console.log(`   Sample connection status: ${connections[0].connection_status}`)
    }

    // Test 2: Query mercury_sync_logs table
    console.log('\nTest 2: Querying mercury_sync_logs table...')
    const syncLogs = await prisma.mercurySyncLog.findMany({
      take: 1,
      select: {
        id: true,
        sync_type: true,
        status: true,
        started_at: true,
      },
    })
    console.log(`✅ mercury_sync_logs table exists and queryable`)
    console.log(`   Found ${syncLogs.length} sync logs`)
    if (syncLogs.length > 0) {
      console.log(`   Sample sync status: ${syncLogs[0].status}`)
    }

    // Test 3: Query merchant_mapping_cache table
    console.log('\nTest 3: Querying merchant_mapping_cache table...')
    const mappings = await prisma.merchantMappingCache.findMany({
      take: 1,
      select: {
        id: true,
        mapping_confidence: true,
        mapped_by: true,
      },
    })
    console.log(`✅ merchant_mapping_cache table exists and queryable`)
    console.log(`   Found ${mappings.length} merchant mappings`)

    // Test 4: Query transaction_categorization_rules table
    console.log('\nTest 4: Querying transaction_categorization_rules table...')
    const rules = await prisma.transactionCategorizationRule.findMany({
      take: 1,
      select: {
        id: true,
        rule_type: true,
        category: true,
      },
    })
    console.log(`✅ transaction_categorization_rules table exists and queryable`)
    console.log(`   Found ${rules.length} categorization rules`)

    // Test 5: Query account_balance_history table
    console.log('\nTest 5: Querying account_balance_history table...')
    const balances = await prisma.accountBalanceHistory.findMany({
      take: 1,
      select: {
        id: true,
        account_type: true,
        snapshot_date: true,
      },
    })
    console.log(`✅ account_balance_history table exists and queryable`)
    console.log(`   Found ${balances.length} balance snapshots`)

    // Test 6: Verify enum types work correctly
    console.log('\nTest 6: Verifying enum types...')
    const enumTest = await prisma.$queryRaw`
      SELECT
        typname as enum_name,
        nspname as schema_name
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE t.typtype = 'e'
        AND (
          t.typname LIKE '%mercury%'
          OR t.typname LIKE '%mapping%'
          OR t.typname LIKE '%categorization%'
        )
      ORDER BY t.typname;
    `
    console.log(`✅ Found ${Array.isArray(enumTest) ? enumTest.length : 0} Mercury-related enum types`)
    if (Array.isArray(enumTest) && enumTest.length > 0) {
      enumTest.forEach((row: any) => {
        console.log(`   - ${row.enum_name} (schema: ${row.schema_name})`)
      })
    }

    console.log('\n✅ All tests passed! Mercury tables and enums are working correctly.\n')
    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Stack trace:', error.stack)
    }
    return false
  } finally {
    await prisma.$disconnect()
  }
}

testMercuryTables()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
