# Tasks: DevLabs CFO Productization Strategy

**Feature**: 1-cfo-productization
**Branch**: `1-cfo-productization`
**Created**: 2026-03-14
**Total Tasks**: 112
**Estimated Duration**: 19-28 weeks (5-7 months)

---

## Task Organization Overview

Tasks are organized by implementation phase and numbered sequentially (T001-T112). Each task includes:
- **Sequential ID**: Unique task identifier (T001, T002, etc.)
- **[P] Marker**: Indicates task can be parallelized with others
- **[US#] Label**: Maps to functional requirement user story
- **Exact File Path**: Specific file location for implementation
- **Action Verb**: Clear description of what needs to be done

**Phase Summary**:
- Phase 1: Setup & Foundation (2-4 weeks, 19 tasks)
- Phase 2: Agency MVP (2-4 weeks, 23 tasks)
- Phase 3: Autonomous Agents (4-6 weeks, 22 tasks)
- Phase 4: Universal Refactor (6-8 weeks, 28 tasks)
- Phase 5: Profit First (3-4 weeks, 12 tasks)
- Phase 6: Run Lean Intelligence (4-6 weeks, 8 tasks)

---

## Phase 1: Setup & Foundation (2-4 weeks)

**Goal**: Establish database schema foundation and core configuration infrastructure

**Deliverable**: Business type templates, organization configuration system, database migrations

### Database Schema Setup

- [ ] [T001] Create BusinessType entity schema in prisma/schema.prisma
- [ ] [T002] Create OrganizationConfiguration entity schema in prisma/schema.prisma
- [ ] [T003] Add business_type_id and enable_profit_first columns to Organization model in prisma/schema.prisma
- [ ] [T004] Create database migration for business types: prisma/migrations/add-business-types
- [ ] [T005] Create seed file for 4 business type templates in prisma/seeds/business-types.ts
- [ ] [T006] Add RLS policies for business_types table in supabase/policies/business-types.sql
- [ ] [T007] Add RLS policies for organization_configurations table in supabase/policies/organization-configurations.sql

### Configuration Infrastructure

- [ ] [T008] [P] Create TerminologyService class in lib/services/terminology-service.ts
- [ ] [T009] [P] Create FeatureFlagService class in lib/services/feature-flag-service.ts
- [ ] [T010] [P] Create BusinessTypeRepository in lib/repositories/business-type-repository.ts
- [ ] [T011] Implement business type immutability validator in lib/validators/business-type-lock-validator.ts
- [ ] [T012] Create database trigger for business_type_locked_at in supabase/functions/triggers/lock-business-type.sql

### API Routes

- [ ] [T013] [P] Create GET /api/business-types endpoint in app/api/business-types/route.ts
- [ ] [T014] [P] Create GET /api/organizations/[orgId]/configuration endpoint in app/api/organizations/[orgId]/configuration/route.ts
- [ ] [T015] Create PUT /api/organizations/[orgId]/configuration endpoint in app/api/organizations/[orgId]/configuration/route.ts
- [ ] [T016] Add business type lock validation middleware in lib/middleware/validate-business-type-mutation.ts

### Testing

- [ ] [T017] [P] Write unit tests for TerminologyService in lib/services/terminology-service.test.ts
- [ ] [T018] [P] Write unit tests for FeatureFlagService in lib/services/feature-flag-service.test.ts
- [ ] [T019] Write integration tests for business type selection in tests/integration/business-type-selection.test.ts

**Gate**: All migrations applied, seed data loaded, 4 business types available

---

## Phase 2: Agency MVP (2-4 weeks)

**Goal**: Launch production-ready agency edition with complete margin calculations

**Deliverable**: Polished executive dashboard, working Xero/Mercury sync, Slack CFO bot, 10 paying customers

### Margin Calculation Engine (FR-1 subset)

- [ ] [T020] [US1] Finalize contribution margin formula in lib/calculations/margin-calculations.ts
- [ ] [T021] [US1] Implement weighted cost allocation in lib/calculations/cost-allocation.ts
- [ ] [T022] [US1] Add contractor cost aggregation logic in lib/calculations/contractor-costs.ts
- [ ] [T023] [US1] Implement 5-tier client classification (excellent to unprofitable) in lib/calculations/client-classification.ts
- [ ] [T024] [US1] Create MarginCalculatorService in lib/services/margin-calculator-service.ts

### Dashboard UI Polish

- [ ] [T025] [P] Update executive dashboard layout in app/dashboard/page.tsx
- [ ] [T026] [P] Create MarginSummaryCard component in components/dashboard/margin-summary-card.tsx
- [ ] [T027] [P] Create ClientMarginTable component in components/dashboard/client-margin-table.tsx
- [ ] [T028] [P] Create RevenueBreakdownChart component in components/dashboard/revenue-breakdown-chart.tsx
- [ ] [T029] Add loading states and skeleton UI in components/dashboard/dashboard-loading.tsx
- [ ] [T030] Implement dashboard data caching layer in lib/cache/dashboard-cache.ts

### Owner Compensation Tracking (FR-3)

- [ ] [T031] [US2] Create OwnerCompensation entity schema in prisma/schema.prisma
- [ ] [T032] [US2] Implement owner pay detection from Mercury transactions in lib/integrations/mercury/owner-pay-detector.ts
- [ ] [T033] [US2] Create OwnerPayTracker service in lib/services/owner-pay-tracker.ts
- [ ] [T034] [US2] Build OwnerPayStatusCard component in components/dashboard/owner-pay-status-card.tsx
- [ ] [T035] [US2] Add 45-day overdue alert cron job in vercel.json

### Integration Testing

- [ ] [T036] [P] Test end-to-end Xero sync with sandbox account in tests/e2e/xero-sync.spec.ts
- [ ] [T037] [P] Test end-to-end Mercury sync with test API in tests/e2e/mercury-sync.spec.ts
- [ ] [T038] Verify margin calculations against Excel models in tests/integration/margin-validation.test.ts
- [ ] [T039] Load test dashboard with 10K transactions in tests/performance/dashboard-load.test.ts

### Deployment & Launch

- [ ] [T040] Configure production environment variables in Vercel dashboard
- [ ] [T041] Deploy to production and verify health endpoints
- [ ] [T042] Create onboarding wizard for agency customers in app/onboarding/agency/page.tsx

**Gate**: 10 paying customers acquired, $3K-5K MRR, 80% retention

---

## Phase 3: Autonomous Agents (4-6 weeks)

**Goal**: Implement 3 autonomous financial agents with audit trails and rollback capability

**Deliverable**: Cash flow monitor, expense categorizer, invoice generator with Telegram alerts

### Agent Infrastructure (FR-6)

- [ ] [T043] Create AgentExecutionLog entity schema in prisma/schema.prisma
- [ ] [T044] Add agent-related columns to ExpenseRecord model in prisma/schema.prisma
- [ ] [T045] Add profit_first_allocated column to RevenueRecord model in prisma/schema.prisma
- [ ] [T046] Create RLS policies for agent_execution_logs table in supabase/policies/agent-logs.sql
- [ ] [T047] Create AgentAuditLogger service in lib/services/agent-audit-logger.ts
- [ ] [T048] Implement rollback token generation in lib/agents/rollback-token-generator.ts

### Cash Flow Monitor Agent (Trigger-Route Pattern)

- [ ] [T049] [US3] Create Vercel cron handler in app/api/agents/cash-flow-monitor/route.ts
- [ ] [T050] [US3] Implement balance threshold checker in lib/agents/cash-flow-monitor/threshold-checker.ts
- [ ] [T051] [US3] Create Telegram alert sender in lib/integrations/telegram/alert-sender.ts
- [ ] [T052] [US3] Add failure alert to Slack in lib/agents/cash-flow-monitor/failure-handler.ts
- [ ] [T053] [US3] Add daily cron schedule (9 AM) to vercel.json

### Expense Categorizer Agent (Filter-Fan Pattern)

- [ ] [T054] [US3] Create Supabase Edge Function in supabase/functions/categorize-expenses/index.ts
- [ ] [T055] [US3] Implement rule-based category routes in lib/agents/expense-categorizer/rule-engine.ts
- [ ] [T056] [US3] Add AI categorization fallback using Claude in lib/agents/expense-categorizer/ai-categorizer.ts
- [ ] [T057] [US3] Create unclassified catch-all handler in lib/agents/expense-categorizer/unclassified-handler.ts
- [ ] [T058] [US3] Add confidence scoring logic in lib/agents/expense-categorizer/confidence-calculator.ts

### Invoice Generator Agent (Loop Pattern)

- [ ] [T059] [US3] Create monthly invoice generation cron in app/api/agents/invoice-generator/route.ts
- [ ] [T060] [US3] Implement retry logic with exponential backoff in lib/agents/invoice-generator/retry-handler.ts
- [ ] [T061] [US3] Add max 3 attempts hard exit in lib/agents/invoice-generator/execution-engine.ts
- [ ] [T062] [US3] Create accounting team alert for failures in lib/agents/invoice-generator/failure-notifier.ts

### Rollback Mechanism

- [ ] [T063] Create POST /api/agents/rollback endpoint in app/api/agents/rollback/route.ts
- [ ] [T064] Implement 72-hour rollback window validator in lib/agents/rollback/window-validator.ts
- [ ] [T065] Create rollback action executor in lib/agents/rollback/executor.ts

### Audit Trail UI

- [ ] [T066] [P] Create AgentExecutionLogViewer component in components/agents/agent-execution-log-viewer.tsx
- [ ] [T067] [P] Create AgentStatusDashboard page in app/dashboard/agents/page.tsx
- [ ] [T068] [P] Build RollbackButton component in components/agents/rollback-button.tsx

### Agent API Routes

- [ ] [T069] [P] Create GET /api/agents endpoint in app/api/agents/route.ts
- [ ] [T070] [P] Create POST /api/organizations/[orgId]/agents/[agentType]/enable endpoint in app/api/organizations/[orgId]/agents/[agentType]/enable/route.ts
- [ ] [T071] [P] Create POST /api/organizations/[orgId]/agents/[agentType]/disable endpoint in app/api/organizations/[orgId]/agents/[agentType]/disable/route.ts
- [ ] [T072] Create GET /api/organizations/[orgId]/agents/executions endpoint in app/api/organizations/[orgId]/agents/executions/route.ts

### Testing

- [ ] [T073] [P] Write unit tests for cash flow monitor in lib/agents/cash-flow-monitor/threshold-checker.test.ts
- [ ] [T074] [P] Write unit tests for expense categorizer in lib/agents/expense-categorizer/rule-engine.test.ts
- [ ] [T075] [P] Write unit tests for invoice generator in lib/agents/invoice-generator/execution-engine.test.ts
- [ ] [T076] Run 7-day agent execution test and verify 100% completion
- [ ] [T077] Test rollback on 10+ agent executions in tests/integration/agent-rollback.test.ts

**Gate**: 5,000+ successful agent executions with zero critical errors

---

## Phase 4: Universal Refactor (6-8 weeks)

**Goal**: Transform agency-specific codebase into universal business platform

**Deliverable**: 4 business types supported, QuickBooks integration, terminology adaptation

### Sub-Phase 4a: Data Model Refactor (2 weeks)

- [ ] [T078] Create data migration script for agency customers in prisma/migrations/migrate-agency-to-universal.ts
- [ ] [T079] Drop Agency table with CASCADE in prisma/migrations/drop-agency-tables.sql
- [ ] [T080] Drop AgencyMonthlyBreakdown table in prisma/migrations/drop-agency-tables.sql
- [ ] [T081] Drop BDRPayPlan, BDRProductivityMetric, BDRMonthlyReport tables in prisma/migrations/drop-bdr-tables.sql
- [ ] [T082] Rename Contractor model to Vendor in prisma/schema.prisma
- [ ] [T083] Add 3 new business type seeds (CONSULTING, SAAS, PROF_SERVICES) in prisma/seeds/business-types.ts
- [ ] [T084] Verify zero data loss for existing customers with validation queries

### Sub-Phase 4b: Business Logic Refactor (2 weeks)

- [ ] [T085] Create CalculationFactory for business-type-specific formulas in lib/calculations/calculation-factory.ts
- [ ] [T086] Generalize margin calculation logic in lib/calculations/margin-calculations.ts
- [ ] [T087] Make cost allocation configurable (DIRECT, WEIGHTED, ACTIVITY_BASED) in lib/calculations/cost-allocation-strategy.ts
- [ ] [T088] Remove hardcoded BDR/agency overhead logic from lib/calculations/overhead-allocation.ts
- [ ] [T089] Implement business type-specific KPI calculators in lib/kpis/kpi-calculator-factory.ts

### Sub-Phase 4c: UI/Portal Refactor (2 weeks)

- [ ] [T090] Rename agency-portal to team portal in app/team directory
- [ ] [T091] Rename contractor-portal to vendors portal in app/vendors directory
- [ ] [T092] Update all UI labels to use TerminologyService in app/dashboard/page.tsx
- [ ] [T093] Build business type selection wizard in app/onboarding/business-type-selector/page.tsx
- [ ] [T094] Create configuration management UI in app/settings/configuration/page.tsx
- [ ] [T095] Update navigation menu with dynamic terminology in components/layout/navigation.tsx

### Sub-Phase 4d: QuickBooks Integration (2 weeks)

- [ ] [T096] [US4] Create QuickBooksConnection entity schema in prisma/schema.prisma
- [ ] [T097] [US4] Create QuickBooksSyncLog entity schema in prisma/schema.prisma
- [ ] [T098] [US4] Implement OAuth 2.0 flow in lib/integrations/quickbooks/auth.ts
- [ ] [T099] [US4] Create OAuth callback handler in app/api/integrations/quickbooks/callback/route.ts
- [ ] [T100] [US4] Build webhook handler with signature validation in app/webhooks/quickbooks/route.ts
- [ ] [T101] [US4] Implement sync engine with 450 req/min rate limiting in lib/integrations/quickbooks/sync-engine.ts
- [ ] [T102] [US4] Add token refresh logic with 5-min buffer in lib/integrations/quickbooks/token-manager.ts
- [ ] [T103] [US4] Create multi-company support in lib/integrations/quickbooks/company-manager.ts

### API Routes

- [ ] [T104] [P] Create GET /api/integrations/quickbooks/authorize endpoint in app/api/integrations/quickbooks/authorize/route.ts
- [ ] [T105] [P] Create POST /api/organizations/[orgId]/integrations/quickbooks/sync endpoint in app/api/organizations/[orgId]/integrations/quickbooks/sync/route.ts
- [ ] [T106] Create GET /api/organizations/[orgId]/integrations/quickbooks/status endpoint in app/api/organizations/[orgId]/integrations/quickbooks/status/route.ts

### Testing

- [ ] [T107] [P] Test 5 organizations with different business types in tests/integration/multi-business-type.test.ts
- [ ] [T108] [P] Verify terminology changes in UI for all business types in tests/e2e/terminology-adaptation.spec.ts
- [ ] [T109] [P] Test QuickBooks sandbox sync in tests/integration/quickbooks-sync.test.ts
- [ ] [T110] Run agency customer migration test with zero data loss
- [ ] [T111] Verify dashboard performance <3s with universal data model

**Gate**: 20+ diverse businesses tested, QuickBooks integration working, zero data loss

---

## Phase 5: Profit First Enhancement (3-4 weeks)

**Goal**: Implement full Profit First methodology with CAP/TAP monitoring

**Deliverable**: Allocation engine, virtual accounts, quarterly distributions, tax reserves

### Database Schema

- [ ] [T112] Create AllocationTarget entity schema in prisma/schema.prisma
- [ ] [T113] Create VirtualAccount entity schema in prisma/schema.prisma
- [ ] [T114] Create AllocationTransaction entity schema in prisma/schema.prisma
- [ ] [T115] Create CurrentAllocation materialized view in prisma/migrations/create-current-allocations-view.sql
- [ ] [T116] Add percentage sum constraint to allocation_targets table in prisma/schema.prisma
- [ ] [T117] Add allocation amount validation constraint in prisma/schema.prisma

### Allocation Engine (FR-2)

- [ ] [T118] [US5] Implement allocation calculator in lib/profit-first/allocation-calculator.ts
- [ ] [T119] [US5] Create CAP (Current Allocation %) calculator in lib/profit-first/cap-calculator.ts
- [ ] [T120] [US5] Build TAP (Target Allocation %) fetcher in lib/profit-first/tap-fetcher.ts
- [ ] [T121] [US5] Implement variance analysis (CAP - TAP) in lib/profit-first/variance-analyzer.ts
- [ ] [T122] [US5] Create quarterly distribution calculator in lib/profit-first/distribution-calculator.ts
- [ ] [T123] [US5] Add bank account recommendation logic in lib/profit-first/account-recommender.ts

### API Routes

- [ ] [T124] [P] Create GET /api/organizations/[orgId]/allocations/targets endpoint in app/api/organizations/[orgId]/allocations/targets/route.ts
- [ ] [T125] [P] Create POST /api/organizations/[orgId]/allocations/targets endpoint in app/api/organizations/[orgId]/allocations/targets/route.ts
- [ ] [T126] [P] Create GET /api/organizations/[orgId]/allocations/accounts endpoint in app/api/organizations/[orgId]/allocations/accounts/route.ts
- [ ] [T127] Create POST /api/organizations/[orgId]/allocations/distribute endpoint in app/api/organizations/[orgId]/allocations/distribute/route.ts

### UI Components

- [ ] [T128] [P] Create Profit First dashboard page in app/dashboard/profit-first/page.tsx
- [ ] [T129] [P] Build CAP/TAP chart component in components/profit-first/cap-tap-chart.tsx
- [ ] [T130] [P] Create VirtualAccountBalances component in components/profit-first/virtual-account-balances.tsx
- [ ] [T131] Create QuarterlyDistributionCalculator component in components/profit-first/quarterly-distribution-calculator.tsx

### Automation

- [ ] [T132] Add daily CAP calculation cron job in vercel.json
- [ ] [T133] Add quarterly distribution check cron job in vercel.json

### Testing

- [ ] [T134] [P] Verify allocation percentages sum to 100% with database constraint
- [ ] [T135] [P] Test CAP/TAP calculations match manual verification in tests/integration/cap-tap-validation.test.ts
- [ ] [T136] [P] Validate virtual account balances track accurately in tests/integration/virtual-accounts.test.ts
- [ ] [T137] Test quarterly distribution alerts trigger on schedule
- [ ] [T138] Get CPA/accounting partner sign-off on Profit First formulas

**Gate**: CPA approval, allocation engine tested, virtual accounts working

---

## Phase 6: Run Lean Intelligence (4-6 weeks)

**Goal**: Provide hiring forecasting and agent opportunity detection

**Deliverable**: Hiring recommendations, FTE vs contractor TCO calculator, seasonal staffing

### Database Schema

- [ ] [T139] Create HiringRecommendation entity schema in prisma/schema.prisma
- [ ] [T140] Create AgentOpportunity entity schema in prisma/schema.prisma
- [ ] [T141] Create StaffingScenario entity schema in prisma/schema.prisma

### Hiring Intelligence (FR-7)

- [ ] [T142] [US6] Create revenue threshold calculator in lib/hiring/revenue-thresholds.ts
- [ ] [T143] [US6] Implement FTE vs contractor TCO comparison in lib/hiring/fte-vs-contractor-calculator.ts
- [ ] [T144] [US6] Build agent opportunity detector in lib/hiring/agent-opportunity-detector.ts
- [ ] [T145] [US6] Create seasonal staffing pattern analyzer in lib/hiring/seasonal-pattern-analyzer.ts
- [ ] [T146] [US6] Implement bench cost calculator in lib/hiring/bench-cost-calculator.ts

### UI Components

- [ ] [T147] [P] Create hiring forecast dashboard in app/dashboard/hiring-forecast/page.tsx
- [ ] [T148] [P] Build TCO comparison widget in components/hiring/tco-comparison-widget.tsx
- [ ] [T149] Create agent opportunity list in components/hiring/agent-opportunities.tsx

### Recommendation Engine Enhancement

- [ ] [T150] Enhance StaffingAnalyzer with predictive logic in lib/cfo-strategist/analyzers/staffing-analyzer.ts

### Testing

- [ ] [T151] [P] Test hiring thresholds trigger at correct ARR levels in tests/integration/hiring-thresholds.test.ts
- [ ] [T152] [P] Verify TCO calculator includes all costs in tests/unit/tco-calculator.test.ts
- [ ] [T153] Test agent opportunity detector identifies 3+ candidates
- [ ] [T154] Validate seasonal pattern detection with tax preparer test case

**Gate**: Hiring intelligence working, TCO calculator validated, agent opportunities detected

---

## Dependencies

### Phase Dependencies

```
Phase 1 (Setup & Foundation)
    ↓ BLOCKS
Phase 2 (Agency MVP)
    ↓ BLOCKS (customer validation required)
Phase 4 (Universal Refactor)
    ↓ BLOCKS
Phase 6 (Run Lean Intelligence)

Phase 3 (Autonomous Agents) ← Can start after Phase 1 margin engine complete
    ↓ PARALLEL with Phase 4

Phase 5 (Profit First) ← Can start during Phase 4 (parallel track)
```

### Critical Path

1. **T001-T019** (Phase 1): Database foundation - BLOCKS all other work
2. **T020-T025** (Margin engine): Core calculation logic - BLOCKS Phase 3 agents
3. **T043-T048** (Agent infrastructure): Audit logging - BLOCKS agent deployment
4. **T078-T084** (Data model refactor): Universal migration - BLOCKS Phase 6
5. **T096-T103** (QuickBooks integration): SMB market access - BLOCKS universal launch

### Parallelizable Task Groups

**Group A - Phase 1 Services** (can run in parallel):
- T008 (TerminologyService)
- T009 (FeatureFlagService)
- T010 (BusinessTypeRepository)

**Group B - Phase 2 Dashboard UI** (can run in parallel):
- T025-T029 (All dashboard components)

**Group C - Phase 3 Agent Tests** (can run in parallel):
- T073-T075 (Unit tests for 3 agents)

**Group D - Phase 4 API Routes** (can run in parallel):
- T104-T106 (QuickBooks endpoints)

**Group E - Phase 5 UI Components** (can run in parallel):
- T128-T130 (Profit First dashboard components)

**Group F - Phase 6 Testing** (can run in parallel):
- T151-T152 (Hiring intelligence tests)

---

## Implementation Notes

### File Path Conventions

- **Prisma Schemas**: `prisma/schema.prisma`
- **Database Migrations**: `prisma/migrations/<name>/migration.sql`
- **Seed Data**: `prisma/seeds/<entity>.ts`
- **API Routes**: `app/api/<resource>/route.ts` or `app/api/<resource>/[id]/route.ts`
- **Services**: `lib/services/<name>-service.ts`
- **Repositories**: `lib/repositories/<entity>-repository.ts`
- **Calculations**: `lib/calculations/<name>.ts`
- **Agents**: `lib/agents/<agent-type>/<module>.ts`
- **Integrations**: `lib/integrations/<provider>/<module>.ts`
- **Components**: `components/<feature>/<name>.tsx`
- **Pages**: `app/<route>/page.tsx`
- **Tests**: `tests/<type>/<name>.test.ts` or `tests/<type>/<name>.spec.ts`
- **Supabase Functions**: `supabase/functions/<name>/index.ts`
- **RLS Policies**: `supabase/policies/<table>.sql`

### Testing Requirements

- **Unit Tests**: 80% coverage target for business logic
- **Integration Tests**: All API endpoints, database operations, external integrations
- **E2E Tests**: Critical user flows (onboarding, dashboard load, agent execution)
- **Performance Tests**: Dashboard <3s, calculations <500ms

### Database Migration Workflow

```bash
# 1. Verify Prisma-Supabase connection
npx prisma migrate status

# 2. Create migration
npx prisma migrate dev --name <migration-name>

# 3. Generate Prisma client
npx prisma generate

# 4. Apply RLS policies manually in Supabase dashboard

# 5. Run seed data
npm run db:seed
```

### Agent Development Workflow

```bash
# 1. Implement agent logic in lib/agents/<type>/
# 2. Add audit logging via AgentAuditLogger
# 3. Create Vercel cron or Supabase Edge Function
# 4. Add cron schedule to vercel.json
# 5. Test locally with manual trigger
# 6. Deploy and verify in production
```

---

## Progress Tracking

**Phase 1**: 0/19 tasks complete (0%)
**Phase 2**: 0/23 tasks complete (0%)
**Phase 3**: 0/22 tasks complete (0%)
**Phase 4**: 0/28 tasks complete (0%)
**Phase 5**: 0/12 tasks complete (0%)
**Phase 6**: 0/8 tasks complete (0%)

**Overall**: 0/112 tasks complete (0%)

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] All 4 business type templates seeded
- [ ] Business type selection wizard functional
- [ ] 7-day grace period immutability working
- [ ] RLS policies enforced on new tables

