# Feature Specification: CFO Strategist

**Status**: Draft
**Created**: 2026-02-27
**Last Updated**: 2026-02-27

---

## Overview

### Feature Summary

The CFO Strategist is an intelligent financial advisory system that analyzes historical revenue, expenses, and margin data to provide actionable recommendations for maintaining and improving profit margins. It delivers daily, weekly, and monthly guidance on cost optimization, staffing efficiency, and revenue growth, acting as an always-on virtual CFO.

### Business Value

The business currently lacks forward-looking financial intelligence. While the platform tracks historical margins and ROI per client, there is no system that proactively identifies margin risks, recommends cost-cutting actions, or forecasts the impact of financial decisions. This feature transforms the platform from a reactive reporting tool into a proactive financial strategy partner, helping the business maintain healthy margins and make data-driven decisions before problems escalate.

### Target Users

- **Primary**: Business owner / CEO who needs strategic financial guidance to maintain profitability
- **Secondary**: Operations managers who execute cost optimization decisions (staffing changes, subscription management)

---

## User Scenarios

### Primary Use Cases

**Scenario 1: Setting Margin Goals**
- **Actor**: Business owner
- **Goal**: Define target profit margins to guide the strategist's recommendations
- **Steps**:
  1. Navigate to Settings
  2. Set a company-wide target margin percentage (e.g., 30%)
  3. Optionally set per-client margin targets that override the company default
  4. Save the configuration
- **Expected Outcome**: The strategist uses these targets as benchmarks, flagging clients and categories that fall below target and prioritizing recommendations accordingly

**Scenario 2: Reviewing Daily Recommendations**
- **Actor**: Business owner
- **Goal**: Quickly understand what actions to take today to protect margins
- **Steps**:
  1. Open the CFO Strategist dashboard
  2. View the daily briefing showing current margin vs target
  3. Review prioritized action items (sorted by financial impact)
  4. Drill into a specific recommendation to see supporting data
  5. Mark recommendations as acted on, dismissed, or deferred
- **Expected Outcome**: The owner has a clear, prioritized list of 3-5 high-impact actions they can take immediately

**Scenario 3: Monthly Strategic Report**
- **Actor**: Business owner
- **Goal**: Review the month's financial performance and plan for next month
- **Steps**:
  1. Access the monthly report from the CFO Strategist
  2. Review margin trends over the past 3-6 months
  3. See which recommendations were acted on and their measured impact
  4. Review forecasted margins for next month based on current trajectory
  5. Examine category-by-category cost analysis with optimization suggestions
- **Expected Outcome**: A comprehensive financial health report with forward-looking guidance for the next month

**Scenario 4: Subscription Optimization Review**
- **Actor**: Business owner or operations manager
- **Goal**: Identify subscription costs that can be reduced or eliminated
- **Steps**:
  1. View the subscription optimization section
  2. See subscriptions ranked by cost with utilization indicators
  3. Review recommendations (cancel unused, downgrade underutilized, consolidate overlapping)
  4. See projected monthly savings for each recommendation
- **Expected Outcome**: Clear visibility into subscription waste with specific dollar savings per action

**Scenario 5: Staffing Efficiency Analysis**
- **Actor**: Business owner
- **Goal**: Understand if staffing costs are aligned with revenue generation
- **Steps**:
  1. View the staffing recommendations section
  2. See contractor/staff utilization rates across clients
  3. Review cost-per-revenue analysis for each team member
  4. See recommendations for reallocation, rate renegotiation, or headcount changes
  5. View projected margin impact of each staffing change
- **Expected Outcome**: Data-driven staffing decisions that improve margins without sacrificing delivery quality

### Edge Cases

- **Insufficient Historical Data**: When fewer than 2 months of data exist, the system should clearly indicate that forecasts are limited and recommendations are based on incomplete trends. It should still provide what analysis it can based on available data.
- **Zero Revenue Periods**: Some months may have no revenue for certain clients (e.g., project gaps). The system should distinguish between expected gaps and concerning revenue drops.
- **New Clients**: Clients with less than one month of data should be flagged separately and excluded from trend analysis until sufficient data accumulates.
- **Seasonal Variations**: The system should account for known seasonal patterns (e.g., year-end slowdowns) and not over-react to predictable cyclical changes.
- **Conflicting Recommendations**: When a cost-cutting recommendation (e.g., reduce contractor hours) conflicts with revenue generation (e.g., that contractor serves a key client), the system should flag the trade-off explicitly.

