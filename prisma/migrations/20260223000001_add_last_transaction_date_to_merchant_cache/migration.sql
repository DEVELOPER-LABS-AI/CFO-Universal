-- Add last_transaction_date to merchant_mapping_cache
-- Tracks the actual date of the most recent transaction for each merchant
ALTER TABLE "merchant_mapping_cache" ADD COLUMN "last_transaction_date" TIMESTAMP;

-- Add index for sorting by transaction date
CREATE INDEX "merchant_mapping_cache_last_transaction_date_idx" ON "merchant_mapping_cache"("last_transaction_date");

-- Backfill last_transaction_date from existing expense records
UPDATE merchant_mapping_cache mc
SET last_transaction_date = sub.max_date
FROM (
  SELECT merchant_name, MAX(transaction_date) AS max_date
  FROM financial_expense_records
  WHERE merchant_name IS NOT NULL
  GROUP BY merchant_name
) sub
WHERE mc.mercury_merchant_name = sub.merchant_name;
