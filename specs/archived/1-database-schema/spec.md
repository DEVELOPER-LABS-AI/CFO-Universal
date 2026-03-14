# Feature Specification: Database Schema for DevLabs CFO System

**Status**: Draft
**Created**: 2026-02-12
**Last Updated**: 2026-02-12

---

## Overview

### Feature Summary

A comprehensive database schema that stores all financial data, client information, contractor details, service definitions, analytics metrics, and integration sync logs for the DevLabs CFO profit optimization system.

### Business Value

The database schema serves as the foundational data layer for the entire CFO system, enabling:
- Accurate profit margin tracking across all clients and services
- Historical financial analysis and trend identification
- Automated pricing recommendations based on margin performance
- Real-time synchronization with external accounting and banking systems
- Secure multi-tenant data access with organization-level isolation

### Target Users

- **Primary**: System administrators configuring the database
- **Secondary**: Backend developers accessing data through the application
- **Indirect**: Business users viewing reports generated from this data

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Store Client Financial Data**
- **Actor**: CFO System (automated sync)
- **Goal**: Record revenue and expense transactions for accurate margin calculation
- **Steps**:
  1. Receive invoice data from accounting system
  2. Validate client association exists
  3. Store revenue record with line-item details
  4. Link revenue to specific service type
  5. Update client's total revenue metrics
- **Expected Outcome**: All financial transactions are accurately recorded with proper relationships to clients and services

**Scenario 2: Track Contractor Costs**
- **Actor**: CFO System
- **Goal**: Maintain accurate contractor cost data for margin calculations
- **Steps**:
  1. Record contractor profile (rate, engagement type)
  2. Store contractor assignment to specific client
  3. Link contractor costs to expense records
  4. Calculate blended rate when multiple contractors serve one client
- **Expected Outcome**: System can accurately attribute contractor costs to client engagements for margin analysis

**Scenario 3: Multi-Tenant Data Isolation**
- **Actor**: Organization user
- **Goal**: Access only their organization's financial data
- **Steps**:
  1. User authenticates with organization credentials
  2. System identifies user's organization
  3. Database enforces access policies
  4. User queries return only organization-scoped data
- **Expected Outcome**: Users see only data belonging to their organization, with no cross-organization data leakage

**Scenario 4: Integration Sync Tracking**
- **Actor**: Integration service (Xero/Mercury)
- **Goal**: Prevent duplicate data imports and track sync health
- **Steps**:
  1. Integration begins sync operation
  2. System checks last successful sync timestamp
  3. Fetch only new/updated records since last sync
  4. Log sync results (success, errors, record counts)
  5. Update sync status and timestamp
- **Expected Outcome**: System maintains audit trail of all integration syncs and prevents duplicate data imports

### Edge Cases

- **Orphaned Records**: Client deleted but historical revenue records exist (soft delete required)
- **Multi-Service Clients**: Single client receiving multiple service types with different margin targets
- **Contractor Overlap**: One contractor working on multiple clients simultaneously
- **Time Zone Variations**: Financial data from different regions with different fiscal calendars
- **Data Migration**: Importing historical data from previous systems
- **Currency Differences**: Multi-currency support for international clients (if applicable)

---

## Functional Requirements

### Core Requirements

**FR-1: Organization Multi-Tenancy**
- **Description**: All data must be scoped to organizations to enable multi-tenant SaaS deployment
- **Acceptance Criteria**:
  - [ ] Every core entity (clients, contractors, services) has organization_id reference
  - [ ] Users can only access data from their assigned organization
  - [ ] Organization deletion cascades to all related data or prevents deletion if data exists
  - [ ] Cross-organization queries are prevented at the database level

**FR-2: Client Management**
- **Description**: Store comprehensive client profiles with relationship status and financial targets
- **Acceptance Criteria**:
  - [ ] Each client has unique identifier, name, and status (active/inactive/churned)
  - [ ] Clients support custom margin targets that override service-level defaults
  - [ ] System tracks client start date, relationship type, and churn date if applicable
  - [ ] Client records support soft deletion to preserve historical data

**FR-3: Service Type Definitions**
- **Description**: Define service offerings with standard pricing and margin targets
- **Acceptance Criteria**:
  - [ ] Each service has name, description, and standard rate
  - [ ] Services have configurable target margin percentages
  - [ ] Service definitions are organization-specific
  - [ ] Services can be marked as active/deprecated without deletion

**FR-4: Contractor Workforce Tracking**
- **Description**: Maintain contractor profiles with rates, availability, and client assignments
- **Acceptance Criteria**:
  - [ ] Contractor records include name, hourly/daily rate, and engagement type
  - [ ] System tracks contractor assignments to specific clients with start/end dates
  - [ ] Supports calculating blended rates for multi-contractor engagements
  - [ ] Contractor utilization can be calculated from assignment data

