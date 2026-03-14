-- Mercury Banking Integration Schema Migration
-- Created: 2026-02-15
-- Description: Add Mercury Bank integration tables and enums

-- ============================================================================
-- STEP 1: Create Enums
-- ============================================================================

CREATE TYPE mercury_connection_status AS ENUM ('ACTIVE', 'DISCONNECTED', 'API_ERROR');
CREATE TYPE mercury_sync_type AS ENUM ('TRANSACTIONS', 'BALANCES', 'FULL');
CREATE TYPE mercury_sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE mercury_sync_trigger AS ENUM ('SYSTEM', 'MANUAL', 'RETRY');
CREATE TYPE mapping_confidence AS ENUM ('EXACT', 'FUZZY', 'MANUAL');
CREATE TYPE mapping_source AS ENUM ('SYSTEM', 'ADMIN_USER');
CREATE TYPE categorization_rule_type AS ENUM ('MERCHANT_NAME', 'DESCRIPTION_KEYWORD', 'AMOUNT_RANGE');
CREATE TYPE mercury_account_type AS ENUM ('CHECKING', 'SAVINGS', 'TREASURY');
CREATE TYPE expense_record_sync_status AS ENUM ('MANUAL', 'SYNCED', 'CATEGORIZATION_FAILED', 'MAPPING_FAILED');

-- ============================================================================
-- STEP 2: Create Tables
-- ============================================================================

-- Table 1: mercury_connections
CREATE TABLE mercury_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL UNIQUE REFERENCES core_organizations(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  connection_status mercury_connection_status NOT NULL DEFAULT 'ACTIVE',
  last_sync_at TIMESTAMPTZ,
  last_sync_status mercury_sync_status,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_mercury_connections_organization ON mercury_connections(organization_id);
CREATE INDEX idx_mercury_connections_status ON mercury_connections(connection_status);
CREATE INDEX idx_mercury_connections_last_sync ON mercury_connections(last_sync_at DESC);

-- Table 2: mercury_sync_logs
CREATE TABLE mercury_sync_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id TEXT NOT NULL REFERENCES mercury_connections(id) ON DELETE CASCADE,
  sync_type mercury_sync_type NOT NULL,
  status mercury_sync_status NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  transactions_processed INTEGER NOT NULL DEFAULT 0,
  transactions_failed INTEGER NOT NULL DEFAULT 0,
  balances_updated INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by mercury_sync_trigger NOT NULL,
  triggered_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mercury_sync_logs_connection ON mercury_sync_logs(connection_id, started_at DESC);
CREATE INDEX idx_mercury_sync_logs_status ON mercury_sync_logs(status, started_at DESC);
CREATE INDEX idx_mercury_sync_logs_sync_type ON mercury_sync_logs(sync_type);
CREATE INDEX idx_mercury_sync_logs_errors ON mercury_sync_logs USING GIN(errors);

-- Table 3: merchant_mapping_cache
CREATE TABLE merchant_mapping_cache (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id TEXT NOT NULL REFERENCES mercury_connections(id) ON DELETE CASCADE,
  mercury_merchant_name TEXT NOT NULL,
  normalized_merchant_name TEXT NOT NULL,
  contractor_id TEXT,
  mapping_confidence mapping_confidence NOT NULL,
  confidence_score DECIMAL(3,2),
  mapped_by mapping_source NOT NULL,
  mapped_by_user_id TEXT,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_merchant_per_connection UNIQUE (connection_id, normalized_merchant_name)
);

CREATE INDEX idx_merchant_mapping_connection ON merchant_mapping_cache(connection_id);
CREATE INDEX idx_merchant_mapping_contractor ON merchant_mapping_cache(contractor_id);
CREATE INDEX idx_merchant_mapping_confidence ON merchant_mapping_cache(mapping_confidence);

-- Table 4: transaction_categorization_rules
CREATE TABLE transaction_categorization_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES core_organizations(id) ON DELETE CASCADE,
  rule_type categorization_rule_type NOT NULL,
  pattern TEXT NOT NULL,
  category "ExpenseCategory" NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorization_rules_org_priority ON transaction_categorization_rules(organization_id, priority DESC) WHERE is_active = TRUE;
CREATE INDEX idx_categorization_rules_org_category ON transaction_categorization_rules(organization_id, category) WHERE is_active = TRUE;
CREATE INDEX idx_categorization_rules_active ON transaction_categorization_rules(is_active);

-- Table 5: account_balance_history
CREATE TABLE account_balance_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id TEXT NOT NULL REFERENCES mercury_connections(id) ON DELETE CASCADE,
  mercury_account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type mercury_account_type NOT NULL,
  current_balance DECIMAL(12,2) NOT NULL,
  available_balance DECIMAL(12,2) NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_account_snapshot_per_day UNIQUE (connection_id, mercury_account_id, snapshot_date)
);

