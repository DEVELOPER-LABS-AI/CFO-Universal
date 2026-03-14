# Quickstart: Agency Staff True Cost & Markup Transparency

**Feature**: 14-agency-markup-margins
**Branch**: `14-agency-markup-margins`

---

## Prerequisites

1. Verify database connection:
   ```bash
   npx prisma migrate status
   ```

2. Verify `.env` has pooler URLs (not direct db URLs):
   ```bash
   grep "pooler.supabase.com" .env
   ```

3. Ensure on correct branch:
   ```bash
   git branch --show-current  # Should show: 14-agency-markup-margins
   ```

---

## Implementation Order

### Phase 1: Data Layer
1. **Prisma Schema** — Add enums (`MarkupType`, `MarkupBasis`) and new fields to `Agency` and `Staff` models
2. **Migration** — `npx prisma migrate dev --name add-agency-markup-fields`
3. **Prisma Generate** — `npx prisma generate`
4. **Zod Schemas** — Extend validation schemas in `lib/validations/agency.ts` and `lib/validations/staff.ts`

### Phase 2: Calculation Logic
5. **Markup Calculations** — Create `lib/calculations/markup-calculations.ts` with `calculateBillRate()`, `calculateMargin()`, `getEffectiveMarkup()`
6. **Unit Tests** — Test all calculation edge cases (percentage, flat rate, rate conversions, zero markup, negative margin)

### Phase 3: Server Actions
7. **updateAgency** — Extend to accept/validate markup fields
8. **createStaff** — Extend to accept true_cost, auto-calculate bill rate
9. **updateStaff** — Extend to handle true_cost changes and rate lock
10. **createAgencyMonthlyBreakdown** — Extend JSONB structure with true_cost per staff item

### Phase 4: UI Components
11. **EditAgencyModal** — Add markup configuration section (type, value, basis)
12. **AddStaffModal** — Add true cost field (conditional on agency association), show calculated bill rate
13. **EditStaffModal** — Add true cost editing, markup override, rate lock toggle
14. **AddBreakdownModal** — Add true_cost column to staff line items
15. **Staff Detail Page** — Add margin display card
16. **Agency Detail Page** — Add per-staff margin breakdown
17. **Agencies Dashboard** — Add aggregate margin metrics cards

### Phase 5: Access Control
18. **Agency Portal** — Verify true cost/margin data is excluded from agency admin views
19. **Field Stripping** — Ensure agency portal actions don't return sensitive markup data

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add MarkupType, MarkupBasis enums; add fields to Agency, Staff |
| `lib/validations/agency.ts` | Extend createAgencySchema, updateAgencySchema, staffBreakdownItemSchema |
| `lib/validations/staff.ts` | Extend createStaffSchema, updateStaffSchema |
| `lib/calculations/markup-calculations.ts` | **NEW** — calculateBillRate, calculateMargin, getEffectiveMarkup |
| `app/actions/agency-management.ts` | Extend updateAgency, createAgencyMonthlyBreakdown |
| `app/actions/staff-management.ts` | Extend createStaff, updateStaff |
| `components/agencies/EditAgencyModal.tsx` | Add markup config section |
| `components/staff/AddStaffModal.tsx` | Add true cost field, bill rate preview |
| `components/staff/EditStaffModal.tsx` | Add true cost, markup override, rate lock |
| `components/agencies/AddBreakdownModal.tsx` | Add true_cost column |
| `app/dashboard/staff/[id]/page.tsx` | Add margin display |
| `app/dashboard/agencies/[id]/page.tsx` | Add per-staff margin table |
| `app/dashboard/agencies/page.tsx` | Add aggregate margin metrics |

---

## Testing Checklist

- [ ] Create agency with markup (percentage + base pay)
- [ ] Create agency with markup (percentage + total compensation)
- [ ] Create agency with markup (flat rate)
- [ ] Create agency staff with true cost → verify bill rate auto-calculated
- [ ] Override staff markup → verify bill rate recalculated
- [ ] Lock staff rate → verify rate unchanged on markup change
- [ ] Unlock staff rate → verify rate recalculated
- [ ] Zero markup → verify bill rate = true cost
- [ ] Negative margin → verify warning displayed
- [ ] Existing staff without true cost → verify "N/A" margin display
- [ ] Agency portal login → verify no true cost/margin visibility
- [ ] Monthly breakdown with true cost → verify margin per line item
- [ ] Dashboard aggregate margins → verify correct totals
