-- Mercury Integration Database Schema
-- Run this in Supabase SQL Editor

-- Create enum types
CREATE TYPE "public"."MercuryConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'API_ERROR');
CREATE TYPE "public"."MercurySyncType" AS ENUM ('FULL', 'INCREMENTAL');
CREATE TYPE "public"."MercurySyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'PARTIAL', 'FAILED');

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
    "transactions_processed" INTEGER DEFAULT 0,
    "transactions_failed" INTEGER DEFAULT 0,
    "balances_updated" INTEGER DEFAULT 0,
    "errors" JSONB,
    "triggered_by" TEXT,

    CONSTRAINT "mercury_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mercury_sync_logs_connection_id_idx" ON "public"."mercury_sync_logs"("connection_id");
CREATE INDEX "mercury_sync_logs_started_at_idx" ON "public"."mercury_sync_logs"("started_at");
CREATE INDEX "mercury_sync_logs_status_idx" ON "public"."mercury_sync_logs"("status");

-- Create merchant_mapping_cache table
CREATE TABLE "public"."merchant_mapping_cache" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "merchant_name" TEXT NOT NULL,
    "contractor_id" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_mapping_cache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "merchant_mapping_cache_connection_id_idx" ON "public"."merchant_mapping_cache"("connection_id");
CREATE INDEX "merchant_mapping_cache_merchant_name_idx" ON "public"."merchant_mapping_cache"("merchant_name");
CREATE INDEX "merchant_mapping_cache_contractor_id_idx" ON "public"."merchant_mapping_cache"("contractor_id");

-- Create account_balance_history table
CREATE TABLE "public"."account_balance_history" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "current_balance" DECIMAL(15,2) NOT NULL,
    "available_balance" DECIMAL(15,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_balance_history_connection_id_idx" ON "public"."account_balance_history"("connection_id");
CREATE INDEX "account_balance_history_recorded_at_idx" ON "public"."account_balance_history"("recorded_at");
CREATE INDEX "account_balance_history_account_id_idx" ON "public"."account_balance_history"("account_id");

-- Add foreign keys
ALTER TABLE "public"."mercury_connections" ADD CONSTRAINT "mercury_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."mercury_sync_logs" ADD CONSTRAINT "mercury_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."merchant_mapping_cache" ADD CONSTRAINT "merchant_mapping_cache_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."core_contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."account_balance_history" ADD CONSTRAINT "account_balance_history_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."mercury_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add mercury_transaction_id to financial_expense_records if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='financial_expense_records'
        AND column_name='mercury_transaction_id'
    ) THEN
        ALTER TABLE "public"."financial_expense_records"
        ADD COLUMN "mercury_transaction_id" TEXT;

        CREATE INDEX "financial_expense_records_mercury_transaction_id_idx"
        ON "public"."financial_expense_records"("mercury_transaction_id");
    END IF;
END $$;
