-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('BDR', 'ADMIN', 'CONTRACTOR', 'AGENCY_STAFF');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('SEAT_BASED', 'PERCENTAGE_BASED');

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "name" TEXT NOT NULL,
    "staff_type" "StaffType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "total_seats" INTEGER,
    "billing_frequency" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_allocations" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "client_id" TEXT,
    "staff_id" TEXT,
    "allocation_type" "AllocationType" NOT NULL,
    "seats_allocated" INTEGER,
    "percentage_allocated" DECIMAL(5,2),
    "cost_allocated" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_payment" DECIMAL(10,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_monthly_breakdowns" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "breakdown_total" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_monthly_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdr_productivity_metrics" (
    "id" TEXT NOT NULL,
    "bdr_id" TEXT NOT NULL,
    "client_id" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "meetings_attended" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bdr_productivity_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_roi" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "total_costs" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "roi_percentage" DECIMAL(8,2) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bdr_costs" DECIMAL(10,2) NOT NULL,
    "contractor_costs" DECIMAL(10,2) NOT NULL,
    "subscription_costs" DECIMAL(10,2) NOT NULL,
    "service_costs" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "client_roi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdr_roi" (
    "id" TEXT NOT NULL,
    "bdr_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "revenue_attributed" DECIMAL(10,2) NOT NULL,
    "bdr_cost" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "roi_percentage" DECIMAL(8,2) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL,
    "meetings_attended_total" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bdr_roi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_organization_id_idx" ON "staff"("organization_id");

-- CreateIndex
CREATE INDEX "staff_organization_id_staff_type_idx" ON "staff"("organization_id", "staff_type");

-- CreateIndex
CREATE INDEX "staff_agency_id_idx" ON "staff"("agency_id");

-- CreateIndex
CREATE INDEX "staff_assignments_staff_id_idx" ON "staff_assignments"("staff_id");

-- CreateIndex
CREATE INDEX "staff_assignments_client_id_idx" ON "staff_assignments"("client_id");

-- CreateIndex
CREATE INDEX "staff_assignments_staff_id_client_id_idx" ON "staff_assignments"("staff_id", "client_id");

-- CreateIndex
CREATE INDEX "staff_assignments_start_date_end_date_idx" ON "staff_assignments"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_is_active_idx" ON "subscriptions"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "subscription_allocations_subscription_id_idx" ON "subscription_allocations"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_allocations_client_id_idx" ON "subscription_allocations"("client_id");

-- CreateIndex
CREATE INDEX "subscription_allocations_staff_id_idx" ON "subscription_allocations"("staff_id");

-- CreateIndex
CREATE INDEX "agencies_organization_id_idx" ON "agencies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "agency_monthly_breakdowns_agency_id_month_year_key" ON "agency_monthly_breakdowns"("agency_id", "month", "year");

-- CreateIndex
CREATE INDEX "agency_monthly_breakdowns_agency_id_year_month_idx" ON "agency_monthly_breakdowns"("agency_id", "year", "month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bdr_productivity_metrics_bdr_id_client_id_month_year_key" ON "bdr_productivity_metrics"("bdr_id", "client_id", "month", "year");

-- CreateIndex
CREATE INDEX "bdr_productivity_metrics_bdr_id_year_month_idx" ON "bdr_productivity_metrics"("bdr_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "bdr_productivity_metrics_client_id_year_month_idx" ON "bdr_productivity_metrics"("client_id", "year", "month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "client_roi_client_id_month_year_key" ON "client_roi"("client_id", "month", "year");

-- CreateIndex
CREATE INDEX "client_roi_client_id_year_month_idx" ON "client_roi"("client_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "client_roi_margin_percentage_idx" ON "client_roi"("margin_percentage");

-- CreateIndex
CREATE INDEX "client_roi_roi_percentage_idx" ON "client_roi"("roi_percentage");

-- CreateIndex
CREATE UNIQUE INDEX "bdr_roi_bdr_id_month_year_key" ON "bdr_roi"("bdr_id", "month", "year");

-- CreateIndex
CREATE INDEX "bdr_roi_bdr_id_year_month_idx" ON "bdr_roi"("bdr_id", "year", "month" DESC);

-- CreateIndex
CREATE INDEX "bdr_roi_roi_percentage_idx" ON "bdr_roi"("roi_percentage");

-- CreateIndex
CREATE INDEX "bdr_roi_margin_percentage_idx" ON "bdr_roi"("margin_percentage");

-- CreateIndex (additional index on Client for name search)
CREATE INDEX "core_clients_organization_id_name_idx" ON "core_clients"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_allocations" ADD CONSTRAINT "subscription_allocations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_monthly_breakdowns" ADD CONSTRAINT "agency_monthly_breakdowns_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_productivity_metrics" ADD CONSTRAINT "bdr_productivity_metrics_bdr_id_fkey" FOREIGN KEY ("bdr_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_productivity_metrics" ADD CONSTRAINT "bdr_productivity_metrics_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_roi" ADD CONSTRAINT "client_roi_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bdr_roi" ADD CONSTRAINT "bdr_roi_bdr_id_fkey" FOREIGN KEY ("bdr_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add GIN index for JSONB agency breakdown (from R5 research)
CREATE INDEX idx_breakdown_staff ON agency_monthly_breakdowns USING GIN ((breakdown -> 'staff') jsonb_path_ops);
