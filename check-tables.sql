-- Check if mercury_connections table exists
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'mercury_connections'
ORDER BY ordinal_position;

-- If empty, the table was dropped by CASCADE
-- You'll need to recreate it
