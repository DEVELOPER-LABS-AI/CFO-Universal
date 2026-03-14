-- =============================================================================
-- Feature 1: Dynamic Cost Sync & Auto-Association
-- Production Migration Script
-- Run this in the Supabase SQL Editor (safe to run multiple times)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add missing columns to merchant_mapping_cache
-- (agency_id and subscription_id support for mutual-exclusivity mapping)
-- -----------------------------------------------------------------------------

ALTER TABLE merchant_mapping_cache
  ADD COLUMN IF NOT EXISTS agency_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- Add indexes for the new columns (IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'merchant_mapping_cache' AND indexname = 'idx_merchant_mapping_agency'
  ) THEN
    CREATE INDEX idx_merchant_mapping_agency ON merchant_mapping_cache(agency_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'merchant_mapping_cache' AND indexname = 'idx_merchant_mapping_subscription'
  ) THEN
    CREATE INDEX idx_merchant_mapping_subscription ON merchant_mapping_cache(subscription_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 2: Create subscription_transaction_records table
-- (Links Mercury debit transactions to subscriptions for dynamic cost tracking)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_transaction_records (
  id                     TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  subscription_id        TEXT NOT NULL,
  mercury_transaction_id TEXT NOT NULL,
  amount                 DECIMAL(10,2) NOT NULL,
  transaction_date       TIMESTAMPTZ NOT NULL,
  merchant_name          TEXT NOT NULL,
  period_month           INTEGER NOT NULL,
  period_year            INTEGER NOT NULL,
  linked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_transaction_records_pkey PRIMARY KEY (id)
);

-- Unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscription_transaction_records'
    AND indexname = 'subscription_transaction_records_mercury_transaction_id_key'
  ) THEN
    CREATE UNIQUE INDEX subscription_transaction_records_mercury_transaction_id_key
      ON subscription_transaction_records(mercury_transaction_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscription_transaction_records'
    AND indexname = 'subscription_transaction_records_subscription_id_mercury_tx_key'
  ) THEN
    CREATE UNIQUE INDEX subscription_transaction_records_subscription_id_mercury_tx_key
      ON subscription_transaction_records(subscription_id, mercury_transaction_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscription_transaction_records'
    AND indexname = 'idx_sub_tx_org'
  ) THEN
    CREATE INDEX idx_sub_tx_org ON subscription_transaction_records(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscription_transaction_records'
    AND indexname = 'idx_sub_tx_sub_period'
  ) THEN
    CREATE INDEX idx_sub_tx_sub_period
      ON subscription_transaction_records(subscription_id, period_year, period_month DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscription_transaction_records'
    AND indexname = 'idx_sub_tx_date'
  ) THEN
    CREATE INDEX idx_sub_tx_date ON subscription_transaction_records(transaction_date DESC);
  END IF;
END $$;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'subscription_transaction_records_organization_id_fkey'
  ) THEN
    ALTER TABLE subscription_transaction_records
      ADD CONSTRAINT subscription_transaction_records_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES core_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'subscription_transaction_records_subscription_id_fkey'
  ) THEN
    ALTER TABLE subscription_transaction_records
      ADD CONSTRAINT subscription_transaction_records_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE subscription_transaction_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: organization isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscription_transaction_records'
    AND policyname = 'sub_tx_records_org_isolation'
  ) THEN
    CREATE POLICY sub_tx_records_org_isolation ON subscription_transaction_records
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 3: Create client_cash_receipts table
-- (Links Mercury credit transactions to clients for revenue reconciliation)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_cash_receipts (
  id                     TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  client_id              TEXT NOT NULL,
  mercury_transaction_id TEXT NOT NULL,
  amount                 DECIMAL(10,2) NOT NULL,
  receipt_date           TIMESTAMPTZ NOT NULL,
  period_month           INTEGER NOT NULL,
  period_year            INTEGER NOT NULL,
  linked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by_user_id      TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_cash_receipts_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'client_cash_receipts'
    AND indexname = 'client_cash_receipts_mercury_transaction_id_key'
  ) THEN
    CREATE UNIQUE INDEX client_cash_receipts_mercury_transaction_id_key
      ON client_cash_receipts(mercury_transaction_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'client_cash_receipts' AND indexname = 'idx_ccr_org'
  ) THEN
    CREATE INDEX idx_ccr_org ON client_cash_receipts(organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'client_cash_receipts' AND indexname = 'idx_ccr_client_period'
  ) THEN
    CREATE INDEX idx_ccr_client_period
      ON client_cash_receipts(client_id, period_year, period_month DESC);
  END IF;
END $$;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_cash_receipts_organization_id_fkey'
  ) THEN
    ALTER TABLE client_cash_receipts
      ADD CONSTRAINT client_cash_receipts_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES core_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_cash_receipts_client_id_fkey'
  ) THEN
    ALTER TABLE client_cash_receipts
      ADD CONSTRAINT client_cash_receipts_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES core_clients(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE client_cash_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_cash_receipts' AND policyname = 'ccr_org_isolation'
  ) THEN
    CREATE POLICY ccr_org_isolation ON client_cash_receipts
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Step 4: Create auto_sync_run_logs table
-- (Tracks per-sync auto-association results from the engine)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auto_sync_run_logs (
  id                                  TEXT NOT NULL,
  organization_id                     TEXT NOT NULL,
  mercury_sync_log_id                 TEXT NOT NULL,
  started_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                        TIMESTAMPTZ,
  duration_ms                         INTEGER,
  subscription_transactions_created   INTEGER NOT NULL DEFAULT 0,
  contractor_expense_records_created  INTEGER NOT NULL DEFAULT 0,
  needs_review_count                  INTEGER NOT NULL DEFAULT 0,
  engine_error_count                  INTEGER NOT NULL DEFAULT 0,
  partial_commit                      BOOLEAN NOT NULL DEFAULT false,
  errors                              JSONB NOT NULL DEFAULT '[]',
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auto_sync_run_logs_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'auto_sync_run_logs'
    AND indexname = 'auto_sync_run_logs_mercury_sync_log_id_key'
  ) THEN
    CREATE UNIQUE INDEX auto_sync_run_logs_mercury_sync_log_id_key
      ON auto_sync_run_logs(mercury_sync_log_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'auto_sync_run_logs' AND indexname = 'idx_asrl_org'
  ) THEN
    CREATE INDEX idx_asrl_org ON auto_sync_run_logs(organization_id);
  END IF;
END $$;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auto_sync_run_logs_organization_id_fkey'
  ) THEN
    ALTER TABLE auto_sync_run_logs
      ADD CONSTRAINT auto_sync_run_logs_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES core_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auto_sync_run_logs_mercury_sync_log_id_fkey'
  ) THEN
    ALTER TABLE auto_sync_run_logs
      ADD CONSTRAINT auto_sync_run_logs_mercury_sync_log_id_fkey
      FOREIGN KEY (mercury_sync_log_id) REFERENCES mercury_sync_logs(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE auto_sync_run_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_sync_run_logs' AND policyname = 'asrl_org_isolation'
  ) THEN
    CREATE POLICY asrl_org_isolation ON auto_sync_run_logs
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- =============================================================================
-- Done. All Feature 1 tables and columns are now present in production.
-- =============================================================================
