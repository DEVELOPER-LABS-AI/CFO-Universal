# Feature Specification: DevLabs CFO Productization Strategy

**Status**: Draft
**Created**: 2026-03-13
**Last Updated**: 2026-03-13

---

## Overview

### Feature Summary

Transform DevLabs CFO from an agency-specific financial operations platform into a universal small business CFO solution that serves any service-based business. The productization will follow a hybrid go-to-market strategy: launch an agency edition first to validate and generate revenue, then expand to serve all service businesses (consultancies, professional services, SaaS) with autonomous agent capabilities and full Profit First methodology implementation.

### Business Value

**Current Problem**: DevLabs CFO is 44% complete and optimized exclusively for service agencies, leaving 5.4M+ other service businesses without an affordable, AI-powered CFO solution. The current state limits market opportunity and prevents revenue generation until the product is more complete.

**Solution Value**:
- **Immediate Revenue**: Launch agency edition in Q2 2026 to capture early adopters and generate $3K-5K MRR
- **Market Validation**: Real customer feedback informs universal expansion decisions
- **Larger TAM**: Expand from 500K agencies to 5.9M total service businesses
- **Differentiated Positioning**: "Pay yourself first" + "run lean" philosophy with autonomous agent automation
- **Sustainable Growth**: Agency revenue funds universal development, reducing financial risk

### Target Users

**Primary Users** (Phase 1 - Q2 2026):
- Service agency owners (digital marketing, creative, development shops)
- Agency CFOs and finance teams
- Agency executives managing contractor/staff allocation

**Secondary Users** (Phase 3-4 - Q3-Q4 2026):
- Small business owners (consultancies, professional services, SaaS startups)
- Solopreneurs and micro-businesses (1-10 employees)
- Business accountants and bookkeepers managing multiple clients

**Tertiary Users** (Future):
- Product-based businesses, e-commerce, retail (out of initial scope)

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Agency Owner Validates Real Margins**
- **Actor**: Agency owner with 15 employees, 10 clients, 5 contractors
- **Goal**: Understand true profitability per client after all contractor and overhead costs
- **Steps**:
  1. Owner connects Xero accounting and Mercury bank accounts
  2. System imports 3 months of historical invoices and expenses
  3. System automatically calculates margin per client, accounting for contractor costs and staff allocation
  4. Owner reviews margin dashboard showing 5-tier client classification (excellent to unprofitable)
  5. System recommends pricing adjustments for 3 underpriced clients
- **Expected Outcome**: Owner discovers 2 clients are unprofitable after contractor costs, initiates pricing conversations, improves overall margin from 18% to 26% within 90 days

**Scenario 2: Business Owner Implements Profit First**
- **Actor**: Solo consultant transitioning to small firm (5 employees)
- **Goal**: Pay themselves consistently using Profit First methodology instead of taking irregular distributions
- **Steps**:
  1. Owner sets up Profit First allocations (50% owner pay, 30% operating, 15% tax, 5% profit)
  2. System monitors revenue deposits and recommends monthly distributions based on allocation percentages
  3. Owner receives automated alert when it's time to take quarterly profit distribution
  4. System tracks deferred compensation when cash flow is tight
  5. Owner views year-to-date owner pay vs. target compensation
- **Expected Outcome**: Owner pays themselves consistently every month, accumulates $12K in tax reserves, and takes first quarterly profit distribution of $8K within 6 months

**Scenario 3: Founder Decides When to Hire**
- **Actor**: SaaS startup founder with $40K MRR and 2 contractors
- **Goal**: Determine if they should hire a full-time operations manager or continue with contractors
- **Steps**:
  1. Founder reviews utilization dashboard showing contractor costs at 85% of revenue
  2. System recommends considering full-time hire based on revenue threshold ($500K ARR typical for ops manager)
  3. Founder uses cost comparison calculator (FTE vs. contractor vs. AI agent)
  4. System suggests automating 40% of current operational tasks with agents before hiring
  5. Founder implements 2 autonomous agents (invoice generation, expense categorization)
- **Expected Outcome**: Founder reduces contractor costs by 30% through agent automation, delays hiring by 6 months, improves cash flow

