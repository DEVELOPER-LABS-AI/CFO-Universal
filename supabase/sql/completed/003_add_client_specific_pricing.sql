-- ============================================================================
-- Add Client-Specific Pricing to ClientService
-- ============================================================================
-- This migration adds custom_rate and rate_type fields to the core_client_services
-- table to support client-specific pricing for services.
--
-- Use Case: Different clients can pay different rates for the same service
-- Example: BDR Services - Client A pays $8,000/month, Client B pays $6,000/month
-- ============================================================================

-- Add custom_rate column (nullable - if null, use service standard_rate)
ALTER TABLE core_client_services
ADD COLUMN IF NOT EXISTS custom_rate DECIMAL(10, 2);

-- Add rate_type column (nullable - if null, inherits from service)
-- Note: RateType enum already exists (HOURLY, DAILY, MONTHLY)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'RateType'
    ) THEN
        CREATE TYPE "RateType" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY');
    END IF;
END$$;

ALTER TABLE core_client_services
ADD COLUMN IF NOT EXISTS rate_type "RateType";

-- Add updated_at column for tracking changes
ALTER TABLE core_client_services
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS update_client_services_updated_at ON core_client_services;

CREATE TRIGGER update_client_services_updated_at
BEFORE UPDATE ON core_client_services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN core_client_services.custom_rate IS 'Client-specific rate that overrides the service standard_rate. If NULL, uses service standard_rate.';
COMMENT ON COLUMN core_client_services.rate_type IS 'Rate type for this client (HOURLY, DAILY, MONTHLY). If NULL, inherits from service or assumes hourly.';
COMMENT ON COLUMN core_client_services.updated_at IS 'Timestamp of last update to this client-service relationship';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Client-specific pricing columns added successfully!';
    RAISE NOTICE 'You can now set custom rates for each client-service combination.';
    RAISE NOTICE 'Example: UPDATE core_client_services SET custom_rate = 8000, rate_type = ''MONTHLY'' WHERE client_id = ''xxx'' AND service_id = ''yyy'';';
END $$;
