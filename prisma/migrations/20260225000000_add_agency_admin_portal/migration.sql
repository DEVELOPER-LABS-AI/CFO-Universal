-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "InvoiceLineItemType" AS ENUM ('STAFF_COST', 'BONUS', 'SERVICE', 'CUSTOM');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENCY_ADMIN';

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "agency_id" TEXT;

-- CreateTable
CREATE TABLE "agency_invoices" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" "InvoiceLineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "staff_id" TEXT,
    "bonus_id" TEXT,
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_invoice_comments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_invoice_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_invoices_agency_id_year_month_idx" ON "agency_invoices"("agency_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "agency_invoices_status_idx" ON "agency_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_invoices_agency_id_month_year_key" ON "agency_invoices"("agency_id", "month", "year");

-- CreateIndex
CREATE INDEX "agency_invoice_line_items_invoice_id_idx" ON "agency_invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "agency_invoice_line_items_type_idx" ON "agency_invoice_line_items"("type");

-- CreateIndex
CREATE INDEX "agency_invoice_comments_invoice_id_idx" ON "agency_invoice_comments"("invoice_id");

-- CreateIndex
CREATE INDEX "user_profiles_agency_id_idx" ON "user_profiles"("agency_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invoices" ADD CONSTRAINT "agency_invoices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invoice_line_items" ADD CONSTRAINT "agency_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "agency_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invoice_comments" ADD CONSTRAINT "agency_invoice_comments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "agency_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