**Scenario 4: Autonomous Agent Monitors Cash Flow**
- **Actor**: Small business owner managing multiple projects
- **Goal**: Receive proactive alerts about cash flow issues without manually checking bank balance
- **Steps**:
  1. Owner enables autonomous cash flow monitoring agent
  2. Agent checks bank balance daily via Mercury integration
  3. Cash balance drops below $10K threshold (2 weeks operating expenses)
  4. Agent sends Telegram alert: "Cash flow alert: Balance $8.2K. Expected expenses $6.5K next week. Recommend accelerating invoice collection."
  5. Owner reviews overdue invoices and sends payment reminders to 3 clients
- **Expected Outcome**: Owner avoids cash shortfall, collects $15K in overdue payments within 5 days, maintains healthy cash reserves

### Edge Cases

**EC-1: Migration from Agency to Universal Edition**
- Existing agency customers need seamless transition when universal edition launches
- System must preserve historical data and user configurations
- Terminology changes (contractor → vendor) must not break existing workflows

**EC-2: Multi-Currency Revenue**
- Service businesses with international clients receive payments in multiple currencies
- System must track revenue in native currency and convert to reporting currency
- Exchange rate fluctuations should be accounted for in margin calculations

**EC-3: Seasonal Business Patterns**
- Some businesses have significant seasonal revenue variation (tax preparers, retail agencies)
- Profit First allocations may need temporary adjustment during low-revenue periods
- Owner compensation targets should account for annual patterns, not just monthly

**EC-4: Partial Integration Access**
- Some users may only have access to accounting (Xero/QuickBooks) but not banking (Mercury)
- System should provide value with partial data while encouraging full integration
- Margin calculations should work with invoiced revenue when actual deposits unavailable

**EC-5: Integration Sync Failures During Critical Operations**
- Sync failures may occur during onboarding (initial data import) or monthly close periods
- System uses exponential backoff retry (3 attempts: 1min, 5min, 15min) before alerting user
- Degraded mode allows users to proceed with last successfully synced data plus manual entry
- Dashboard displays prominent "data may be outdated" warning when operating in degraded mode

---

## Functional Requirements

### Core Requirements

**FR-1: Multi-Business-Type Support**
- **Description**: System must support configuration for different business types (agencies, consultancies, SaaS, professional services) with appropriate terminology, metrics, and calculations for each type
- **Acceptance Criteria**:
  - [ ] Business owners can select business type during onboarding (SERVICE_AGENCY, CONSULTING_FIRM, SAAS, PROFESSIONAL_SERVICES)
  - [ ] System adapts terminology based on business type (contractor vs. vendor, client vs. customer)
  - [ ] Dashboard displays relevant KPIs for selected business type (utilization for hourly businesses, MRR for subscriptions)
  - [ ] Margin calculation formula adjusts based on business type (contribution margin for agencies, gross margin for products)
  - [ ] Users can switch business type post-onboarding without losing historical data

**FR-2: Profit First Allocation System**
- **Description**: System must implement Profit First methodology with configurable allocation percentages for operating expenses, owner pay, profit, and tax reserves
- **Acceptance Criteria**:
  - [ ] Users can set allocation percentages for four categories (operating, owner pay, profit, tax)
  - [ ] System calculates recommended distributions based on actual revenue received
  - [ ] Users receive alerts when it's time to take quarterly profit distributions
  - [ ] System tracks cumulative deferred compensation when owner doesn't take full pay
  - [ ] Allocation percentages can be adjusted over time with historical tracking
  - [ ] System recommends separate bank accounts for each allocation category

**FR-3: Owner Compensation Tracking**
- **Description**: System must track expected vs. actual owner compensation with multiple rate types (hourly, daily, monthly, variable) and identify payment gaps
- **Acceptance Criteria**:
  - [ ] Owners can set expected compensation in hourly, daily, monthly, or variable format
  - [ ] System automatically detects owner withdrawals via bank integration merchant mapping
  - [ ] Dashboard displays monthly owner pay status (paid, upcoming, overdue, shortfall amount)
  - [ ] Cumulative deferred compensation is calculated and displayed year-to-date
  - [ ] Users receive alerts when owner pay hasn't been taken for 45+ days