---

## Functional Requirements

### Core Requirements

**FR-1: Margin Goal Configuration**
- **Description**: Users can set target profit margin percentages at the company level and optionally per-client, which serve as benchmarks for all recommendations and alerts.
- **Acceptance Criteria**:
  - [ ] Company-wide target margin can be set as a percentage (0-100%) in Settings
  - [ ] Per-client margin targets can be set that override the company default
  - [ ] Changes to margin targets immediately reflect in the strategist's analysis
  - [ ] Default company margin target is pre-set to 25% if no target is configured
  - [ ] Service-level margin targets (already existing) are incorporated into analysis

**FR-2: Financial Health Dashboard**
- **Description**: A dedicated dashboard view under the "Insights" sidebar group (alongside Analytics) showing current financial health at a glance with margin performance against targets, trend indicators, and a summary of active recommendations.
- **Acceptance Criteria**:
  - [ ] Dashboard displays current overall margin vs target margin
  - [ ] Visual indicator shows whether margins are improving, stable, or declining (compared to prior period)
  - [ ] Summary count of active recommendations by category (subscriptions, staffing, revenue, overhead)
  - [ ] Margin trend chart showing the last 6 months with target line overlay
  - [ ] Projected margin for next month based on current trajectory
  - [ ] Top 3 highest-impact recommendations are surfaced prominently
  - [ ] Per-client margin breakdown with color-coded status (above target, near target, below target)

**FR-3: Recommendation Engine**
- **Description**: The system analyzes financial data across all categories (subscriptions, staffing, overhead, revenue) and generates prioritized, actionable recommendations sorted by estimated financial impact.
- **Acceptance Criteria**:
  - [ ] Recommendations are generated across these categories: subscription optimization, staffing efficiency, revenue opportunities, overhead reduction
  - [ ] Each recommendation includes: title, description, category, estimated monthly savings/impact in dollars, confidence level, supporting data points
  - [ ] Recommendations are sorted by estimated financial impact (highest savings first)
  - [ ] Users can mark recommendations as: acted on, dismissed (with reason), or deferred (with date)
  - [ ] Dismissed recommendations do not reappear unless the underlying metric changes by 15% or more from its value at dismissal time
  - [ ] Deferred recommendations automatically reactivate and reappear in the active list when their deferred date arrives
  - [ ] Recommendations are pre-computed nightly after Mercury/Xero data sync completes, and cached for instant dashboard loading
  - [ ] Users can trigger a manual refresh from the dashboard to recompute recommendations on-demand with the latest data

**FR-4: Subscription Optimization Recommendations**
- **Description**: Analyze all active subscriptions to identify cost-saving opportunities based on allocation patterns, cost trends, and utilization indicators.
- **Acceptance Criteria**:
  - [ ] Identifies subscriptions with zero or very low allocation to any client (potential waste)
  - [ ] Flags subscriptions with costs increasing month-over-month above a threshold (10%+)
  - [ ] Identifies subscriptions with similar names or functions that could be consolidated
  - [ ] Calculates total potential monthly savings from all subscription recommendations
  - [ ] Shows subscription cost as a percentage of total expenses for context

**FR-5: Staffing Efficiency Recommendations**
- **Description**: Analyze contractor and staff costs relative to the revenue they generate, identifying underutilization, over-allocation, and cost optimization opportunities.
- **Acceptance Criteria**:
  - [ ] Identifies contractors/staff with low utilization (allocated to few or no active clients)
  - [ ] Compares contractor cost-to-revenue ratio against company average, flagging outliers
  - [ ] Identifies clients where contractor costs exceed revenue (negative margin contributors)
  - [ ] Suggests reallocation of underutilized team members to higher-need clients
  - [ ] Calculates potential savings from each staffing recommendation
  - [ ] Distinguishes between full-time, part-time, and project-based engagements in analysis