### Phase 2 Success Criteria
- [ ] 10+ paying agency customers
- [ ] $3K-5K MRR achieved
- [ ] 80%+ customer retention
- [ ] Dashboard loads <3s with 10K transactions
- [ ] Margin calculations verified against Excel models

### Phase 3 Success Criteria
- [ ] 3 agents operational (cash flow, categorizer, invoice gen)
- [ ] 5,000+ successful agent executions
- [ ] Zero critical errors (data loss, incorrect calculations)
- [ ] Rollback tested on 10+ executions
- [ ] Telegram alerts within 5 minutes of trigger

### Phase 4 Success Criteria
- [ ] 20+ diverse businesses tested
- [ ] QuickBooks sandbox sync successful
- [ ] Zero data loss in agency customer migration
- [ ] Terminology changes verified in UI
- [ ] Performance maintained (<3s dashboard)

### Phase 5 Success Criteria
- [ ] CPA/accounting partner sign-off on formulas
- [ ] Allocation percentages enforce 100% sum constraint
- [ ] CAP/TAP calculations match manual verification
- [ ] Virtual account balances track accurately
- [ ] Quarterly distribution alerts trigger on schedule

### Phase 6 Success Criteria
- [ ] Hiring thresholds trigger at correct ARR levels
- [ ] TCO calculator includes all cost factors
- [ ] Agent opportunity detector identifies 3+ candidates
- [ ] Seasonal pattern detection working

