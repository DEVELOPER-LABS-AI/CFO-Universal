-- Check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'expense_record_sync_status'::regtype
ORDER BY enumsortorder;
