-- CreateTable: owner_monthly_pay
CREATE TABLE "owner_monthly_pay" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "expected_amount" DECIMAL(10,2) NOT NULL,
    "actual_amount" DECIMAL(10,2) NOT NULL,
    "shortfall" DECIMAL(10,2) NOT NULL,
    "cumulative_deferred" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_monthly_pay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_monthly_pay_staff_id_month_year_key" ON "owner_monthly_pay"("staff_id", "month", "year");

-- CreateIndex
CREATE INDEX "owner_monthly_pay_organization_id_year_month_idx" ON "owner_monthly_pay"("organization_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "owner_monthly_pay_staff_id_year_month_idx" ON "owner_monthly_pay"("staff_id", "year", "month" DESC);

-- AddForeignKey
ALTER TABLE "owner_monthly_pay" ADD CONSTRAINT "owner_monthly_pay_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_monthly_pay" ADD CONSTRAINT "owner_monthly_pay_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add staff_id to merchant_mapping_cache
ALTER TABLE "merchant_mapping_cache" ADD COLUMN "staff_id" TEXT;

-- CreateIndex
CREATE INDEX "merchant_mapping_cache_staff_id_idx" ON "merchant_mapping_cache"("staff_id");

-- AddForeignKey
ALTER TABLE "merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