**FR-4: Multi-Source Revenue Attribution**
- **Description**: System must track revenue from multiple sources (bank deposits, accounting invoices, service contracts) and reconcile discrepancies
- **Acceptance Criteria**:
  - [ ] Revenue is recorded from Mercury bank deposits (primary source)
  - [ ] Revenue is imported from Xero/QuickBooks invoices (secondary source)
  - [ ] Service contract recurring revenue is forecasted based on billing schedules
  - [ ] System flags discrepancies when invoiced amount differs from received amount by 10%+
  - [ ] Users can manually categorize deposits to specific clients/projects
  - [ ] Multi-period revenue (annual contracts) can be allocated across months

**FR-5: Intelligent Recommendation Engine**
- **Description**: System must analyze financial data and provide actionable recommendations for cost reduction, revenue optimization, and operational efficiency
- **Acceptance Criteria**:
  - [ ] System generates recommendations in four categories (subscriptions, staffing, revenue, overhead)
  - [ ] Each recommendation includes confidence score (HIGH/MEDIUM/LOW) based on data quality
  - [ ] Recommendations can be acted on, dismissed, or deferred with status tracking
  - [ ] System tracks realized savings after users act on cost-cutting recommendations
  - [ ] Dismissed recommendations auto-reactivate if underlying metric changes by 15%+
  - [ ] Conflicting recommendations (cost-cut vs. revenue investment) are flagged with trade-off analysis

**FR-6: Autonomous Financial Agents**
- **Description**: System must support autonomous background agents that execute scheduled financial tasks (invoice generation, expense categorization, cash flow monitoring) with transparent audit trails. Implementation uses Vercel Cron + Supabase Edge Functions (not Docker containers). See [technical-implementation.md](technical-implementation.md) for architecture details.
- **Acceptance Criteria**:
  - [ ] Users can enable/disable individual autonomous agents from settings
  - [ ] Agents execute on defined schedules (daily, weekly, monthly) via Vercel Cron and Supabase pg_cron
  - [ ] All agent actions are logged to PostgreSQL audit table with transparent trail showing what changed and why
  - [ ] Users receive notifications via Telegram when agents complete critical tasks or detect issues
  - [ ] Agent errors are captured and reported without blocking system functionality
  - [ ] Users can rollback agent actions within 72-hour window via rollback tokens
  - [ ] Agent execution respects time limits (60s for Vercel routes, 900s for Supabase Edge Functions)
  - [ ] Complex agents (>900s) are batched or queued for sequential processing

**FR-7: Hiring and Capacity Planning**
- **Description**: System must provide data-driven recommendations for when to hire, what role to hire, and whether to use full-time employees vs. contractors vs. AI agents
- **Acceptance Criteria**:
  - [ ] System detects low staff utilization (under 60%) and recommends reallocation before hiring
  - [ ] Revenue-based hiring thresholds are suggested (e.g., "hire operations manager at $500K ARR")
  - [ ] Cost comparison calculator shows total cost of ownership for FTE vs. contractor vs. agent
  - [ ] System identifies repetitive tasks suitable for agent automation instead of hiring
  - [ ] Bench cost (idle staff time) is calculated and displayed with alert thresholds
  - [ ] Seasonal staffing patterns are detected and factored into recommendations

**FR-8: Integration Flexibility**
- **Description**: System must support multiple accounting platforms (Xero, QuickBooks) and banking sources (Mercury, Plaid-connected banks) to accommodate diverse user preferences with resilient failure handling and rate limit management
- **Acceptance Criteria**:
  - [ ] Users can connect Xero OR QuickBooks Online during onboarding
  - [ ] Users can connect Mercury Bank OR any Plaid-supported bank
  - [ ] System functions with accounting-only integration (no banking) with reduced feature set
  - [ ] OAuth credentials are encrypted and stored securely (AES-256-GCM minimum)
  - [ ] Sync failures trigger automatic retry with exponential backoff (3 attempts at 1min, 5min, 15min intervals)
  - [ ] After 3 failed retry attempts, user receives alert with error details and manual retry button
  - [ ] System operates in degraded mode when integrations unavailable (displays last successful sync timestamp, allows manual data entry)
  - [ ] API requests are queued and throttled to respect provider rate limits (Xero: 60 req/min, QuickBooks: 500 req/min, Mercury: hourly limits)
  - [ ] When rate limit detected, system queues remaining requests and processes sequentially with appropriate delays
  - [ ] Users can disconnect and reconnect integrations without losing historical data