**FR-5: Revenue Recording**
- **Description**: Store all revenue transactions with client and service associations
- **Acceptance Criteria**:
  - [ ] Revenue records capture amount, date, client, service type, and description
  - [ ] Support for both invoiced and received revenue status tracking
  - [ ] Revenue can be split across multiple line items for different services
  - [ ] Integration sync metadata (source system, external ID) is captured

**FR-6: Expense Tracking**
- **Description**: Record all business expenses with categorization and client attribution
- **Acceptance Criteria**:
  - [ ] Expenses capture amount, date, category, and optional client assignment
  - [ ] Support for both contractor costs and operational expenses
  - [ ] Automatic categorization based on transaction patterns (subscriptions, tools, payroll)
  - [ ] Integration sync metadata preserved for audit trails

**FR-7: Analytics Metrics Storage**
- **Description**: Pre-calculated metrics for fast dashboard rendering
- **Acceptance Criteria**:
  - [ ] Client-level metrics: actual margin, target margin, tier classification (1-5)
  - [ ] Company-level metrics: portfolio margin, revenue targets, expense ratios
  - [ ] Metrics include calculation timestamp for cache invalidation
  - [ ] Historical snapshots preserved for trend analysis (daily/weekly/monthly)

**FR-8: Integration Sync Logging**
- **Description**: Audit trail of all external system synchronizations
- **Acceptance Criteria**:
  - [ ] Logs capture integration type (Xero, Mercury, Slack), sync timestamp, and status
  - [ ] Record counts (inserted, updated, failed) are tracked per sync
  - [ ] Error messages and stack traces stored for failed syncs
  - [ ] Last successful sync timestamp enables incremental updates

**FR-9: OAuth Token Storage**
- **Description**: Secure storage of API credentials for external integrations
- **Acceptance Criteria**:
  - [ ] Tokens stored with encryption at rest
  - [ ] Supports access token, refresh token, and expiry timestamp
  - [ ] Tokens scoped to organization and integration provider
  - [ ] Automatic expiry detection for token refresh workflows

**FR-10: Financial Target Management**
- **Description**: Configurable targets for margin, revenue, and profitability goals
- **Acceptance Criteria**:
  - [ ] Targets defined at global, service, and client levels (hierarchical)
  - [ ] Support for quarterly and annual target periods
  - [ ] Target history preserved for year-over-year comparisons
  - [ ] Default targets applied when client-specific targets not defined

### Data Requirements

**DR-1: Core Schema - Organizations**
- **Description**: Root entity for multi-tenant data isolation
- **Key Attributes**: organization_id (PK), name, subscription_tier, created_at
- **Validation Rules**: Name required, unique constraint on name

**DR-2: Core Schema - Clients**
- **Description**: Agency clients receiving services
- **Key Attributes**: client_id (PK), organization_id (FK), name, status, relationship_type, custom_margin_target, start_date, churn_date
- **Validation Rules**: Name required, status enum (active/inactive/churned), margin_target between 0-100

**DR-3: Core Schema - Services**
- **Description**: Service offerings provided to clients
- **Key Attributes**: service_id (PK), organization_id (FK), name, description, standard_rate, target_margin, is_active
- **Validation Rules**: Name required, standard_rate > 0, target_margin between 0-100

**DR-4: Core Schema - Contractors**
- **Description**: Contractor workforce delivering services
- **Key Attributes**: contractor_id (PK), organization_id (FK), name, rate, rate_type (hourly/daily), engagement_type (FT/PT/project)
- **Validation Rules**: Name required, rate > 0, rate_type enum

**DR-5: Core Schema - Contractor Assignments**
- **Description**: Links contractors to client engagements
- **Key Attributes**: assignment_id (PK), contractor_id (FK), client_id (FK), start_date, end_date, allocation_percentage
- **Validation Rules**: start_date required, end_date >= start_date, allocation between 0-100

**DR-6: Financial Schema - Revenue Records**
- **Description**: All revenue transactions
- **Key Attributes**: revenue_id (PK), organization_id (FK), client_id (FK), service_id (FK), amount, transaction_date, status, description, external_id, sync_source
- **Validation Rules**: amount > 0, transaction_date required, status enum (invoiced/received)

**DR-7: Financial Schema - Expense Records**
- **Description**: All business expenses
- **Key Attributes**: expense_id (PK), organization_id (FK), client_id (FK nullable), contractor_id (FK nullable), amount, transaction_date, category, description, external_id, sync_source
- **Validation Rules**: amount > 0, transaction_date required, category enum

**DR-8: Analytics Schema - Client Metrics**
- **Description**: Pre-calculated client-level analytics
- **Key Attributes**: metric_id (PK), client_id (FK), period_start, period_end, total_revenue, total_costs, actual_margin, target_margin, tier_classification, calculated_at
- **Validation Rules**: period_end >= period_start, tier_classification between 1-5

