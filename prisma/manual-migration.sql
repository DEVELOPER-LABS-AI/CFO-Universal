-- ============================================================================
-- DevLabs CFO - Manual Database Migration
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to create the complete database schema
-- Generated from: prisma/schema.prisma
-- Date: 2026-02-12
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CHURNED');
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY');
CREATE TYPE "EngagementType" AS ENUM ('FULL_TIME', 'PART_TIME', 'PROJECT');
CREATE TYPE "RevenueStatus" AS ENUM ('INVOICED', 'RECEIVED');
CREATE TYPE "SyncSource" AS ENUM ('XERO', 'MERCURY', 'MANUAL', 'IMPORT');
CREATE TYPE "ExpenseCategory" AS ENUM ('CONTRACTOR_COST', 'SUBSCRIPTION', 'TOOLS', 'PAYROLL', 'OVERHEAD', 'MARKETING', 'OTHER');
CREATE TYPE "OAuthProvider" AS ENUM ('XERO', 'SLACK', 'MERCURY');
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "TargetScope" AS ENUM ('GLOBAL', 'SERVICE', 'CLIENT');

-- ============================================================================
-- STEP 2: CREATE CORE SCHEMA TABLES
-- ============================================================================

-- Organizations Table
CREATE TABLE "core_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_organizations_pkey" PRIMARY KEY ("id")
);

-- Clients Table
CREATE TABLE "core_clients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "relationship_type" TEXT,
    "custom_margin_target" DECIMAL(5,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "churn_date" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_clients_pkey" PRIMARY KEY ("id")
);

-- Services Table
CREATE TABLE "core_services" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standard_rate" DECIMAL(10,2) NOT NULL,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_services_pkey" PRIMARY KEY ("id")
);

-- Contractors Table
CREATE TABLE "core_contractors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_contractors_pkey" PRIMARY KEY ("id")
);

-- Contractor Assignments Table
CREATE TABLE "core_contractor_assignments" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "allocation_percentage" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_contractor_assignments_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 3: CREATE FINANCIAL SCHEMA TABLES
-- ============================================================================

-- Revenue Records Table
CREATE TABLE "financial_revenue_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "status" "RevenueStatus" NOT NULL,
    "description" TEXT,
    "external_id" TEXT,
    "sync_source" "SyncSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_revenue_records_pkey" PRIMARY KEY ("id")
);

-- Expense Records Table
CREATE TABLE "financial_expense_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "contractor_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "external_id" TEXT,
    "sync_source" "SyncSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_expense_records_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 4: CREATE ANALYTICS SCHEMA TABLES
-- ============================================================================

-- Client Metrics Table
CREATE TABLE "analytics_client_metrics" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_revenue" DECIMAL(10,2) NOT NULL,
    "total_costs" DECIMAL(10,2) NOT NULL,
    "actual_margin" DECIMAL(5,2) NOT NULL,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "tier_classification" SMALLINT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_client_metrics_pkey" PRIMARY KEY ("id")
);

-- Company Metrics Table
CREATE TABLE "analytics_company_metrics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "portfolio_margin" DECIMAL(5,2) NOT NULL,
    "total_revenue" DECIMAL(10,2) NOT NULL,
    "total_expenses" DECIMAL(10,2) NOT NULL,
    "client_count" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_company_metrics_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 5: CREATE INTEGRATIONS SCHEMA TABLES
-- ============================================================================

-- OAuth Tokens Table
CREATE TABLE "integrations_oauth_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- Sync Logs Table
CREATE TABLE "integrations_sync_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_type" TEXT NOT NULL,
    "sync_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_completed_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_sync_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 6: CREATE SYSTEM SCHEMA TABLES
-- ============================================================================

-- Financial Targets Table
CREATE TABLE "system_financial_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "scope_id" TEXT,
    "target_margin" DECIMAL(5,2) NOT NULL,
    "target_revenue" DECIMAL(10,2),
    "fiscal_period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_financial_targets_pkey" PRIMARY KEY ("id")
);

-- Growth Scenarios Table
CREATE TABLE "system_growth_scenarios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "projected_revenue" DECIMAL(10,2) NOT NULL,
    "projected_margin" DECIMAL(5,2) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_growth_scenarios_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 7: CREATE UNIQUE CONSTRAINTS
-- ============================================================================

CREATE UNIQUE INDEX "core_organizations_name_key" ON "core_organizations"("name");
CREATE UNIQUE INDEX "integrations_oauth_tokens_organization_id_provider_key" ON "integrations_oauth_tokens"("organization_id", "provider");

-- ============================================================================
-- STEP 8: CREATE INDEXES
-- ============================================================================

-- Core Schema Indexes
CREATE INDEX "core_clients_organization_id_idx" ON "core_clients"("organization_id");
CREATE INDEX "core_clients_status_idx" ON "core_clients"("status");
CREATE INDEX "core_clients_deleted_at_idx" ON "core_clients"("deleted_at");

CREATE INDEX "core_services_organization_id_idx" ON "core_services"("organization_id");
CREATE INDEX "core_services_is_active_idx" ON "core_services"("is_active");

