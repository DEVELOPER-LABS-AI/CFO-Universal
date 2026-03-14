-- Feature 10: Project Resource Allocation & Cost Tracking
-- Creates Project, ProjectCostAllocation, and ProjectCostSnapshot tables

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'SUNSET', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CostSourceType" AS ENUM ('STAFF', 'CONTRACTOR', 'SUBSCRIPTION', 'OTHER');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "client_id" TEXT,
    "budget_target" DECIMAL(12,2),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_cost_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "cost_source_type" "CostSourceType" NOT NULL,
    "cost_source_id" TEXT NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "fixed_amount" DECIMAL(12,2),
    "effective_start_date" DATE NOT NULL,
    "effective_end_date" DATE,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_cost_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "subscription_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "staff_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "contractor_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_costs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roi" DECIMAL(8,4),
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "project_cost_allocations_project_id_idx" ON "project_cost_allocations"("project_id");
CREATE INDEX "project_cost_allocations_cost_source_type_cost_source_id_idx" ON "project_cost_allocations"("cost_source_type", "cost_source_id");
CREATE INDEX "project_cost_allocations_effective_start_date_effective_end_idx" ON "project_cost_allocations"("effective_start_date", "effective_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "project_cost_snapshots_project_id_period_month_period_year_key" ON "project_cost_snapshots"("project_id", "period_month", "period_year");
CREATE INDEX "project_cost_snapshots_period_year_period_month_idx" ON "project_cost_snapshots"("period_year", "period_month");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_cost_allocations" ADD CONSTRAINT "project_cost_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_cost_snapshots" ADD CONSTRAINT "project_cost_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
