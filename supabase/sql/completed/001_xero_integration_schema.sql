-- ============================================================================
-- Xero Integration Database Schema
-- ============================================================================
-- This migration creates all tables and enums required for the Xero OAuth 2.0
-- integration and automated data synchronization.
--
-- IMPORTANT: Run this script manually in Supabase SQL Editor
-- ============================================================================

-- Create Xero Integration Enums
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'TOKEN_EXPIRED', 'ERROR');
CREATE TYPE "XeroSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE "SyncType" AS ENUM ('INVOICES', 'EXPENSES', 'CONTACTS', 'FULL');
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY');
CREATE TYPE "MappingType" AS ENUM ('EMAIL_EXACT', 'NAME_EXACT', 'NAME_FUZZY', 'MANUAL');
CREATE TYPE "ExpenseType" AS ENUM ('CONTRACTOR', 'SUBSCRIPTION', 'OVERHEAD', 'OTHER');
CREATE TYPE "RevenueSyncStatus" AS ENUM ('SYNCED', 'MAPPING_FAILED', 'VALIDATION_FAILED', 'MANUAL');
CREATE TYPE "ExpenseSyncStatus" AS ENUM ('SYNCED', 'CATEGORIZATION_FAILED', 'VALIDATION_FAILED', 'MANUAL');

-- ============================================================================
-- Table: xero_connections
-- Purpose: Store encrypted OAuth tokens and connection metadata for Xero
-- ============================================================================
CREATE TABLE IF NOT EXISTS "xero_connections" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "organization_id" TEXT NOT NULL UNIQUE REFERENCES "core_organizations"("id") ON DELETE CASCADE,
    "xero_tenant_id" VARCHAR(255) NOT NULL UNIQUE,
    "access_token" TEXT NOT NULL, -- Encrypted
    "refresh_token" TEXT NOT NULL, -- Encrypted
    "token_expiry" TIMESTAMP NOT NULL,
    "scopes_granted" TEXT[] NOT NULL,
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP,
    "last_sync_status" "XeroSyncStatus",
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "chk_token_expiry" CHECK ("token_expiry" > "created_at")
);

CREATE INDEX "idx_xero_connections_org_id" ON "xero_connections"("organization_id");
CREATE INDEX "idx_xero_connections_status" ON "xero_connections"("connection_status");
CREATE INDEX "idx_xero_connections_tenant_id" ON "xero_connections"("xero_tenant_id");

-- ============================================================================
-- Table: xero_sync_logs
-- Purpose: Track all sync job executions with status, counts, and errors
-- ============================================================================
CREATE TABLE IF NOT EXISTS "xero_sync_logs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connection_id" UUID NOT NULL REFERENCES "xero_connections"("id") ON DELETE CASCADE,
    "sync_type" "SyncType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMP,
    "duration_ms" INTEGER,
    "invoices_processed" INTEGER NOT NULL DEFAULT 0,
    "invoices_failed" INTEGER NOT NULL DEFAULT 0,
    "expenses_processed" INTEGER NOT NULL DEFAULT 0,
    "expenses_failed" INTEGER NOT NULL DEFAULT 0,
    "contacts_mapped" INTEGER NOT NULL DEFAULT 0,
    "contacts_unmapped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "triggered_by" "SyncTrigger" NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "chk_completed_at" CHECK ("completed_at" IS NULL OR "completed_at" >= "started_at"),
    CONSTRAINT "chk_duration_ms" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0),
    CONSTRAINT "chk_counts_positive" CHECK (
        "invoices_processed" >= 0 AND "invoices_failed" >= 0 AND
        "expenses_processed" >= 0 AND "expenses_failed" >= 0 AND
        "contacts_mapped" >= 0 AND "contacts_unmapped" >= 0
    )
);

CREATE INDEX "idx_xero_sync_logs_connection_id" ON "xero_sync_logs"("connection_id");
CREATE INDEX "idx_xero_sync_logs_status" ON "xero_sync_logs"("status");
CREATE INDEX "idx_xero_sync_logs_started_at" ON "xero_sync_logs"("started_at" DESC);
CREATE INDEX "idx_xero_sync_logs_sync_type" ON "xero_sync_logs"("sync_type");

