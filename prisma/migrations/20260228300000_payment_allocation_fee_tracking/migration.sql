-- Payment Allocation & Fee Tracking Migration
-- Adds PaymentAllocation, PaymentMethodFeeDefault models,
-- enhances ClientCashReceipt with fee fields,
-- adds service coverage settings to Organization,
-- adds other_costs to ClientROI.

-- 1. Extend PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHECK';

-- 2. Extend NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SERVICE_COVERAGE_WARNING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SERVICE_COVERAGE_PAST_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SERVICE_COVERAGE_SUSPENDED';

-- 3. Add fee tracking fields to ClientCashReceipt
ALTER TABLE "client_cash_receipts"
  ADD COLUMN "gross_amount" DECIMAL(10, 2),
  ADD COLUMN "fee_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "fee_percentage" DECIMAL(5, 4),
  ADD COLUMN "payment_method" "PaymentMethod",
  ADD COLUMN "notes" TEXT;

-- 4. Add other_costs to ClientROI
ALTER TABLE "client_roi"
  ADD COLUMN "other_costs" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- 5. Add service coverage settings to Organization
ALTER TABLE "core_organizations"
  ADD COLUMN "service_grace_period_days" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "service_warning_days" INTEGER NOT NULL DEFAULT 7;

-- 6. Create PaymentAllocation table
CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "client_cash_receipt_id" TEXT NOT NULL,
  "service_id" TEXT,
  "period_month" INTEGER NOT NULL,
  "period_year" INTEGER NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_client_cash_receipt_id_idx" ON "payment_allocations"("client_cash_receipt_id");
CREATE INDEX "payment_allocations_period_year_period_month_idx" ON "payment_allocations"("period_year", "period_month");
CREATE INDEX "payment_allocations_service_id_idx" ON "payment_allocations"("service_id");

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_client_cash_receipt_id_fkey"
    FOREIGN KEY ("client_cash_receipt_id") REFERENCES "client_cash_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Create PaymentMethodFeeDefault table
CREATE TABLE "payment_method_fee_defaults" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" TEXT NOT NULL,
  "payment_method" "PaymentMethod" NOT NULL,
  "fee_percentage" DECIMAL(5, 4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_method_fee_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_method_fee_defaults_organization_id_payment_method_key"
  ON "payment_method_fee_defaults"("organization_id", "payment_method");
CREATE INDEX "payment_method_fee_defaults_organization_id_idx"
  ON "payment_method_fee_defaults"("organization_id");

ALTER TABLE "payment_method_fee_defaults"
  ADD CONSTRAINT "payment_method_fee_defaults_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Backfill: Create one PaymentAllocation per existing ClientCashReceipt
INSERT INTO "payment_allocations" ("id", "client_cash_receipt_id", "period_month", "period_year", "amount", "description", "sort_order", "created_at")
SELECT
  gen_random_uuid(),
  "id",
  "period_month",
  "period_year",
  "amount",
  'Migrated from legacy receipt',
  0,
  NOW()
FROM "client_cash_receipts";