**DR-9: Analytics Schema - Company Metrics**
- **Description**: Organization-wide financial metrics
- **Key Attributes**: metric_id (PK), organization_id (FK), period_start, period_end, portfolio_margin, total_revenue, total_expenses, client_count, calculated_at
- **Validation Rules**: period_end >= period_start, all amounts >= 0

**DR-10: Integrations Schema - OAuth Tokens**
- **Description**: Encrypted API credentials
- **Key Attributes**: token_id (PK), organization_id (FK), provider (Xero/Mercury/Slack), access_token_encrypted, refresh_token_encrypted, expires_at
- **Validation Rules**: provider enum, expires_at future timestamp, encryption required

**DR-11: Integrations Schema - Sync Logs**
- **Description**: Integration synchronization audit trail
- **Key Attributes**: log_id (PK), organization_id (FK), integration_type, sync_started_at, sync_completed_at, status, records_inserted, records_updated, records_failed, error_message
- **Validation Rules**: status enum (pending/success/failed), completed_at >= started_at

**DR-12: System Schema - Financial Targets**
- **Description**: Hierarchical margin and revenue targets
- **Key Attributes**: target_id (PK), organization_id (FK), scope (global/service/client), scope_id (FK nullable), target_margin, target_revenue, fiscal_period, created_at
- **Validation Rules**: scope enum, target_margin between 0-100, fiscal_period format (Q1-2025, FY-2025)

**DR-13: System Schema - Growth Scenarios**
- **Description**: Headcount and pricing simulation results
- **Key Attributes**: scenario_id (PK), organization_id (FK), scenario_name, assumptions (JSON), projected_revenue, projected_margin, created_by, created_at
- **Validation Rules**: scenario_name required, assumptions valid JSON

---

## Success Criteria

### Measurable Outcomes

- [ ] **Data Integrity**: All revenue and expense records link to valid clients and services with 100% referential integrity
- [ ] **Performance**: Queries for client margin calculations return results in under 500ms for datasets up to 10,000 transactions
- [ ] **Multi-Tenancy**: Organization data isolation verified with zero cross-tenant data leakage in security audit
- [ ] **Historical Accuracy**: System preserves all historical data for at least 7 years to support tax and compliance reporting
- [ ] **Sync Reliability**: Integration sync logs capture 100% of sync operations with success/failure status
- [ ] **Scalability**: Schema supports up to 1,000 organizations, 100,000 clients, and 10 million transactions without performance degradation
- [ ] **Data Completeness**: All required fields validated at database level with zero null values in mandatory columns

---

## Dependencies

### External Dependencies

- **Supabase PostgreSQL**: Managed database service (version 15+)
- **Prisma ORM**: Schema definition and migration tooling
- **Encryption Service**: For OAuth token encryption (external key management)

### Internal Dependencies

- **Authentication System**: Provides organization_id for Row Level Security policies
- **Integration Services**: Will write to revenue/expense tables via sync operations
- **Analytics Engine**: Will read from raw data tables and write to analytics schema

---

## Assumptions

- Supabase provides PostgreSQL 15 or later with support for Row Level Security (RLS)
- All financial amounts are stored in a single currency (USD) with potential future multi-currency support
- Fiscal year follows calendar year (January-December) unless customized per organization
- Soft deletes are preferred over hard deletes to preserve historical data integrity
- Data retention policy requires 7+ years of historical data for compliance
- Average organization has 50-500 clients and 100-5,000 transactions per month
- Integration syncs run daily (Xero) and hourly (Mercury) as defined in architecture
- OAuth tokens require encryption at rest using AES-256 or equivalent

---

## Out of Scope

- Physical database server provisioning (handled by Supabase)
- Database backup and disaster recovery procedures (Supabase managed)
- Specific SQL query optimization (will be addressed during implementation)
- Database migration scripts from legacy systems
- User interface for direct database manipulation
- Real-time replication across geographic regions
- Multi-currency support (future enhancement)
- Blockchain or immutable ledger integration
- Integration with accounting systems beyond Xero and Mercury
- Automated data archival to cold storage

---

## Security & Privacy Considerations

- **Data Privacy**: Financial transaction data is highly sensitive and must comply with data protection regulations
- **Access Control**: Row Level Security (RLS) policies enforce organization-level data isolation
- **Encryption**: OAuth tokens and potentially sensitive client data encrypted at rest
- **Audit Trails**: All integration syncs logged with timestamps and user/system attribution
- **Compliance**: Schema design supports GDPR/CCPA requirements for data retention and deletion
- **Credential Storage**: OAuth tokens never stored in plain text; encryption keys managed separately

---

## Future Enhancements

- Multi-currency support with exchange rate tracking
- Time-series optimization for historical trend analysis (using TimescaleDB extension)
- Blockchain integration for immutable financial audit trails
- Advanced data partitioning for organizations with 1M+ transactions
- Geographically distributed read replicas for global low-latency access
- Automated data archival to cold storage after 3-5 years
- Integration with additional accounting systems (QuickBooks, FreshBooks)
- Custom field definitions allowing organization-specific data extensions
