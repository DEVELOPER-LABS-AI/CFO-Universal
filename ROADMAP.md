# DevLabs CFO - Implementation Roadmap

**Current Status**: Database foundation complete (15-20%)
**Last Updated**: 2026-02-12

---

## 🎯 Prioritization Framework

Features are prioritized based on:
1. **Dependencies**: What must be built first
2. **Business Value**: Impact on user outcomes
3. **Risk Reduction**: Address technical uncertainties early
4. **User Experience**: Build complete user flows

---

## Phase 1: Foundation & Authentication (CRITICAL PATH)
**Goal**: Users can register, log in, and access a protected dashboard
**Duration Estimate**: Foundation for all other features
**Business Value**: ⭐⭐⭐⭐⭐

### 1.1 Next.js App Structure (PREREQUISITE)
**Priority**: 🔴 CRITICAL - Must do first
**Dependencies**: None
**Deliverables**:
- [ ] Create Next.js 16 app directory structure
- [ ] Configure app router and layouts
- [ ] Set up root layout with basic HTML structure
- [ ] Configure TypeScript paths and aliases
- [ ] Install and configure UI library (Tailwind CSS, shadcn/ui recommended)
- [ ] Create basic theme/design system
- [ ] Set up error boundaries
- [ ] Configure middleware structure

**Why First**: Nothing else can be built without the app structure.

---

### 1.2 Authentication System (FOUNDATION)
**Priority**: 🔴 CRITICAL - Build immediately after 1.1
**Dependencies**: 1.1 (App Structure), Database Schema ✅
**Spec**: `specs/2-authentication/spec.md` (Already written)
**Deliverables**:
- [ ] Supabase Auth integration
- [ ] User registration flow with email verification
- [ ] Login page with password authentication
- [ ] Password reset functionality
- [ ] Protected route middleware
- [ ] Session management (JWT)
- [ ] User profile management
- [ ] Organization context management
- [ ] Organization switching (multi-org support)
- [ ] Logout functionality

**Why Second**: All features require authentication. This unblocks everything else.

**Recommended Approach**: Use `/speckit.plan` to generate implementation plan from existing spec.

---

### 1.3 Core Dashboard Shell
**Priority**: 🔴 CRITICAL
**Dependencies**: 1.2 (Authentication)
**Deliverables**:
- [ ] Dashboard layout with navigation
- [ ] Organization selector in header
- [ ] Main navigation menu (Clients, Services, Contractors, Analytics, Settings)
- [ ] Empty state components
- [ ] Loading states
- [ ] Basic dashboard homepage (placeholder metrics)

**Why Third**: Provides the container for all features. Users can log in and see something.

---

## Phase 2: Core Data Management (ESSENTIAL)
**Goal**: Users can manage their core business entities
**Business Value**: ⭐⭐⭐⭐⭐

### 2.1 Client Management
**Priority**: 🟠 HIGH
**Dependencies**: 1.3 (Dashboard Shell)
**Deliverables**:
- [ ] API routes for client CRUD operations
- [ ] Client list page with filtering/sorting
- [ ] Client detail page
- [ ] Add/edit client form
- [ ] Soft delete implementation
- [ ] Client status management (Active/Inactive/Churned)
- [ ] Custom margin target configuration
- [ ] Client search functionality

**Why First in Phase 2**: Clients are the center of the profit model. Everything revolves around them.

---

### 2.2 Service Management
**Priority**: 🟠 HIGH
**Dependencies**: None (can build parallel with 2.1)
**Deliverables**:
- [ ] API routes for service CRUD operations
- [ ] Service list page
- [ ] Add/edit service form
- [ ] Standard rate configuration
- [ ] Target margin settings per service
- [ ] Service activation/deactivation
- [ ] Service templates (optional)

**Why Second**: Services define pricing structure and margin targets.

---

### 2.3 Contractor Management
**Priority**: 🟠 HIGH
**Dependencies**: 2.1 (Clients)
**Deliverables**:
- [ ] API routes for contractor CRUD operations
- [ ] Contractor list page
- [ ] Contractor profile form (rate, engagement type)
- [ ] Contractor assignment to clients
- [ ] Allocation percentage tracking
- [ ] Rate type support (Hourly/Daily/Monthly)
- [ ] Contractor utilization view

