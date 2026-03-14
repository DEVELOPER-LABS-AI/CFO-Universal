# Quickstart: CFO Strategist

**Created**: 2026-02-27
**Feature**: [spec.md](spec.md)

---

## Prerequisites

- Node.js 18+
- Existing Mercury and/or Xero integration connected
- At least 1 month of synced financial data (2+ months recommended for trend analysis)
- `.env` with correct Supabase pooler URLs (per Constitution Principle #8)

## Setup Steps

### 1. Verify Database Connection

```bash
npx prisma migrate status
```

### 2. Apply Schema Migration

```bash
npx prisma migrate dev --name add_cfo_strategist_models
```

This creates:
- `CfoRecommendation` table with composite unique constraint
- `CfoReport` table with period uniqueness
- `CfoRecommendationCategory` enum
- `CfoRecommendationStatus` enum
- `CfoReportType` enum
- Relations on `Organization`

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Add Cron Secret (if not already set)

Ensure `CRON_SECRET` environment variable is set in Vercel dashboard (already used by existing Mercury/Xero crons).

### 5. Deploy Cron Job

Add to `vercel.json`:
```json
{
  "path": "/api/cron/cfo-strategist",
  "schedule": "0 3 * * *"
}
```

## Key File Locations

| Component | Path |
|-----------|------|
| Recommendation engine | `lib/cfo-strategist/recommendation-engine.ts` |
| Subscription analyzer | `lib/cfo-strategist/analyzers/subscription-analyzer.ts` |
| Staffing analyzer | `lib/cfo-strategist/analyzers/staffing-analyzer.ts` |
| Revenue analyzer | `lib/cfo-strategist/analyzers/revenue-analyzer.ts` |
| Overhead analyzer | `lib/cfo-strategist/analyzers/overhead-analyzer.ts` |
| Report generator | `lib/cfo-strategist/report-generator.ts` |
| Margin goal resolver | `lib/cfo-strategist/margin-goals.ts` |
| Server actions | `app/actions/cfo-strategist.ts` |
| Dashboard page | `app/dashboard/strategist/page.tsx` |
| Recommendations page | `app/dashboard/strategist/recommendations/page.tsx` |
| Reports page | `app/dashboard/strategist/reports/page.tsx` |
| Report detail page | `app/dashboard/strategist/reports/[id]/page.tsx` |
| Cron endpoint | `app/api/cron/cfo-strategist/route.ts` |
| Settings component | `components/settings/MarginGoalSettings.tsx` |
| Dashboard components | `components/cfo-strategist/` |

## Testing

```bash
# Run unit tests for recommendation engine
npx jest lib/cfo-strategist/ --verbose

# Run E2E test for dashboard
npx playwright test tests/cfo-strategist/

# Test cron endpoint locally
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/cfo-strategist
```

## Rollback Procedure

If schema changes need to be reverted:

```bash
# 1. Check current migration status
npx prisma migrate status

# 2. Revert the migration
npx prisma migrate resolve --rolled-back add_cfo_strategist_models

# 3. Remove new tables manually if needed
# (Use Supabase SQL editor - never drop tables without backup)
```
