-- Migration: agency-mercury-linking
-- Adds Mercury transaction linking to agencies and expands AgencyMonthlyBreakdown
-- to support itemized staff (base_pay + expenses + reimbursements) and service line items.

-- 1. Agency: make monthly_payment optional (budget target), add merchant_name for auto-matching
ALTER TABLE "agencies"
  ALTER COLUMN "monthly_payment" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "merchant_name" TEXT;

-- 2. ExpenseRecord: add agency_id field for linking Mercury transactions to an agency
ALTER TABLE "financial_expense_records"
  ADD COLUMN IF NOT EXISTS "agency_id" TEXT;

-- Index for agency_id on expense records
CREATE INDEX IF NOT EXISTS "financial_expense_records_agency_id_idx"
  ON "financial_expense_records" ("agency_id");

-- Foreign key: expense records → agencies
ALTER TABLE "financial_expense_records"
  ADD CONSTRAINT "financial_expense_records_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "agencies" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. MerchantMappingCache: add agency_id (mutually exclusive with contractor_id)
ALTER TABLE "merchant_mapping_cache"
  ADD COLUMN IF NOT EXISTS "agency_id" TEXT;

-- Index for agency_id on merchant mapping cache
CREATE INDEX IF NOT EXISTS "merchant_mapping_cache_agency_id_idx"
  ON "merchant_mapping_cache" ("agency_id");

-- 4. AgencyMonthlyBreakdown: add mercury_actual for reconciliation
--    variance now = breakdown_total - mercury_actual (itemized vs actual paid)
ALTER TABLE "agency_monthly_breakdowns"
  ADD COLUMN IF NOT EXISTS "mercury_actual" DECIMAL(10, 2),
  ALTER COLUMN "variance" DROP NOT NULL;

-- Allow variance to be null until mercury_actual is populated
UPDATE "agency_monthly_breakdowns"
  SET "variance" = COALESCE("variance", 0)
  WHERE "variance" IS NULL;

ALTER TABLE "agency_monthly_breakdowns"
  ALTER COLUMN "variance" SET NOT NULL,
  ALTER COLUMN "variance" SET DEFAULT 0;
