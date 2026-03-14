-- Add vendor_expense_categories table for custom expense categorization
CREATE TABLE "vendor_expense_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vendor_expense_categories_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one category name per organization
CREATE UNIQUE INDEX "vendor_expense_categories_organization_id_name_key" ON "vendor_expense_categories"("organization_id", "name");

-- Index for organization lookups
CREATE INDEX "vendor_expense_categories_organization_id_idx" ON "vendor_expense_categories"("organization_id");

-- Add expense_category_id to merchant_mapping_cache
ALTER TABLE "merchant_mapping_cache" ADD COLUMN "expense_category_id" TEXT;

-- Index for expense_category_id lookups
CREATE INDEX "merchant_mapping_cache_expense_category_id_idx" ON "merchant_mapping_cache"("expense_category_id");

-- Foreign key constraints
ALTER TABLE "vendor_expense_categories" ADD CONSTRAINT "vendor_expense_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "vendor_expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