**Why Third**: Contractors are key cost drivers affecting margins.

---

## Phase 3: Financial Tracking (CORE VALUE)
**Goal**: Track revenue and expenses for margin calculation
**Business Value**: ⭐⭐⭐⭐⭐

### 3.1 Revenue Tracking
**Priority**: 🟠 HIGH
**Dependencies**: 2.1 (Clients), 2.2 (Services)
**Deliverables**:
- [ ] API routes for revenue record CRUD
- [ ] Revenue entry form (manual)
- [ ] Revenue list with filtering by client/service/date
- [ ] Revenue status tracking (Invoiced/Received)
- [ ] Link revenue to client and service
- [ ] Bulk import from CSV (optional)
- [ ] Revenue dashboard widget

**Why First in Phase 3**: Can't calculate margins without revenue data.

---

### 3.2 Expense Tracking
**Priority**: 🟠 HIGH
**Dependencies**: 2.1 (Clients), 2.3 (Contractors)
**Deliverables**:
- [ ] API routes for expense record CRUD
- [ ] Expense entry form (manual)
- [ ] Expense list with filtering
- [ ] Expense categories (Contractor Cost, Subscription, Tools, etc.)
- [ ] Link expenses to clients and contractors
- [ ] Expense dashboard widget

**Why Second**: Completes the financial picture for margin calculation.

---

### 3.3 Margin Calculation Engine
**Priority**: 🔴 CRITICAL
**Dependencies**: 3.1 (Revenue), 3.2 (Expenses)
**Deliverables**:
- [ ] API endpoint to calculate client margins
- [ ] Real-time margin calculation logic
- [ ] Actual margin vs target margin comparison
- [ ] Company-wide portfolio margin calculation
- [ ] Period-based margin calculations (monthly, quarterly, annual)
- [ ] Margin trend analysis
- [ ] Store calculated metrics in analytics_client_metrics table

**Why Third**: This is the CORE VALUE PROPOSITION of the entire system.

---

## Phase 4: Analytics & Insights (DIFFERENTIATION)
**Goal**: Provide actionable insights and recommendations
**Business Value**: ⭐⭐⭐⭐⭐

### 4.1 Client Analytics Dashboard
**Priority**: 🟡 MEDIUM-HIGH
**Dependencies**: 3.3 (Margin Calculation)
**Deliverables**:
- [ ] Client profitability dashboard
- [ ] Margin performance charts
- [ ] Revenue/cost breakdown visualizations
- [ ] 5-tier client classification (based on margin performance)
- [ ] Trend analysis (improving/declining margins)
- [ ] Client comparison views
- [ ] Top/bottom performers

**Why First in Phase 4**: Turns data into actionable insights.

---

### 4.2 Portfolio Analytics
**Priority**: 🟡 MEDIUM
**Dependencies**: 4.1 (Client Analytics)
**Deliverables**:
- [ ] Company-wide financial dashboard
- [ ] Portfolio margin visualization
- [ ] Client distribution by tier
- [ ] Revenue concentration analysis
- [ ] Cost structure breakdown
- [ ] Period-over-period comparisons
- [ ] Executive summary metrics

---

### 4.3 Pricing Recommendations
**Priority**: 🟡 MEDIUM
**Dependencies**: 4.1 (Client Analytics)
**Deliverables**:
- [ ] Pricing recommendation engine
- [ ] Automated rate adjustment suggestions
- [ ] Margin optimization scenarios
- [ ] What-if analysis tool
- [ ] Pricing strategy templates
- [ ] Recommendation notification system

---

## Phase 5: External Integrations (AUTOMATION)
**Goal**: Automate data collection from accounting and banking systems
**Business Value**: ⭐⭐⭐⭐

### 5.1 Xero Integration
**Priority**: 🟡 MEDIUM
**Dependencies**: 3.1 (Revenue), 3.2 (Expenses)
**Deliverables**:
- [ ] Xero OAuth 2.0 implementation
- [ ] Token storage and refresh logic
- [ ] Sync invoices to revenue_records
- [ ] Sync bills to expense_records
- [ ] Sync contacts to clients
- [ ] Deduplication logic (external_id tracking)
- [ ] Sync status dashboard
- [ ] Error handling and retry logic
- [ ] Sync logs for audit trail

