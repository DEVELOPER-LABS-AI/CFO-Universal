-- Backfill: Re-categorize existing internal transfer records as TRANSFER
-- Matches Mercury checking/savings/credit/treasury transfers and known transfer patterns
-- Note: Only sets columns that exist in the migration chain. Additional nullable FK columns
-- (subscription_id, expense_category_id, staff_id, categorization_rule_id) may exist on
-- the production table but are not part of the tracked migration schema.

UPDATE "financial_expense_records"
SET
  category = 'TRANSFER',
  categorization_confidence = 1.0,
  contractor_id = NULL,
  agency_id = NULL,
  updated_at = NOW()
WHERE
  mercury_transaction_id IS NOT NULL
  AND category != 'TRANSFER'
  AND (
    LOWER(merchant_name) LIKE 'mercury checking%'
    OR LOWER(merchant_name) LIKE 'mercury savings%'
    OR LOWER(merchant_name) LIKE 'mercury credit%'
    OR LOWER(merchant_name) LIKE 'mercury treasury%'
    OR LOWER(merchant_name) LIKE '%internal transfer%'
    OR LOWER(merchant_name) LIKE 'chase - checking%'
    OR LOWER(merchant_name) LIKE 'chase - savings%'
  );