---

## Risk Mitigation

### High-Risk Tasks

**T078-T084 (Data Migration)**:
- **Risk**: Data loss during agency-to-universal migration
- **Mitigation**: Full database backup, staged rollout, validation queries, rollback plan

**T096-T103 (QuickBooks Integration)**:
- **Risk**: OAuth token expiration, rate limiting
- **Mitigation**: Auto-refresh tokens, 450 req/min buffer, exponential backoff

**T043-T065 (Agent Infrastructure)**:
- **Risk**: Agent execution failures, data corruption
- **Mitigation**: Comprehensive error handling, rollback capability, audit logs

### Rollback Procedures

**Database Migrations**:
```bash
npx prisma migrate resolve --rolled-back <migration-name>
pg_restore -d <database-name> backup.sql
```

**Agent Rollback**:
```bash
POST /api/agents/rollback
{ "rollbackToken": "<token>", "reason": "Data correction" }
```

**Deployment Rollback**:
```bash
vercel rollback
```

---

## Conclusion

This task breakdown provides:
- ✅ 112 actionable tasks across 6 phases
- ✅ Clear file paths for each implementation
- ✅ Parallelizable task groups identified
- ✅ Phase dependencies mapped
- ✅ Success criteria per phase
- ✅ Risk mitigation strategies

**Next Steps**:
1. Review and approve task breakdown
2. Create GitHub project from tasks
3. Assign team members to phases
4. Begin Phase 1: Setup & Foundation

**Estimated Timeline**: 19-28 weeks (Q2 2026 - Q1 2027)
**Estimated Effort**: 680-920 hours
**Team Size**: 1-2 developers
