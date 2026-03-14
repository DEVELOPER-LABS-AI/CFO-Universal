SELECT 
  id,
  organization_id,
  connection_status,
  created_at,
  updated_at,
  deleted_at
FROM mercury_connections
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