### Data Requirements

**DR-1: Business Configuration**
- **Description**: Store organization-level settings that control feature availability and terminology
- **Key Attributes**: business_type, revenue_model, enable_utilization_tracking, enable_profit_first, margin_calculation_method, client_term, contractor_term, profit_allocation_pct, tax_allocation_pct
- **Validation Rules**: Allocation percentages must sum to 100%; business_type must be from predefined enum; terminology fields must be 1-30 characters
- **Retention Policy**: Retained indefinitely while organization active; configuration history tracked for audit purposes

**DR-2: Revenue Records**
- **Description**: Store all revenue transactions from multiple sources with client/project attribution
- **Key Attributes**: amount, date, source (BANK_DEPOSIT | INVOICE | CONTRACT), client_id, project_id, status (EXPECTED | INVOICED | RECEIVED), payment_method, currency
- **Validation Rules**: Amount must be positive; date cannot be future; source must map to valid integration; soft delete for audit trail
- **Retention Policy**: 3 years active (readily accessible for dashboards and analysis), then archived for remaining 4 years to meet 7-year compliance requirement

**DR-3: Owner Compensation**
- **Description**: Track expected and actual owner compensation with deferred amounts
- **Key Attributes**: staff_id (owner), month, year, expected_amount, actual_amount, shortfall, compensation_start_date, rate, rate_type (HOURLY | DAILY | MONTHLY | VARIABLE), payment_status
- **Validation Rules**: Expected amount must align with rate and rate_type; shortfall is auto-calculated; historical records are immutable

**DR-4: Financial Recommendations**
- **Description**: Store AI-generated recommendations with lifecycle management
- **Key Attributes**: category (SUBSCRIPTION | STAFFING | REVENUE | OVERHEAD), title, description, confidence_score, status (ACTIVE | ACTED_ON | DISMISSED | DEFERRED), created_at, acted_on_date, realized_savings, target_entity_type, target_entity_id
- **Validation Rules**: Confidence score 0.0-1.0; status transitions follow defined workflow; deduplication by composite key (org_id + category + target_entity)
- **Retention Policy**: 3 years active (enables trend analysis of recommendation effectiveness and realized savings tracking)

**DR-5: Agent Execution Logs**
- **Description**: Audit trail of all autonomous agent actions
- **Key Attributes**: agent_type (INVOICE_GENERATOR | EXPENSE_CATEGORIZER | CASH_FLOW_MONITOR), execution_time, status (SUCCESS | FAILED | PARTIAL), actions_taken (JSONB array), errors (JSONB array), affected_entities, rollback_available
- **Validation Rules**: Execution time must be in past; actions_taken must be non-empty array; errors are optional; retention period 2 years

---

## Non-Functional Requirements

### Performance

- **Dashboard Page Load**: Initial dashboard page load must complete within 3 seconds for users with typical broadband connections (10 Mbps+)
- **Financial Calculations**: Interactive calculations (margin updates, allocation adjustments, recommendation scoring) must complete within 500ms to maintain responsive user experience
- **Sync Operations**: Background sync operations (Xero/Mercury imports) may take longer but must provide progress indicators and not block user interactions
- **Agent Execution**: Autonomous agents may execute over several seconds but must report status updates at least every 2 seconds during active processing

### Reliability & Rate Limiting

- **API Rate Limit Compliance**: System respects external provider rate limits (Xero: 60 requests/minute, QuickBooks: 500 requests/minute, Mercury: hourly sync limits)
- **Request Queuing**: When approaching rate limits, requests are queued and processed sequentially with appropriate delays to prevent throttling
- **Graceful Degradation**: Rate limit events do not block user interface; queued operations continue in background with progress notifications
- **Multi-Org Coordination**: Rate limits are managed globally across all organizations to prevent system-wide throttling

---

## Clarifications

### Session 2026-03-13

