-- Fix Mercury Schema to Match Prisma
-- Drop and recreate Mercury tables with correct schema

-- Drop existing tables
DROP TABLE IF EXISTS "public"."account_balance_history" CASCADE;
DROP TABLE IF EXISTS "public"."merchant_mapping_cache" CASCADE;
DROP TABLE IF EXISTS "public"."transaction_categorization_rules" CASCADE;
DROP TABLE IF EXISTS "public"."mercury_sync_logs" CASCADE;
DROP TABLE IF EXISTS "public"."mercury_connections" CASCADE;

-- Drop existing enums
DROP TYPE IF EXISTS "public"."MercuryConnectionStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncType" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncTrigger" CASCADE;
DROP TYPE IF EXISTS "public"."MappingConfidence" CASCADE;
DROP TYPE IF EXISTS "public"."MappingSource" CASCADE;
DROP TYPE IF EXISTS "public"."CategorizationRuleType" CASCADE;
DROP TYPE IF EXISTS "public"."MercuryAccountType" CASCADE;
DROP TYPE IF EXISTS "public"."ExpenseRecordSyncStatus" CASCADE;

-- Create enums
CREATE TYPE "public"."MercuryConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'API_ERROR');
CREATE TYPE "public"."MercurySyncType" AS ENUM ('TRANSACTIONS', 'BALANCES', 'FULL');
CREATE TYPE "public"."MercurySyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE "public"."MercurySyncTrigger" AS ENUM ('SYSTEM', 'MANUAL', 'RETRY');
CREATE TYPE "public"."MappingConfidence" AS ENUM ('EXACT', 'FUZZY', 'MANUAL');
CREATE TYPE "public"."MappingSource" AS ENUM ('SYSTEM', 'ADMIN_USER');
CREATE TYPE "public"."CategorizationRuleType" AS ENUM ('MERCHANT_NAME', 'DESCRIPTION_KEYWORD', 'AMOUNT_RANGE');
CREATE TYPE "public"."MercuryAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'TREASURY');
CREATE TYPE "public"."ExpenseRecordSyncStatus" AS ENUM ('MANUAL', 'SYNCED', 'CATEGORIZATION_FAILED', 'MAPPING_FAILED');

-- Create mercury_connections table
CREATE TABLE "public"."mercury_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "connection_status" "public"."MercuryConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "public"."MercurySyncStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mercury_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mercury_connections_organization_id_key" ON "public"."mercury_connections"("organization_id");
CREATE INDEX "mercury_connections_organization_id_idx" ON "public"."mercury_connections"("organization_id");
CREATE INDEX "mercury_connections_connection_status_idx" ON "public"."mercury_connections"("connection_status");
CREATE INDEX "mercury_connections_last_sync_at_idx" ON "public"."mercury_connections"("last_sync_at");

-- Create mercury_sync_logs table
CREATE TABLE "public"."mercury_sync_logs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "sync_type" "public"."MercurySyncType" NOT NULL,
    "status" "public"."MercurySyncStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "transactions_processed" INTEGER NOT NULL DEFAULT 0,
    "transactions_failed" INTEGER NOT NULL DEFAULT 0,
    "balances_updated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "triggered_by" "public"."MercurySyncTrigger" NOT NULL,
    "triggered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercury_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mercury_sync_logs_connection_id_idx" ON "public"."mercury_sync_logs"("connection_id");
CREATE INDEX "mercury_sync_logs_status_idx" ON "public"."mercury_sync_logs"("status");
CREATE INDEX "mercury_sync_logs_started_at_idx" ON "public"."mercury_sync_logs"("started_at" DESC);
CREATE INDEX "mercury_sync_logs_sync_type_idx" ON "public"."mercury_sync_logs"("sync_type");

-- Create merchant_mapping_cache table
CREATE TABLE "public"."merchant_mapping_cache" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "mercury_merchant_name" TEXT NOT NULL,
    "normalized_merchant_name" TEXT NOT NULL,
    "contractor_id" TEXT,
    "mapping_confidence" "public"."MappingConfidence" NOT NULL,
    "confidence_score" DECIMAL(3,2),
    "mapped_by" "public"."MappingSource" NOT NULL,
    "mapped_by_user_id" TEXT,
    "mapped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_mapping_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_mapping_cache_connection_id_normalized_merchant_na_key" ON "public"."merchant_mapping_cache"("connection_id", "normalized_merchant_name");
