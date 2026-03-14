# Quickstart: Cap Table MVP

**Created**: 2026-03-03
**Feature**: [spec.md](spec.md)

---

## Prerequisites

- Node.js 18+
- Supabase project with pooler URLs configured
- `.env` with `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Feature branch: `11-cap-table`

## Setup Steps

### 1. Verify Database Connection

```bash
npx prisma migrate status
```

### 2. Add Environment Variable

Add to `.env`:
```
CAP_TABLE_SHARE_SECRET=<generate-a-random-64-char-hex-string>
```

Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Apply Schema Migration

```bash
npx prisma migrate dev --name add-cap-table
npx prisma generate
npx prisma migrate status
```

### 4. Apply RLS Policies

Run the SQL in `supabase/sql/011_cap_table_rls_policies.sql` via Supabase dashboard or migration.

### 5. Start Development

```bash
npm run dev
```

Navigate to `/dashboard/cap-table` (requires Admin or Executive role).

## Verification Checklist

- [ ] Database connection verified with `npx prisma migrate status`
- [ ] 4 new tables created: `cap_table_stakeholders`, `cap_table_share_classes`, `cap_table_equity_holdings`, `cap_table_equity_transactions`
- [ ] 1 new enum created: `EquityTransactionType`
- [ ] RLS policies applied to all 4 tables
- [ ] `CAP_TABLE_SHARE_SECRET` set in `.env`
- [ ] Cap Table page accessible at `/dashboard/cap-table`
- [ ] Can create a share class (Common)
- [ ] Can add 3 stakeholders
- [ ] Can record GRANT transactions
- [ ] Ownership percentages sum to 100%
- [ ] Pie chart renders ownership distribution
- [ ] Transaction history shows all recorded events
- [ ] Shareable link generates and opens read-only view
- [ ] Print-to-PDF produces clean output

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | EquityTransactionType enum + 4 new models |
| `app/actions/cap-table.ts` | Server actions for all cap table CRUD |
| `lib/validations/cap-table.ts` | Zod schemas for cap table inputs |
| `lib/calculations/cap-table.ts` | Ownership calculation, point-in-time replay |
| `lib/cap-table/share-token.ts` | HMAC token generation and validation |
| `app/dashboard/cap-table/page.tsx` | Main cap table dashboard page |
| `app/share/cap-table/[token]/page.tsx` | Public shared view page |
| `app/api/share/cap-table/[token]/route.ts` | Public API for token validation + data |
| `components/cap-table/OwnershipTable.tsx` | Stakeholder summary table |
| `components/cap-table/OwnershipChart.tsx` | Pie/donut chart (Recharts) |
| `components/cap-table/TransactionLedger.tsx` | Transaction history table |
| `components/cap-table/AddStakeholderModal.tsx` | Create/edit stakeholder form |
| `components/cap-table/RecordTransactionModal.tsx` | Record equity transaction form |
| `components/cap-table/ShareClassConfig.tsx` | Share class management |
| `components/cap-table/ShareLinkDialog.tsx` | Generate shareable link dialog |
| `supabase/sql/011_cap_table_rls_policies.sql` | RLS policies for cap table tables |

## Rollback

To rollback the schema migration:
```bash
npx prisma migrate resolve --rolled-back add-cap-table
```

Then manually drop the tables and enum if needed via Supabase SQL editor.