- Q: What are the acceptable response time targets for dashboard page loads and financial calculations? → A: Standard web app: <500ms calculations, <3s page loads
- Q: How long should operational data (revenue records, recommendations, client metrics, configurations) be retained in the active system before archival? → A: 3 years active + archive
- Q: How should the system handle integration sync failures - what retry strategy and degraded mode behavior? → A: Exponential backoff: 3 auto-retries (1min, 5min, 15min intervals), then alert user with manual retry option
- Q: What format should data exports use for GDPR/CCPA compliance requests? → A: CSV + JSON bundle (CSV for financial tables, JSON for configurations and relationships)
- Q: How should the system handle hitting external API rate limits from integration providers? → A: Request queuing with throttling (queue requests, respect provider limits, process sequentially with delays)

---

## Success Criteria

### Measurable Outcomes

- [ ] **Revenue Validation (Q2 2026)**: Generate $3K-5K monthly recurring revenue from 10+ agency customers within 90 days of agency edition launch
- [ ] **Customer Retention (Q3 2026)**: Achieve 80%+ customer retention rate after first 3 months of usage
- [ ] **Feature Adoption (Q3 2026)**: 30%+ of customers enable autonomous financial agents within first month of availability
- [ ] **Agent Reliability (Q3 2026)**: Autonomous agents execute 5,000+ scheduled tasks with zero critical errors (data loss, incorrect calculations)
- [ ] **Market Expansion (Q4 2026)**: Onboard 50+ total customers across all business types (agencies, consultancies, SaaS, professional services) after universal edition launch
- [ ] **Revenue Growth (Q4 2026)**: Reach $10K-15K MRR by end of Q4 2026 with 70%+ customer retention
- [ ] **User Satisfaction (Q4 2026)**: Achieve NPS score above 40 indicating product-market fit
- [ ] **Owner Compensation Improvement (ongoing)**: 60%+ of users report increased owner compensation consistency (monthly variance reduced by 40%+) within 6 months
- [ ] **Margin Visibility (ongoing)**: 80%+ of users discover at least one underpriced client within first 30 days of usage
- [ ] **Time Savings (ongoing)**: Users save 5+ hours per month on financial operations through agent automation

---

## Dependencies

### External Dependencies

- **Xero API**: Requires active Xero partnership/integration for invoice and expense sync (daily sync frequency)
- **QuickBooks Online API**: Requires Intuit developer account and OAuth approval for accounting data access
- **Mercury Bank API**: Requires Mercury partnership for transaction sync and balance monitoring (hourly sync frequency)
- **Plaid API**: Required for connecting non-Mercury bank accounts (optional but expands addressable market)
- **Stripe API**: Required for tracking subscription revenue for SaaS businesses (Phase 3)
- **Anthropic Claude API**: Required for AI-powered recommendation engine and autonomous agent decision-making
- **Telegram Bot API**: Required for real-time alerts and notifications from autonomous agents
- **Vercel Pro Tier**: Required for 60-second serverless function timeout (vs. 10s on free tier)
- **Supabase Pro Tier**: Required for 900-second Edge Function timeout and advanced features (optional: $25/mo)

### Internal Dependencies

- **Existing Authentication System**: Multi-tenant auth with Supabase must support organization-level isolation
- **Existing Database Schema**: 13 core tables with row-level security policies must be preserved during agency-to-universal refactor
- **Existing Margin Calculation Engine**: Core financial logic (margin formulas, cost allocation) must be generalized for multiple business types
- **Existing Recommendation Engine**: 4 parallel analyzers (subscription, staffing, revenue, overhead) must be adapted to remove agency-specific logic
- **Existing Mercury Integration**: Transaction sync and merchant mapping must remain functional during universal refactor

---

## Assumptions

- **Market Validation**: Service business owners (agencies, consultancies) are willing to pay $99-399/mo for AI-powered CFO solution
- **Integration Access**: Target customers have access to at least one accounting platform (Xero OR QuickBooks) and banking API access
- **Data Quality**: Users have 3+ months of historical financial data available for import to enable meaningful margin analysis
- **Profit First Adoption**: Small business owners are familiar with or willing to learn Profit First methodology
- **Agent Trust**: Users will trust autonomous agents with financial tasks if transparent audit trails and rollback capabilities are provided
- **Technical Feasibility**: Existing agency-specific codebase (95% ready) can be refactored to universal model in 6-8 weeks without breaking changes
- **Deployment Architecture**: Current Vercel + Supabase serverless stack is compatible with autonomous agent requirements. No Docker migration needed. Agents will use Supabase Edge Functions (900s timeout) for complex operations and Vercel Crons for simple scheduled tasks. See [technical-implementation.md](technical-implementation.md) for details.
- **Competitive Landscape**: No direct competitor offers combination of Profit First + autonomous agents + run-lean philosophy at this price point
- **Revenue Timing**: Agency customers will pay monthly subscriptions, not annual upfront (SaaS model preferred over professional services)
- **Support Requirements**: Users can self-onboard with guided wizard; dedicated customer success not required until 50+ customers
- **Churn Expectations**: 20-30% first-year churn is acceptable for early-stage SaaS product

