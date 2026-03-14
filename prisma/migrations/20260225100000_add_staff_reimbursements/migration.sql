-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "ReimbursementType" AS ENUM ('TRAVEL', 'MEALS', 'SUPPLIES', 'EQUIPMENT', 'SOFTWARE', 'PROFESSIONAL_DEV', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum (idempotent)
DO $$ BEGIN
  ALTER TYPE "InvoiceLineItemType" ADD VALUE IF NOT EXISTS 'REIMBURSEMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_reimbursements" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "reimbursement_type" "ReimbursementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "receipt_url" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_reimbursements_pkey" PRIMARY KEY ("id")
);

-- AlterTable (idempotent)
DO $$ BEGIN
  ALTER TABLE "agency_invoice_line_items" ADD COLUMN "reimbursement_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "staff_reimbursements_staff_id_year_month_idx" ON "staff_reimbursements"("staff_id", "year", "month" DESC);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "staff_reimbursements_is_approved_idx" ON "staff_reimbursements"("is_approved");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "staff_reimbursements_is_paid_idx" ON "staff_reimbursements"("is_paid");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "staff_reimbursements" ADD CONSTRAINT "staff_reimbursements_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