CREATE INDEX "core_contractors_organization_id_idx" ON "core_contractors"("organization_id");
CREATE INDEX "core_contractors_deleted_at_idx" ON "core_contractors"("deleted_at");

CREATE INDEX "core_contractor_assignments_contractor_id_idx" ON "core_contractor_assignments"("contractor_id");
CREATE INDEX "core_contractor_assignments_client_id_idx" ON "core_contractor_assignments"("client_id");
CREATE INDEX "core_contractor_assignments_start_date_end_date_idx" ON "core_contractor_assignments"("start_date", "end_date");

-- Financial Schema Indexes
CREATE INDEX "financial_revenue_records_organization_id_idx" ON "financial_revenue_records"("organization_id");
CREATE INDEX "financial_revenue_records_client_id_idx" ON "financial_revenue_records"("client_id");
CREATE INDEX "financial_revenue_records_transaction_date_idx" ON "financial_revenue_records"("transaction_date");
CREATE INDEX "financial_revenue_records_sync_source_external_id_idx" ON "financial_revenue_records"("sync_source", "external_id");

CREATE INDEX "financial_expense_records_organization_id_idx" ON "financial_expense_records"("organization_id");
CREATE INDEX "financial_expense_records_client_id_idx" ON "financial_expense_records"("client_id");
CREATE INDEX "financial_expense_records_contractor_id_idx" ON "financial_expense_records"("contractor_id");
CREATE INDEX "financial_expense_records_transaction_date_idx" ON "financial_expense_records"("transaction_date");
CREATE INDEX "financial_expense_records_category_idx" ON "financial_expense_records"("category");

-- Analytics Schema Indexes
CREATE INDEX "analytics_client_metrics_client_id_idx" ON "analytics_client_metrics"("client_id");
CREATE INDEX "analytics_client_metrics_period_start_period_end_idx" ON "analytics_client_metrics"("period_start", "period_end");
CREATE INDEX "analytics_client_metrics_tier_classification_idx" ON "analytics_client_metrics"("tier_classification");

CREATE INDEX "analytics_company_metrics_organization_id_idx" ON "analytics_company_metrics"("organization_id");
CREATE INDEX "analytics_company_metrics_period_start_period_end_idx" ON "analytics_company_metrics"("period_start", "period_end");

-- Integrations Schema Indexes
CREATE INDEX "integrations_oauth_tokens_expires_at_idx" ON "integrations_oauth_tokens"("expires_at");

CREATE INDEX "integrations_sync_logs_organization_id_idx" ON "integrations_sync_logs"("organization_id");
CREATE INDEX "integrations_sync_logs_integration_type_idx" ON "integrations_sync_logs"("integration_type");
CREATE INDEX "integrations_sync_logs_sync_started_at_idx" ON "integrations_sync_logs"("sync_started_at");
CREATE INDEX "integrations_sync_logs_status_idx" ON "integrations_sync_logs"("status");

-- System Schema Indexes
CREATE INDEX "system_financial_targets_organization_id_idx" ON "system_financial_targets"("organization_id");
CREATE INDEX "system_financial_targets_scope_scope_id_idx" ON "system_financial_targets"("scope", "scope_id");
CREATE INDEX "system_financial_targets_fiscal_period_idx" ON "system_financial_targets"("fiscal_period");

CREATE INDEX "system_growth_scenarios_organization_id_idx" ON "system_growth_scenarios"("organization_id");
CREATE INDEX "system_growth_scenarios_created_at_idx" ON "system_growth_scenarios"("created_at");

-- ============================================================================
-- STEP 9: ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Core Schema Foreign Keys
ALTER TABLE "core_clients" ADD CONSTRAINT "core_clients_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_services" ADD CONSTRAINT "core_services_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_contractors" ADD CONSTRAINT "core_contractors_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core_contractor_assignments" ADD CONSTRAINT "core_contractor_assignments_contractor_id_fkey"
    FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core_contractor_assignments" ADD CONSTRAINT "core_contractor_assignments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Financial Schema Foreign Keys
ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_revenue_records" ADD CONSTRAINT "financial_revenue_records_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "core_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_expense_records" ADD CONSTRAINT "financial_expense_records_contractor_id_fkey"
    FOREIGN KEY ("contractor_id") REFERENCES "core_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Analytics Schema Foreign Keys
ALTER TABLE "analytics_client_metrics" ADD CONSTRAINT "analytics_client_metrics_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "core_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "analytics_company_metrics" ADD CONSTRAINT "analytics_company_metrics_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrations Schema Foreign Keys
ALTER TABLE "integrations_oauth_tokens" ADD CONSTRAINT "integrations_oauth_tokens_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "integrations_sync_logs" ADD CONSTRAINT "integrations_sync_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- System Schema Foreign Keys
ALTER TABLE "system_financial_targets" ADD CONSTRAINT "system_financial_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "system_growth_scenarios" ADD CONSTRAINT "system_growth_scenarios_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary:
-- - 9 ENUMs created
-- - 13 tables created
-- - 2 unique constraints
-- - 30+ indexes
-- - 16 foreign key constraints
--
-- Next steps:
-- 1. Apply RLS policies: Run prisma/rls-policies.sql
-- 2. Verify schema: SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- 3. Seed test data: npm run db:seed
--
-- ============================================================================