CREATE INDEX "merchant_mapping_cache_connection_id_idx" ON "public"."merchant_mapping_cache"("connection_id");
CREATE INDEX "merchant_mapping_cache_contractor_id_idx" ON "public"."merchant_mapping_cache"("contractor_id");
CREATE INDEX "merchant_mapping_cache_mapping_confidence_idx" ON "public"."merchant_mapping_cache"("mapping_confidence");

-- Create transaction_categorization_rules table
CREATE TABLE "public"."transaction_categorization_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_type" "public"."CategorizationRuleType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" "public"."ExpenseCategory" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_categorization_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_categorization_rules_organization_id_priority_idx" ON "public"."transaction_categorization_rules"("organization_id", "priority" DESC);
CREATE INDEX "transaction_categorization_rules_organization_id_category_idx" ON "public"."transaction_categorization_rules"("organization_id", "category");
CREATE INDEX "transaction_categorization_rules_is_active_idx" ON "public"."transaction_categorization_rules"("is_active");

-- Create account_balance_history table
CREATE TABLE "public"."account_balance_history" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "mercury_account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" "public"."MercuryAccountType" NOT NULL,
    "current_balance" DECIMAL(12,2) NOT NULL,
    "available_balance" DECIMAL(12,2) NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_balance_history_connection_id_mercury_account_id_sn_key" ON "public"."account_balance_history"("connection_id", "mercury_account_id", "snapshot_date");
CREATE INDEX "account_balance_history_connection_id_idx" ON "public"."account_balance_history"("connection_id");
CREATE INDEX "account_balance_history_snapshot_date_idx" ON "public"."account_balance_history"("snapshot_date" DESC);
CREATE INDEX "account_balance_history_account_type_idx" ON "public"."account_balance_history"("account_type");

-- Add foreign keys
ALTER TABLE "public"."mercury_connections" ADD CONSTRAINT "mercury_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."mercury_sync_logs" ADD CONSTRAINT "mercury_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."core_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."transaction_categorization_rules" ADD CONSTRAINT "transaction_categorization_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."account_balance_history" ADD CONSTRAINT "account_balance_history_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update financial_expense_records with Mercury fields if they don't exist
DO $$
BEGIN
    -- Add mercury_transaction_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='financial_expense_records'
        AND column_name='mercury_transaction_id'
    ) THEN
        ALTER TABLE "public"."financial_expense_records"
        ADD COLUMN "mercury_transaction_id" TEXT;

        CREATE UNIQUE INDEX "financial_expense_records_mercury_transaction_id_key"
        ON "public"."financial_expense_records"("mercury_transaction_id");
    END IF;

    -- Add merchant_name if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='financial_expense_records'
        AND column_name='merchant_name'
    ) THEN
        ALTER TABLE "public"."financial_expense_records"
        ADD COLUMN "merchant_name" TEXT;
    END IF;

    -- Add categorization_confidence if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='financial_expense_records'
        AND column_name='categorization_confidence'
    ) THEN
        ALTER TABLE "public"."financial_expense_records"
        ADD COLUMN "categorization_confidence" DECIMAL(3,2);
    END IF;

    -- Add mercury_sync_status if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='financial_expense_records'
        AND column_name='mercury_sync_status'
    ) THEN
        ALTER TABLE "public"."financial_expense_records"
        ADD COLUMN "mercury_sync_status" "public"."ExpenseRecordSyncStatus";

        CREATE INDEX "financial_expense_records_mercury_sync_status_idx"
        ON "public"."financial_expense_records"("mercury_sync_status");
    END IF;

    -- Add mercury_transaction_id index if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'financial_expense_records'
        AND indexname = 'financial_expense_records_mercury_transaction_id_idx'
    ) THEN
        CREATE INDEX "financial_expense_records_mercury_transaction_id_idx"
        ON "public"."financial_expense_records"("mercury_transaction_id");
    END IF;
END $$;
