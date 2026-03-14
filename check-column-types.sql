-- Check what enum type the mercury_connections.connection_status column uses
SELECT 
  table_name,
  column_name,
  udt_name as enum_type_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('mercury_connections', 'financial_expense_records')
  AND column_name IN ('connection_status', 'mercury_sync_status')
ORDER BY table_name, column_name;