-- ============================================================================
-- Table: xero_contact_mappings
-- Purpose: Cache Xero contact-to-client mappings for fast lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS "xero_contact_mappings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connection_id" UUID NOT NULL REFERENCES "xero_connections"("id") ON DELETE CASCADE,
    "xero_contact_id" VARCHAR(255) NOT NULL,
    "xero_contact_name" VARCHAR(255) NOT NULL,
    "client_id" TEXT NOT NULL REFERENCES "core_clients"("id") ON DELETE CASCADE,
    "mapping_type" "MappingType" NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "mapped_by_user_id" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "chk_confidence_score" CHECK ("confidence_score" IS NULL OR ("confidence_score" >= 0.0 AND "confidence_score" <= 1.0)),
    CONSTRAINT "chk_manual_mapping" CHECK (
        ("mapping_type" = 'MANUAL' AND "mapped_by_user_id" IS NOT NULL) OR
        ("mapping_type" != 'MANUAL')
    ),
    UNIQUE ("connection_id", "xero_contact_id")
);

CREATE INDEX "idx_xero_contact_mappings_connection_id" ON "xero_contact_mappings"("connection_id");
CREATE INDEX "idx_xero_contact_mappings_client_id" ON "xero_contact_mappings"("client_id");
CREATE INDEX "idx_xero_contact_mappings_type" ON "xero_contact_mappings"("mapping_type");

-- ============================================================================
-- Table: xero_expense_category_mappings
-- Purpose: Store configurable rules for auto-categorizing expenses
-- ============================================================================
CREATE TABLE IF NOT EXISTS "xero_expense_category_mappings" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connection_id" UUID NOT NULL REFERENCES "xero_connections"("id") ON DELETE CASCADE,
    "account_code_pattern" VARCHAR(50),
    "keyword_pattern" TEXT,
    "expense_type" "ExpenseType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_by_user_id" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "chk_has_pattern" CHECK ("account_code_pattern" IS NOT NULL OR "keyword_pattern" IS NOT NULL),
    CONSTRAINT "chk_priority_positive" CHECK ("priority" > 0)
);

CREATE INDEX "idx_xero_expense_mappings_connection_id" ON "xero_expense_category_mappings"("connection_id");
CREATE INDEX "idx_xero_expense_mappings_priority" ON "xero_expense_category_mappings"("priority");
CREATE INDEX "idx_xero_expense_mappings_type" ON "xero_expense_category_mappings"("expense_type");

-- ============================================================================
-- Alter Existing Tables: Add Xero-specific fields
-- ============================================================================

-- Add Xero fields to financial_revenue_records
ALTER TABLE "financial_revenue_records"
ADD COLUMN IF NOT EXISTS "xero_invoice_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "xero_invoice_number" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "revenue_sync_status" "RevenueSyncStatus",
ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP;

-- Create unique constraint to prevent duplicate Xero invoices
CREATE UNIQUE INDEX IF NOT EXISTS "idx_revenue_records_xero_invoice"
ON "financial_revenue_records"("organization_id", "xero_invoice_id")
WHERE "xero_invoice_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_revenue_records_sync_status"
ON "financial_revenue_records"("revenue_sync_status")
WHERE "revenue_sync_status" IS NOT NULL;

-- Add Xero fields to financial_expense_records
ALTER TABLE "financial_expense_records"
ADD COLUMN IF NOT EXISTS "xero_expense_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "xero_account_code" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "expense_sync_status" "ExpenseSyncStatus",
ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP;

-- Create unique constraint to prevent duplicate Xero expenses
CREATE UNIQUE INDEX IF NOT EXISTS "idx_expense_records_xero_expense"
ON "financial_expense_records"("organization_id", "xero_expense_id")
WHERE "xero_expense_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_expense_records_sync_status"
ON "financial_expense_records"("expense_sync_status")
WHERE "expense_sync_status" IS NOT NULL;

-- ============================================================================
-- Updated Timestamp Triggers
-- ============================================================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_xero_connections_updated_at BEFORE UPDATE ON "xero_connections"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_xero_contact_mappings_updated_at BEFORE UPDATE ON "xero_contact_mappings"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_xero_expense_mappings_updated_at BEFORE UPDATE ON "xero_expense_category_mappings"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Success Message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Xero integration schema created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run the RLS policies script: 002_xero_rls_policies.sql';
    RAISE NOTICE '2. Configure environment variables in Vercel';
    RAISE NOTICE '3. Deploy the application';
END $$;
