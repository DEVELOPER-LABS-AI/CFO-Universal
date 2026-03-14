-- ============================================================================
-- Verification Script for Xero Integration Schema
-- ============================================================================
-- Run this in Supabase SQL Editor to verify the installation
-- ============================================================================

-- Check if all Xero enums exist
SELECT
    'Enums' as check_type,
    typname as name,
    'EXISTS' as status
FROM pg_type
WHERE typname IN (
    'ConnectionStatus',
    'XeroSyncStatus',
    'SyncType',
    'SyncJobStatus',
    'SyncTrigger',
    'MappingType',
    'ExpenseType',
    'RevenueSyncStatus',
    'ExpenseSyncStatus'
)
ORDER BY typname;

-- Check if all Xero tables exist
SELECT
    'Tables' as check_type,
    tablename as name,
    'EXISTS' as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'xero_connections',
    'xero_sync_logs',
    'xero_contact_mappings',
    'xero_expense_category_mappings'
)
ORDER BY tablename;

-- Check if RLS is enabled on Xero tables
SELECT
    'RLS Status' as check_type,
    tablename as name,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables t
JOIN pg_class c ON t.tablename = c.relname
WHERE t.schemaname = 'public'
AND t.tablename IN (
    'xero_connections',
    'xero_sync_logs',
    'xero_contact_mappings',
    'xero_expense_category_mappings'
)
ORDER BY t.tablename;

-- Check if helper function exists
SELECT
    'Functions' as check_type,
    proname as name,
    'EXISTS' as status
FROM pg_proc
WHERE proname = 'get_user_organization_id';

-- Check RLS policies count
SELECT
    'RLS Policies' as check_type,
    tablename as name,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'xero_connections',
    'xero_sync_logs',
    'xero_contact_mappings',
    'xero_expense_category_mappings',
    'financial_revenue_records',
    'financial_expense_records'
)
GROUP BY tablename
ORDER BY tablename;

-- Check if Xero fields exist on revenue/expense records
SELECT
    'Revenue Fields' as check_type,
    column_name as name,
    data_type as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'financial_revenue_records'
AND column_name IN ('xero_invoice_id', 'xero_invoice_number', 'revenue_sync_status', 'last_synced_at')
ORDER BY column_name;

SELECT
    'Expense Fields' as check_type,
    column_name as name,
    data_type as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'financial_expense_records'
AND column_name IN ('xero_expense_id', 'xero_account_code', 'expense_sync_status', 'last_synced_at')
ORDER BY column_name;
