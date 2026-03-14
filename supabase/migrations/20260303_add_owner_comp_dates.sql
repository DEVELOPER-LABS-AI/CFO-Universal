-- Add compensation tracking fields to staff table for owner pay
-- compensation_start_date: when to begin tracking deferred compensation
-- pay_day: expected day of month for payment (1-28)

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS compensation_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pay_day INTEGER;
