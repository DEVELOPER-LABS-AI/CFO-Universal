-- ============================================================================
-- Seed Data for DevLabs CFO
-- ============================================================================
-- Run this in Supabase SQL Editor to populate test data
-- ============================================================================

-- Insert Test Organization
INSERT INTO core_organizations (id, name, subscription_tier, updated_at)
VALUES (
    'org-devlabs-test',
    'DevLabs Test Agency',
    'pro',
    CURRENT_TIMESTAMP
);

-- Insert Services
INSERT INTO core_services (id, organization_id, name, description, standard_rate, target_margin, is_active, updated_at)
VALUES
    ('service-web-dev', 'org-devlabs-test', 'Web Development', 'Full-stack web development services', 150.00, 40.00, true, CURRENT_TIMESTAMP),
    ('service-seo', 'org-devlabs-test', 'SEO Services', 'Search engine optimization and content strategy', 120.00, 45.00, true, CURRENT_TIMESTAMP);

-- Insert Clients
INSERT INTO core_clients (id, organization_id, name, status, relationship_type, custom_margin_target, start_date, updated_at)
VALUES
    ('client-acme', 'org-devlabs-test', 'Acme Corporation', 'ACTIVE', 'Retainer', 45.00, '2025-01-01', CURRENT_TIMESTAMP),
    ('client-globex', 'org-devlabs-test', 'Globex Industries', 'ACTIVE', 'Project', NULL, '2025-02-01', CURRENT_TIMESTAMP),
    ('client-initech', 'org-devlabs-test', 'Initech Solutions', 'INACTIVE', 'Hourly', NULL, '2024-06-01', CURRENT_TIMESTAMP);

-- Update Initech with churn date
UPDATE core_clients SET churn_date = '2024-12-31' WHERE id = 'client-initech';

-- Insert Contractors
INSERT INTO core_contractors (id, organization_id, name, rate, rate_type, engagement_type, updated_at)
VALUES
    ('contractor-john', 'org-devlabs-test', 'John Developer', 75.00, 'HOURLY', 'FULL_TIME', CURRENT_TIMESTAMP),
    ('contractor-jane', 'org-devlabs-test', 'Jane Designer', 65.00, 'HOURLY', 'PART_TIME', CURRENT_TIMESTAMP);

-- Insert Contractor Assignments
INSERT INTO core_contractor_assignments (id, contractor_id, client_id, start_date, allocation_percentage, updated_at)
VALUES
    ('assign-1', 'contractor-john', 'client-acme', '2025-01-01', 100, CURRENT_TIMESTAMP),
    ('assign-2', 'contractor-jane', 'client-globex', '2025-02-01', 50, CURRENT_TIMESTAMP);

-- Insert Revenue Records
INSERT INTO financial_revenue_records (id, organization_id, client_id, service_id, amount, transaction_date, status, description, sync_source, updated_at)
VALUES
    ('revenue-1', 'org-devlabs-test', 'client-acme', 'service-web-dev', 15000.00, '2025-01-15', 'RECEIVED', 'January retainer payment', 'MANUAL', CURRENT_TIMESTAMP),
    ('revenue-2', 'org-devlabs-test', 'client-globex', 'service-seo', 8000.00, '2025-02-15', 'INVOICED', 'SEO project milestone 1', 'MANUAL', CURRENT_TIMESTAMP);

-- Insert Expense Records
INSERT INTO financial_expense_records (id, organization_id, client_id, contractor_id, amount, transaction_date, category, description, sync_source, updated_at)
VALUES
    ('expense-1', 'org-devlabs-test', 'client-acme', 'contractor-john', 6000.00, '2025-01-31', 'CONTRACTOR_COST', 'John - 80 hours @ $75/hr', 'MANUAL', CURRENT_TIMESTAMP),
    ('expense-2', 'org-devlabs-test', NULL, NULL, 500.00, '2025-01-31', 'SUBSCRIPTION', 'Figma subscription', 'MANUAL', CURRENT_TIMESTAMP);

-- Insert Client Metrics
INSERT INTO analytics_client_metrics (id, client_id, period_start, period_end, total_revenue, total_costs, actual_margin, target_margin, tier_classification, updated_at)
VALUES
    ('metrics-1', 'client-acme', '2025-01-01', '2025-01-31', 15000.00, 6000.00, 60.00, 45.00, 1, CURRENT_TIMESTAMP);

-- Insert Company Metrics
INSERT INTO analytics_company_metrics (id, organization_id, period_start, period_end, portfolio_margin, total_revenue, total_expenses, client_count, updated_at)
VALUES
    ('company-metrics-1', 'org-devlabs-test', '2025-01-01', '2025-01-31', 56.52, 15000.00, 6500.00, 2, CURRENT_TIMESTAMP);

-- Insert Financial Targets
INSERT INTO system_financial_targets (id, organization_id, scope, scope_id, target_margin, target_revenue, fiscal_period, updated_at)
VALUES
    ('target-1', 'org-devlabs-test', 'GLOBAL', NULL, 40.00, 100000.00, 'Q1-2025', CURRENT_TIMESTAMP);

-- Insert Growth Scenario
INSERT INTO system_growth_scenarios (id, organization_id, scenario_name, assumptions, projected_revenue, projected_margin, created_by, updated_at)
VALUES
    ('scenario-1', 'org-devlabs-test', 'Hire 2 Contractors',
     '{"new_contractors": 2, "contractor_rate": 70, "utilization": 80, "months": 6}'::jsonb,
     180000.00, 42.00, 'seed-script', CURRENT_TIMESTAMP);

-- ============================================================================
-- Verification
-- ============================================================================

-- Check inserted data
SELECT 'Organizations' as table_name, COUNT(*) as count FROM core_organizations
UNION ALL
SELECT 'Services', COUNT(*) FROM core_services
UNION ALL
SELECT 'Clients', COUNT(*) FROM core_clients
UNION ALL
SELECT 'Contractors', COUNT(*) FROM core_contractors
UNION ALL
SELECT 'Contractor Assignments', COUNT(*) FROM core_contractor_assignments
UNION ALL
SELECT 'Revenue Records', COUNT(*) FROM financial_revenue_records
UNION ALL
SELECT 'Expense Records', COUNT(*) FROM financial_expense_records
UNION ALL
SELECT 'Client Metrics', COUNT(*) FROM analytics_client_metrics
UNION ALL
SELECT 'Company Metrics', COUNT(*) FROM analytics_company_metrics
UNION ALL
SELECT 'Financial Targets', COUNT(*) FROM system_financial_targets
UNION ALL
SELECT 'Growth Scenarios', COUNT(*) FROM system_growth_scenarios;

-- ============================================================================
-- Next Step: Link Your User to Organization
-- ============================================================================

-- After running this seed data, link your Supabase auth user to the organization:
--
-- INSERT INTO public.user_organizations (user_id, organization_id, role)
-- VALUES (
--     'YOUR-AUTH-USER-ID',  -- Get from Supabase Auth dashboard
--     'org-devlabs-test',   -- Organization ID from above
--     'owner'
-- );
--
-- Then verify:
-- SELECT * FROM public.user_organizations;
--
-- ============================================================================
