-- Find the correct table names
-- Run this in Supabase SQL Editor

-- Step 1: List all tables to find user/organization tables
SELECT 
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE '%user%' 
    OR table_name LIKE '%org%'
    OR table_name LIKE '%client%'
  )
ORDER BY table_name;

-- Step 2: Check auth.users table
SELECT id, email FROM auth.users LIMIT 5;

-- Step 3: Once you find the correct table name, check its structure
-- (Replace 'table_name' with actual table from Step 1)
/*
\d user_organizations
*/