**FR-6: Revenue Opportunity Identification**
- **Description**: Analyze revenue patterns to identify growth opportunities such as under-priced clients, upsell candidates, and clients at risk of churn.
- **Acceptance Criteria**:
  - [ ] Identifies clients whose margins are 10+ percentage points below their target despite healthy revenue
  - [ ] Flags clients with declining revenue trends over the last 3+ months
  - [ ] Identifies clients with high margins that could absorb additional services (upsell candidates)
  - [ ] Highlights services that are underpriced relative to the cost to deliver them
  - [ ] Calculates the revenue increase needed from each underperforming client to meet margin targets

**FR-7: Periodic Reports (Daily, Weekly, Monthly)**
- **Description**: Generate structured reports at different cadences, each with appropriate detail level and focus areas.
- **Acceptance Criteria**:
  - [ ] **Daily Briefing**: Current margin snapshot, any new alerts or threshold breaches, top 3 priority actions
  - [ ] **Weekly Summary**: Margin trend for the week, progress on acted-upon recommendations, new recommendations generated, cost category breakdown changes
  - [ ] **Monthly Report**: Full financial health analysis, month-over-month comparisons, recommendation effectiveness review (acted vs impact), forecast for next month, category-by-category deep dive
  - [ ] Reports are accessible from the CFO Strategist section under the "Insights" navigation group
  - [ ] Users can view current and historical reports

**FR-8: Margin Trend Tracking & Alerts**
- **Description**: Continuously track margin trends and proactively alert the user when margins are declining or at risk of falling below target.
- **Acceptance Criteria**:
  - [ ] Tracks company-wide margin on a monthly basis with historical comparison
  - [ ] Alerts when current margin drops below the target threshold
  - [ ] Alerts when margin trend shows 2+ consecutive months of decline
  - [ ] Alerts when a specific client's margin drops below their target (or company default)
  - [ ] Alerts are visible in the notification system and on the CFO Strategist dashboard
  - [ ] Each alert includes context (what changed) and a linked recommendation

**FR-9: Recommendation Impact Tracking**
- **Description**: When recommendations are acted upon, track whether the expected financial impact materialized, creating a feedback loop for recommendation quality.
- **Acceptance Criteria**:
  - [ ] When a recommendation is marked as "acted on," record the date and expected savings
  - [ ] In subsequent periods, compare actual costs/margins to the pre-action baseline
  - [ ] Display realized vs expected savings in the monthly report
  - [ ] Overall recommendation accuracy score visible on the dashboard (percentage of recommendations that delivered expected or better results)

### Data Requirements

**DR-1: Recommendation Record**
- **Description**: Store each generated recommendation with its metadata, status, and impact tracking data
- **Key Attributes**: title, description, category, target_entity_type, target_entity_id, estimated_monthly_impact, confidence_level, status (active/acted_on/dismissed/deferred), supporting_data, created_date, acted_on_date, dismissed_reason, deferred_until_date, dismissed_metric_snapshot
- **Identity Rule**: A recommendation is uniquely identified by its category + target entity (e.g., "subscription_optimization" + subscription ID). During nightly recomputation, existing recommendations matching this identity key preserve their status (dismissed/deferred/acted_on) rather than being recreated as new.
- **Validation Rules**: estimated_monthly_impact must be a positive number; confidence_level must be between 0 and 1; status transitions must follow valid paths (active -> acted_on/dismissed/deferred)

**DR-2: Margin Goal Configuration**
- **Description**: Store company-wide and per-client margin targets
- **Key Attributes**: company_target_margin (percentage), per-client overrides (linked to existing client margin targets)
- **Validation Rules**: Target margin must be between 0 and 100; per-client targets are optional and override company default

**DR-3: Periodic Report Snapshot**
- **Description**: Store generated reports for historical access and comparison
- **Key Attributes**: report_type (daily/weekly/monthly), period_start, period_end, margin_actual, margin_target, recommendations_count, recommendations_acted_count, total_potential_savings, report_content
- **Validation Rules**: One report per type per period; report_content stores the structured data used to render the report

---

## Success Criteria

### Measurable Outcomes

