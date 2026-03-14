-- Mercury Integration Schema Verification Script
-- Run this in Supabase SQL Editor after applying 20260215_add_mercury_integration.sql

-- Check 1: Verify all enums exist
SELECT 'mercury_connection_status' AS enum_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mercury_connection_status'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END AS status
UNION ALL
SELECT 'mercury_sync_type',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mercury_sync_type'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mercury_sync_status',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mercury_sync_status'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mercury_sync_trigger',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mercury_sync_trigger'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mapping_confidence',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mapping_confidence'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mapping_source',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mapping_source'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'categorization_rule_type',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'categorization_rule_type'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mercury_account_type',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'mercury_account_type'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'expense_record_sync_status',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_type WHERE typname = 'expense_record_sync_status'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

-- Check 2: Verify all tables exist
SELECT 'mercury_connections' AS table_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'mercury_connections'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END AS status
UNION ALL
SELECT 'mercury_sync_logs',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'mercury_sync_logs'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mercury_transactions',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'mercury_transactions'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'mercury_accounts',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'mercury_accounts'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'account_balance_history',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'account_balance_history'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'merchant_mapping_cache',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'merchant_mapping_cache'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'categorization_rules',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'categorization_rules'
       ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

-- Check 3: Verify RLS is enabled on all tables
SELECT tablename,
       CASE WHEN rowsecurity THEN 'ENABLED ✓' ELSE 'DISABLED ✗' END AS rls_status
FROM pg_tables
WHERE tablename IN (
  'mercury_connections',
  'mercury_sync_logs',
  'mercury_transactions',
  'mercury_accounts',
  'account_balance_history',
  'merchant_mapping_cache',
  'categorization_rules'
)
ORDER BY tablename;

-- Check 4: Count RLS policies per table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'mercury_connections',
  'mercury_sync_logs',
  'mercury_transactions',
  'mercury_accounts',
  'account_balance_history',
  'merchant_mapping_cache',
  'categorization_rules'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Check 5: Verify indexes exist
SELECT
  tablename,
  indexname,
  'EXISTS ✓' as status
FROM pg_indexes
WHERE tablename IN (
  'mercury_connections',
  'mercury_sync_logs',
  'mercury_transactions',
  'mercury_accounts',
  'account_balance_history',
  'merchant_mapping_cache',
  'categorization_rules'
)
ORDER BY tablename, indexname;

-- Check 6: Verify column types for critical fields
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'mercury_sync_logs'
  AND column_name IN ('status', 'transactions_processed', 'transactions_failed', 'balances_updated', 'triggered_by')
ORDER BY table_name, ordinal_position;

-- Check 7: Verify foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  'EXISTS ✓' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'mercury_connections',
    'mercury_sync_logs',
    'mercury_transactions',
    'mercury_accounts',
    'account_balance_history',
    'merchant_mapping_cache',
    'categorization_rules'
  )
ORDER BY tc.table_name, kcu.column_name;