CREATE INDEX idx_balance_history_connection ON account_balance_history(connection_id);
CREATE INDEX idx_balance_history_date ON account_balance_history(snapshot_date DESC);
CREATE INDEX idx_balance_history_account_type ON account_balance_history(account_type);

-- ============================================================================
-- STEP 3: Update Existing Tables
-- ============================================================================

-- Add Mercury fields to financial_expense_records
ALTER TABLE financial_expense_records
ADD COLUMN mercury_transaction_id TEXT,
ADD COLUMN merchant_name TEXT,
ADD COLUMN categorization_confidence DECIMAL(3,2),
ADD COLUMN mercury_sync_status expense_record_sync_status;

-- Create unique index for mercury_transaction_id
CREATE UNIQUE INDEX idx_expense_mercury_tx_unique
  ON financial_expense_records(mercury_transaction_id)
  WHERE mercury_transaction_id IS NOT NULL;

-- Create index for mercury_sync_status
CREATE INDEX idx_expense_mercury_sync_status
  ON financial_expense_records(mercury_sync_status);

-- Create index for merchant_name
CREATE INDEX idx_expense_merchant_name
  ON financial_expense_records(merchant_name);

-- ============================================================================
-- STEP 4: Enable RLS Policies
-- ============================================================================

-- Enable RLS on all Mercury tables
ALTER TABLE mercury_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercury_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_mapping_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy for mercury_connections
CREATE POLICY "mercury_connections_org_isolation"
  ON mercury_connections
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy for mercury_sync_logs
CREATE POLICY "mercury_sync_logs_org_isolation"
  ON mercury_sync_logs
  FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM mercury_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy for merchant_mapping_cache
CREATE POLICY "merchant_mapping_org_isolation"
  ON merchant_mapping_cache
  FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM mercury_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy for transaction_categorization_rules
CREATE POLICY "categorization_rules_org_isolation"
  ON transaction_categorization_rules
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- RLS Policy for account_balance_history
CREATE POLICY "balance_history_org_isolation"
  ON account_balance_history
  FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM mercury_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 5: Seed Default Categorization Rules
-- ============================================================================

-- Insert default categorization rules for all organizations
INSERT INTO transaction_categorization_rules (
  organization_id,
  rule_type,
  pattern,
  category,
  priority,
  created_by_user_id
)
SELECT
  o.id,
  'MERCHANT_NAME',
  'aws|amazon web services|vercel|netlify|heroku|digitalocean|google cloud|azure|cloudflare',
  'SUBSCRIPTION',
  100,
  uo.user_id
FROM core_organizations o
JOIN user_organizations uo ON uo.organization_id = o.id AND uo.role = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO transaction_categorization_rules (
  organization_id,
  rule_type,
  pattern,
  category,
  priority,
  created_by_user_id
)
SELECT
  o.id,
  'DESCRIPTION_KEYWORD',
  'rent|lease|utilities|insurance|office',
  'OVERHEAD',
  90,
  uo.user_id
FROM core_organizations o
JOIN user_organizations uo ON uo.organization_id = o.id AND uo.role = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO transaction_categorization_rules (
  organization_id,
  rule_type,
  pattern,
  category,
  priority,
  created_by_user_id
)
SELECT
  o.id,
  'DESCRIPTION_KEYWORD',
  'payroll|salary|wages|compensation',
  'PAYROLL',
  85,
  uo.user_id
FROM core_organizations o
JOIN user_organizations uo ON uo.organization_id = o.id AND uo.role = 'owner'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All Mercury integration tables, enums, indexes, and RLS policies created
-- Default categorization rules seeded for existing organizations