- [ ] **Visibility**: Users can see their current margin vs target within 2 clicks from the main dashboard
- [ ] **Actionability**: Each recommendation includes a specific dollar impact estimate, enabling informed decision-making
- [ ] **Coverage**: The system generates recommendations across all 4 cost categories (subscriptions, staffing, revenue, overhead) every month
- [ ] **Timeliness**: Daily briefings are available by the start of each business day; weekly and monthly reports are available within the first day of each new period
- [ ] **Tracking**: Users can track which recommendations they acted on and see whether the expected savings materialized within 2 months
- [ ] **Business Impact**: Within 3 months of use, the system identifies at least 10% of expenses as optimization opportunities
- [ ] **User Engagement**: Business owner reviews the CFO Strategist dashboard at least 3 times per week

---

## Dependencies

### External Dependencies

- Mercury banking integration (for actual expense and deposit data)
- Xero accounting integration (for invoice and expense data)

### Internal Dependencies

- Client ROI calculation engine (provides margin and cost data per client)
- BDR ROI calculation engine (provides staffing efficiency data)
- Overhead allocation system (provides overhead cost distribution)
- Subscription management module (provides subscription cost and allocation data)
- Contractor and staff assignment data (provides utilization and cost data)
- Existing notification system (for delivering alerts)

---

## Assumptions

- Historical financial data from Mercury and/or Xero is available for at least 2 months to generate meaningful trend analysis and forecasts
- The existing Client ROI calculation logic is accurate and can be relied upon as a data source for the strategist
- Margin targets are set manually by the user; the system does not auto-suggest initial target values (though it may suggest adjustments over time)
- Recommendations are advisory only; the system does not automatically execute changes (e.g., it will not cancel a subscription, only recommend cancellation)
- The existing per-client `custom_margin_target` field in the database will be reused for client-level margin goals
- Forecasting is based on linear trend analysis of recent historical data; advanced predictive models are out of scope for the initial version
- All financial amounts are in USD

---

## Out of Scope

- Automated execution of recommendations (e.g., auto-cancelling subscriptions or auto-adjusting contractor rates)
- Integration with external forecasting or budgeting tools
- Machine learning or AI-powered predictive models (initial version uses rule-based analysis and linear trends)
- Tax planning or tax optimization recommendations
- Multi-currency support
- Cash flow forecasting beyond simple trend-based projections
- Scenario modeling ("what-if" analysis) for proposed changes
- Email or SMS delivery of reports (reports are in-app only)
- Approval workflows for acting on recommendations

---

## Clarifications

### Session 2026-02-27

- Q: Are recommendations computed on a schedule, on-demand, or hybrid? → A: Hybrid - pre-computed nightly after data sync, with manual refresh available on-demand from the dashboard.
- Q: What quantifies "significantly" for dismissed recommendation reactivation and below-target flagging? → A: 15% metric change reactivates dismissed recommendations; 10+ percentage points below target flags a client.
- Q: What happens when a deferred recommendation's date arrives? → A: Auto-reactivate on deferred date; reappear in the active recommendations list.
- Q: Where does the CFO Strategist sit in sidebar navigation? → A: Under the existing "Insights" group alongside Analytics.
- Q: How are recommendations deduplicated across nightly recomputations? → A: By category + target entity ID (e.g., "subscription_optimization" + subscription ID). Same identity preserves existing status.

---

## Security & Privacy Considerations

- **Data Privacy**: All financial data used by the strategist is already within the platform; no new external data sources are introduced
- **Access Control**: CFO Strategist features should respect the existing role-based access control; only authorized users (business owner, admin) should view financial recommendations and reports
- **Data Sensitivity**: Staffing recommendations (e.g., suggesting to reduce headcount) contain sensitive information and should be visible only to users with appropriate permissions

---

## Future Enhancements

- AI/ML-powered predictive models for more accurate forecasting and anomaly detection
- Scenario modeling ("what-if" analysis) to simulate the impact of proposed changes before acting
- Automated weekly email digest of the CFO Strategist briefing
- Cash flow runway analysis (how many months of runway at current burn rate)
- Integration with budgeting tools for budget vs actual comparison
- Client health scoring with churn prediction
- Pricing optimization recommendations based on market data and margin analysis
- Multi-company or multi-entity support for businesses with multiple brands
