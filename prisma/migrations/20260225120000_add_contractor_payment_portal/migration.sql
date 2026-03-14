-- CreateEnum
CREATE TYPE "ContractorLineItemType" AS ENUM ('REIMBURSEMENT', 'BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractorDocumentType" AS ENUM ('SOW', 'INVOICE', 'TAX_FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ACH', 'DOMESTIC_WIRE', 'INTERNATIONAL_WIRE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PortalInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTRACTOR';

-- AlterTable
ALTER TABLE "core_contractors" ADD COLUMN     "email" TEXT,
ADD COLUMN     "last_reminder_month" INTEGER,
ADD COLUMN     "last_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "last_reminder_year" INTEGER,
ADD COLUMN     "manual_reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mercury_recipient_id" TEXT,
ADD COLUMN     "portal_invitation_status" "PortalInvitationStatus",
ADD COLUMN     "reminder_day_override" INTEGER,
ADD COLUMN     "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "required_doc_types" JSONB;

-- AlterTable
ALTER TABLE "core_organizations" ADD COLUMN     "contractor_default_doc_types" JSONB,
ADD COLUMN     "contractor_reminder_day" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "contractor_id" TEXT;

-- CreateTable
CREATE TABLE "contractor_invoices" (
    "id" UUID NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "rejection_reason" TEXT,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" "ContractorLineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_documents" (
    "id" UUID NOT NULL,
    "invoice_id" UUID,
    "contractor_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_type" "ContractorDocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "mercury_request_id" TEXT,
    "mercury_transaction_id" TEXT,
    "payment_method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "initiated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_invoices_organization_id_idx" ON "contractor_invoices"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_invoices_status_idx" ON "contractor_invoices"("status");

-- CreateIndex
CREATE INDEX "contractor_invoices_contractor_id_idx" ON "contractor_invoices"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_invoices_contractor_id_month_year_key" ON "contractor_invoices"("contractor_id", "month", "year");

-- CreateIndex
CREATE INDEX "contractor_invoice_line_items_invoice_id_idx" ON "contractor_invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "contractor_documents_invoice_id_idx" ON "contractor_documents"("invoice_id");

-- CreateIndex
CREATE INDEX "contractor_documents_contractor_id_idx" ON "contractor_documents"("contractor_id");

-- CreateIndex
CREATE INDEX "contractor_documents_organization_id_idx" ON "contractor_documents"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_payments_invoice_id_key" ON "contractor_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "contractor_payments_contractor_id_idx" ON "contractor_payments"("contractor_id");

-- CreateIndex
CREATE INDEX "contractor_payments_organization_id_idx" ON "contractor_payments"("organization_id");

-- CreateIndex
CREATE INDEX "contractor_payments_status_idx" ON "contractor_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_contractor_id_key" ON "user_profiles"("contractor_id");

-- CreateIndex
CREATE INDEX "user_profiles_contractor_id_idx" ON "user_profiles"("contractor_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoice_line_items" ADD CONSTRAINT "contractor_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_documents" ADD CONSTRAINT "contractor_documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_documents" ADD CONSTRAINT "contractor_documents_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_documents" ADD CONSTRAINT "contractor_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_payments" ADD CONSTRAINT "contractor_payments_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