**Why First in Phase 5**: Xero is the primary source of financial data for most agencies.

---

### 5.2 Mercury Bank Integration
**Priority**: 🟡 MEDIUM
**Dependencies**: 3.2 (Expenses)
**Deliverables**:
- [ ] Mercury API key configuration
- [ ] Sync bank transactions to expense_records
- [ ] Transaction categorization logic
- [ ] Bank balance tracking
- [ ] Transaction deduplication
- [ ] Sync status and error handling

---

### 5.3 Slack Notifications (Optional)
**Priority**: 🟢 LOW
**Dependencies**: 4.2 (Portfolio Analytics)
**Deliverables**:
- [ ] Slack OAuth integration
- [ ] Margin alert notifications
- [ ] Daily/weekly summary reports
- [ ] Custom notification rules
- [ ] Notification preferences

---

## Phase 6: Advanced Features (ENHANCEMENT)
**Goal**: Power user features and team collaboration
**Business Value**: ⭐⭐⭐

### 6.1 Financial Targets & Goals
**Priority**: 🟢 LOW-MEDIUM
**Dependencies**: 3.3 (Margin Calculation)
**Deliverables**:
- [ ] Set global margin targets
- [ ] Set service-specific targets
- [ ] Set client-specific targets
- [ ] Target vs actual tracking
- [ ] Goal progress visualization
- [ ] Target notifications

---

### 6.2 Growth Scenarios
**Priority**: 🟢 LOW
**Dependencies**: 4.2 (Portfolio Analytics)
**Deliverables**:
- [ ] Growth scenario creation interface
- [ ] What-if modeling tool
- [ ] Scenario comparison
- [ ] Export scenario reports
- [ ] Save/load scenarios

---

### 6.3 Team & Permissions
**Priority**: 🟢 LOW
**Dependencies**: 1.2 (Authentication)
**Deliverables**:
- [ ] User invitation system
- [ ] Role-based permissions (Owner, Admin, Member)
- [ ] Permission enforcement in API
- [ ] Team member management UI
- [ ] Activity audit log

---

### 6.4 Reports & Exports
**Priority**: 🟢 LOW
**Dependencies**: 4.2 (Portfolio Analytics)
**Deliverables**:
- [ ] PDF report generation
- [ ] CSV export for all entities
- [ ] Custom report builder
- [ ] Scheduled reports (email)
- [ ] Report templates

---

## Phase 7: Polish & Production (LAUNCH PREP)
**Goal**: Production-ready application
**Business Value**: ⭐⭐⭐⭐

### 7.1 Testing
**Priority**: 🟡 MEDIUM
**Dependencies**: All features
**Deliverables**:
- [ ] Unit tests for business logic
- [ ] Integration tests for API routes
- [ ] E2E tests for critical user flows
- [ ] Test coverage > 70%
- [ ] Performance testing
- [ ] Security testing

---

### 7.2 Error Handling & Monitoring
**Priority**: 🟡 MEDIUM
**Dependencies**: All features
**Deliverables**:
- [ ] Global error boundary
- [ ] API error handling standards
- [ ] User-friendly error messages
- [ ] Error logging (Sentry or similar)
- [ ] Performance monitoring
- [ ] Uptime monitoring

---

### 7.3 Documentation & Onboarding
**Priority**: 🟢 LOW-MEDIUM
**Dependencies**: All features
**Deliverables**:
- [ ] User onboarding flow
- [ ] Help documentation
- [ ] Video tutorials
- [ ] In-app help tooltips
- [ ] API documentation (if exposing APIs)
- [ ] Admin documentation

---

### 7.4 Deployment & DevOps
**Priority**: 🟡 MEDIUM
**Dependencies**: All features
**Deliverables**:
- [ ] Vercel production deployment
- [ ] Environment variable management
- [ ] Database migration strategy
- [ ] CI/CD pipeline
- [ ] Backup and recovery plan
- [ ] Monitoring and alerting

---

## 🚀 Recommended Build Order

### Sprint 1-2: Foundation (Weeks 1-4)
1. Next.js app structure (1.1)
2. Authentication system (1.2)
3. Dashboard shell (1.3)

**Milestone**: Users can register, log in, and see an empty dashboard.

---

