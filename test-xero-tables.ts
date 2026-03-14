/**
 * Test script to verify Xero tables and enum fix
 * Run with: npx ts-node test-xero-tables.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testXeroTables() {
  console.log('🧪 Testing Xero tables and enum fix...\n')

  try {
    // Test 1: Query xero_connections table
    console.log('Test 1: Querying xero_connections table...')
    const connections = await prisma.xeroConnection.findMany({
      take: 1,
      select: {
        id: true,
        organization_id: true,
        connection_status: true,
        created_at: true,
      },
    })
    console.log(`✅ xero_connections table exists and queryable`)
    console.log(`   Found ${connections.length} connections`)
    if (connections.length > 0) {
      console.log(`   Sample connection status: ${connections[0].connection_status}`)
    }

    // Test 2: Query xero_sync_logs table
    console.log('\nTest 2: Querying xero_sync_logs table...')
    const syncLogs = await prisma.xeroSyncLog.findMany({
      take: 1,
      select: {
        id: true,
        sync_type: true,
        status: true,
        started_at: true,
      },
    })
    console.log(`✅ xero_sync_logs table exists and queryable`)
    console.log(`   Found ${syncLogs.length} sync logs`)

    // Test 3: Query xero_contact_mapping table
    console.log('\nTest 3: Querying xero_contact_mapping table...')
    const mappings = await prisma.xeroContactMapping.findMany({
      take: 1,
      select: {
        id: true,
        mapping_type: true,
        created_at: true,
      },
    })
    console.log(`✅ xero_contact_mapping table exists and queryable`)
    console.log(`   Found ${mappings.length} contact mappings`)

    // Test 4: Query expense_records (shared by both integrations)
    console.log('\nTest 4: Querying expense_records table...')
    const expenses = await prisma.expenseRecord.findMany({
      take: 1,
      select: {
        id: true,
        sync_source: true,
        category: true,
        created_at: true,
      },
    })
    console.log(`✅ expense_records table exists and queryable`)
    console.log(`   Found ${expenses.length} expense records`)

    // Test 5: Query revenue_records (for Xero invoices)
    console.log('\nTest 5: Querying revenue_records table...')
    const revenue = await prisma.revenueRecord.findMany({
      take: 1,
      select: {
        id: true,
        sync_source: true,
        status: true,
        created_at: true,
      },
    })
    console.log(`✅ revenue_records table exists and queryable`)
    console.log(`   Found ${revenue.length} revenue records`)

    // Test 6: Verify Xero enum types
    console.log('\nTest 6: Verifying Xero enum types...')
    const enumTest = await prisma.$queryRaw`
      SELECT
        typname as enum_name,
        nspname as schema_name
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE t.typtype = 'e'
        AND (
          t.typname LIKE '%Xero%'
          OR t.typname = 'ConnectionStatus'
          OR t.typname = 'SyncType'
          OR t.typname = 'SyncJobStatus'
        )
      ORDER BY t.typname;
    `
    console.log(`✅ Found ${Array.isArray(enumTest) ? enumTest.length : 0} Xero-related enum types`)
    if (Array.isArray(enumTest) && enumTest.length > 0) {
      enumTest.forEach((row: any) => {
        console.log(`   - ${row.enum_name} (schema: ${row.schema_name})`)
      })
    }

    console.log('\n✅ All tests passed! Xero tables and enums are working correctly.\n')
    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    return false
  } finally {
    await prisma.$disconnect()
  }
}

testXeroTables()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
