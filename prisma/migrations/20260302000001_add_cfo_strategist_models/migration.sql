-- CreateEnum
CREATE TYPE "CfoRecommendationCategory" AS ENUM ('SUBSCRIPTION_OPTIMIZATION', 'STAFFING_EFFICIENCY', 'REVENUE_OPPORTUNITY', 'OVERHEAD_REDUCTION');

-- CreateEnum
CREATE TYPE "CfoRecommendationStatus" AS ENUM ('ACTIVE', 'ACTED_ON', 'DISMISSED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "CfoReportType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable: Add analyzer_thresholds JSONB column to Organization
ALTER TABLE "core_organizations" ADD COLUMN "analyzer_thresholds" JSONB;

-- CreateTable
CREATE TABLE "cfo_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "category" "CfoRecommendationCategory" NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_monthly_impact" DECIMAL(10,2) NOT NULL,
    "confidence_level" DECIMAL(3,2) NOT NULL,
    "supporting_data" JSONB NOT NULL DEFAULT '{}',
    "status" "CfoRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "dismissed_reason" TEXT,
    "dismissed_metric_snapshot" DECIMAL(10,2),
    "deferred_until" TIMESTAMP(3),
    "acted_on_at" TIMESTAMP(3),
    "acted_on_expected_savings" DECIMAL(10,2),
    "baseline_metric_value" DECIMAL(10,2),
    "realized_savings" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cfo_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfo_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "report_type" "CfoReportType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "margin_actual" DECIMAL(5,2) NOT NULL,
    "margin_target" DECIMAL(5,2) NOT NULL,
    "total_revenue" DECIMAL(10,2) NOT NULL,
    "total_expenses" DECIMAL(10,2) NOT NULL,
    "recommendations_count" INTEGER NOT NULL DEFAULT 0,
    "recommendations_acted_count" INTEGER NOT NULL DEFAULT 0,
    "total_potential_savings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "report_content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cfo_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cfo_recommendations_organization_id_status_idx" ON "cfo_recommendations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "cfo_recommendations_organization_id_category_idx" ON "cfo_recommendations"("organization_id", "category");

-- CreateIndex
CREATE INDEX "cfo_recommendations_deferred_until_idx" ON "cfo_recommendations"("deferred_until");

-- CreateIndex (composite unique for deduplication)
CREATE UNIQUE INDEX "cfo_recommendations_organization_id_category_target_entity_t_key" ON "cfo_recommendations"("organization_id", "category", "target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "cfo_reports_organization_id_report_type_idx" ON "cfo_reports"("organization_id", "report_type");

-- CreateIndex (unique per org/type/period)
CREATE UNIQUE INDEX "cfo_reports_organization_id_report_type_period_start_key" ON "cfo_reports"("organization_id", "report_type", "period_start");

-- AddForeignKey
ALTER TABLE "cfo_recommendations" ADD CONSTRAINT "cfo_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfo_reports" ADD CONSTRAINT "cfo_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