---

## Out of Scope

**Not Included in Initial Phases (Q2-Q4 2026)**:
- Product-based businesses (inventory management, COGS tracking, SKU-level margins)
- E-commerce platforms (Shopify integration, order-level revenue, shipping costs)
- Retail and restaurant businesses (POS integration, Square/Toast, cash register reconciliation)
- Multi-currency profit/loss reporting (revenue tracked in multiple currencies but reported in single currency only)
- Payroll processing integration (ADP, Gusto) - owner compensation tracking only, not full payroll
- Tax filing and compliance automation (tax reserve tracking only, not actual filing)
- Advanced forecasting (ML-based revenue prediction, seasonality modeling beyond trend detection)
- White-label or agency reseller program (direct B2B SaaS only)
- Mobile native apps (mobile-responsive web only)
- API access for third-party integrations (closed system initially)

**Explicitly Not Supported**:
- Businesses with under $5K/month revenue (minimum viable for $99/mo subscription)
- Businesses requiring SOC 2 or HIPAA compliance (future enterprise edition)
- Non-English languages and internationalization
- Custom calculation formulas or business logic per customer (template-based only)
- Unlimited historical data import (12 months maximum for initial import)

---

## Security & Privacy Considerations

- **Data Privacy**: All financial data is stored with organization-level isolation enforced via Supabase Row Level Security (RLS). PII (owner names, bank account numbers) is encrypted at rest. No cross-tenant data leakage permitted.
- **Access Control**: Role-based access control with 5 user types (OWNER, EXECUTIVE, ANALYST, TEAM_MEMBER, VENDOR). Owners can invite team members with granular permission controls. Vendors can only access their own invoices/payments.
- **Integration Credentials**: OAuth tokens for Xero, QuickBooks, Mercury, and Plaid are encrypted using AES-256-GCM with organization-specific encryption keys. Tokens are never logged or exposed in UI.
- **Audit Trail**: All autonomous agent actions, recommendation status changes, and financial data modifications are logged with user_id, timestamp, and action details for compliance and debugging.
- **Compliance**: No PHI or HIPAA-protected data is stored. Financial data retention follows standard accounting practices (7 years). Users can request data export or deletion (GDPR/CCPA compliant). Data exports include:
  - **CSV files** for tabular financial data (revenue records, expense records, recommendations, owner compensation, client metrics)
  - **JSON file** for structured configurations (business settings, user profiles, integration configs, relationships)
  - Export bundle delivered as downloadable ZIP file within 48 hours of request
  - Data deletion completes within 30 days of request with confirmation email
- **Agent Safety**: Autonomous agents cannot delete data or transfer funds. Actions are limited to read operations, categorization, and report generation. All agent decisions include rollback capability.

---

## Future Enhancements

**Post-Q4 2026 Considerations**:
- Advanced cash flow forecasting (90-day predictions using ML models trained on historical patterns)
- Tax planning and estimated tax payment calculations (integration with tax preparation software)
- Vendor negotiation agents (AI-powered research on subscription pricing and contract renewal timing)
- Multi-entity consolidation (for businesses operating multiple legal entities under one parent org)
- Scenario planning (what-if analysis for hiring, pricing changes, new service offerings)
- Mobile native apps (iOS/Android) for on-the-go financial monitoring
- API access and webhook support for third-party integrations
- Advanced benchmarking (compare your metrics to anonymized peer businesses in same industry)
- Collaborative CFO features (shared dashboards for accountants managing multiple clients)
- Enterprise edition (SOC 2, HIPAA, custom SLAs, dedicated support)