### Sprint 3-4: Core Data (Weeks 5-8)
4. Client management (2.1)
5. Service management (2.2)
6. Contractor management (2.3)

**Milestone**: Users can manage all core business entities.

---

### Sprint 5-6: Financial Tracking (Weeks 9-12)
7. Revenue tracking (3.1)
8. Expense tracking (3.2)
9. Margin calculation engine (3.3)

**Milestone**: System calculates margins and shows profitability.

---

### Sprint 7-8: Analytics (Weeks 13-16)
10. Client analytics dashboard (4.1)
11. Portfolio analytics (4.2)
12. Pricing recommendations (4.3)

**Milestone**: Users get actionable insights and recommendations.

---

### Sprint 9-10: Integrations (Weeks 17-20)
13. Xero integration (5.1)
14. Mercury integration (5.2)
15. Slack notifications (5.3) - optional

**Milestone**: System automatically syncs financial data.

---

### Sprint 11-12: Enhancement & Polish (Weeks 21-24)
16. Financial targets (6.1)
17. Growth scenarios (6.2)
18. Testing suite (7.1)
19. Error handling (7.2)
20. Production deployment (7.4)

**Milestone**: Production-ready application with automation.

---

## 📊 Progress Tracking

| Phase | Status | Progress | Features Complete |
|-------|--------|----------|-------------------|
| Phase 0: Database | ✅ Complete | 100% | 1/1 |
| Phase 1: Foundation | ⏳ Not Started | 0% | 0/3 |
| Phase 2: Core Data | ⏳ Not Started | 0% | 0/3 |
| Phase 3: Financial | ⏳ Not Started | 0% | 0/3 |
| Phase 4: Analytics | ⏳ Not Started | 0% | 0/3 |
| Phase 5: Integrations | ⏳ Not Started | 0% | 0/3 |
| Phase 6: Advanced | ⏳ Not Started | 0% | 0/4 |
| Phase 7: Polish | ⏳ Not Started | 0% | 0/4 |

**Overall Progress**: 15-20% (Database foundation only)

---

## 🎯 MVP Definition (Minimum Viable Product)

**Goal**: Launch a working profit optimization tool quickly

**Included in MVP**:
- ✅ Phase 1: Foundation & Authentication
- ✅ Phase 2: Core Data Management
- ✅ Phase 3: Financial Tracking
- ✅ Phase 4.1: Client Analytics Dashboard
- ✅ Phase 4.2: Portfolio Analytics

**Not in MVP** (Post-launch):
- ❌ Phase 4.3: Pricing Recommendations
- ❌ Phase 5: External Integrations
- ❌ Phase 6: Advanced Features
- ❌ Phase 7: Full testing/polish

**MVP Timeline**: 12-16 weeks (Sprints 1-8)

---

## 🛠️ Technical Considerations

### UI Library Recommendation
- **Option 1**: Tailwind CSS + shadcn/ui (Recommended)
  - Pros: Modern, customizable, great DX
  - Cons: More initial setup
- **Option 2**: Material-UI (MUI)
  - Pros: Comprehensive, battle-tested
  - Cons: Larger bundle size
- **Option 3**: Chakra UI
  - Pros: Good accessibility, theming
  - Cons: Less adoption than others

### State Management
- **For MVP**: React Context + useState (sufficient)
- **For Scale**: Zustand or Jotai (lightweight, simple)

### Charts/Visualization
- **Recommendation**: Recharts or Chart.js
- **Alternative**: D3.js (if custom visualizations needed)

### Testing
- **Unit**: Vitest (fast, modern)
- **E2E**: Playwright (reliable, maintained)

---

## 📝 Notes

- All API routes should enforce organization-level RLS
- Use Prisma Client from `lib/prisma.ts` for soft delete support
- Store OAuth tokens encrypted using `lib/encryption.ts`
- Follow existing database schema patterns
- Refer to `specs/2-authentication/spec.md` for detailed auth requirements

---

## Next Steps

1. **Immediate**: Start Phase 1.1 (Next.js App Structure)
2. **Use SpecKit workflow**: `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`
3. **Create feature specs** as you go using `/speckit.specify`
4. **Track progress** by updating this roadmap after each phase

---

**Last Updated**: 2026-02-12
**Maintained by**: DevLabs Team
