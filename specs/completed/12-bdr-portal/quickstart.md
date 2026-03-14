# Quickstart: BDR Portal — End-of-Month Reports, Bonus Plans & Expense Reimbursement

**Feature**: 12-bdr-portal
**Date**: 2026-03-03

---

## Prerequisites

1. Feature branch `12-bdr-portal` checked out
2. Database connection verified: `npx prisma migrate status`
3. Supabase project running with Storage enabled
4. `.env` has correct pooler URLs per Constitution Principle #8

---

## Integration Scenarios

### Scenario 1: Admin Creates Pay Plan and Assigns to BDR

**Setup**: Admin user logged in; at least one Staff member with `staff_type = 'BDR'`

**Steps**:
1. Navigate to `/dashboard/bdr/pay-plans`
2. Click "New Pay Plan"
3. Enter: Name = "Q1 2026 Standard", Base Metric = "Meetings Showed", Start = 2026-01-01
4. Add tiers:
   - Tier 1: 1-5 meetings @ $50/meeting
   - Tier 2: 6-10 meetings @ $75/meeting
   - Tier 3: 11+ meetings @ $100/meeting
5. Save plan
6. Assign plan to BDR "John Doe"

**Expected Result**: Pay plan created with 3 tiers; John Doe has active assignment

**Verify**:
- `BDRPayPlan` record exists with `is_active = true`
- 3 `BDRBonusTier` records with correct thresholds
- `BDRPayPlanAssignment` record with `effective_to = NULL`

---

### Scenario 2: BDR Submits Monthly Report

**Setup**: BDR user "John Doe" logged in; assigned to pay plan with tiers above

**Steps**:
1. Navigate to `/bdr-portal/reports`
2. Select current month (March 2026)
3. Enter: Meetings Booked = 15, Meetings Showed = 12
4. Review auto-calculated bonus: (5 x $50) + (5 x $75) + (2 x $100) = $825
5. Add note: "Strong month — closed 3 new accounts"
6. Click "Submit Report"

**Expected Result**: Report submitted with status = SUBMITTED, bonus = $825

**Verify**:
- `BDRMonthlyReport` record: `meetings_booked=15, meetings_showed=12, calculated_bonus=825`
- `bonus_breakdown` JSON contains 3 tier entries
- `status = SUBMITTED`, `submitted_at` is set
- `pay_plan_id` matches assigned plan

---

### Scenario 3: BDR Submits Zero Meetings Report

**Setup**: BDR user logged in with assigned pay plan

**Steps**:
1. Navigate to `/bdr-portal/reports`
2. Enter: Meetings Booked = 0, Meetings Showed = 0
3. Review bonus: $0
4. Submit

**Expected Result**: Report accepted with $0 bonus; not blocked

---

### Scenario 4: Admin Reviews and Approves Report

**Setup**: Admin logged in; BDR has submitted report for March 2026

**Steps**:
1. Navigate to `/dashboard/bdr/reports`
2. View submitted reports for March 2026
3. Click on John Doe's report
4. Review: 12 meetings showed, $825 bonus, tier breakdown
5. Click "Approve"

**Expected Result**: Report status = APPROVED, `approved_at` set, `approved_by` = admin user ID

---

### Scenario 5: Admin Flags Report for Correction

**Setup**: Admin logged in; BDR has submitted report

**Steps**:
1. View submitted report
2. Click "Needs Correction"
3. Enter feedback: "Please verify meetings showed count — CRM shows 10, not 12"
4. Save

**Expected Result**: Report status = NEEDS_CORRECTION, `admin_notes` saved

**BDR Flow**:
1. BDR logs in, sees report flagged with admin notes
2. Corrects meetings showed to 10
3. Bonus recalculates: (5 x $50) + (5 x $75) = $625
4. Re-submits → status back to SUBMITTED

---

### Scenario 6: BDR Submits Expense with Receipt

**Setup**: BDR logged in; expense categories configured (Travel, Meals, Software)

**Steps**:
1. Navigate to `/bdr-portal/expenses`
2. Click "New Expense"
3. Enter: Date = 2026-03-01, Category = Travel, Amount = $150.00, Description = "Client meeting - downtown parking"
4. Upload receipt: parking_receipt.pdf (2MB)
5. Submit

**Expected Result**: Expense created with status = SUBMITTED, receipt uploaded to Supabase Storage

**Verify**:
- `BDRExpenseClaim` record with `has_receipt = true`
- `receipt_path = bdr-receipts/{org_id}/{staff_id}/{expense_id}/{uuid}-parking_receipt.pdf`
- File exists in Supabase Storage bucket

---

### Scenario 7: Expense Without Receipt

**Steps**:
1. Submit expense without uploading a receipt

**Expected Result**: Expense accepted but `has_receipt = false` — flagged in admin queue

---

### Scenario 8: Admin Approves/Rejects Expenses

**Setup**: Admin logged in; pending expenses exist

**Approve flow**:
1. Navigate to `/dashboard/bdr/expenses`
2. View pending expenses
3. Click receipt to preview (signed URL)
4. Click "Approve"
5. Result: status = APPROVED

**Reject flow**:
1. Click "Reject"
2. Enter reason: "Personal expense — not eligible for reimbursement"
3. Result: status = REJECTED, `admin_notes` = rejection reason

---

### Scenario 9: Compensation Dashboard

**Setup**: Admin logged in; multiple BDRs with approved reports and expenses for March 2026

**Steps**:
1. Navigate to `/dashboard/bdr`
2. View monthly summary for March 2026:
   - Total Bonuses: $2,450
   - Total Expenses Approved: $680
   - Grand Total: $3,130
3. View per-BDR breakdown
4. Switch month to February 2026 for comparison

**Expected Result**: Dashboard shows accurate totals matching approved reports and expenses

---

### Scenario 10: File Upload Validation

**Steps**:
1. Try uploading a file > 10MB → Error: "File size exceeds 10 MB"
2. Try uploading a .exe file → Error: "File type not allowed"
3. Try uploading a valid 5MB PDF → Success

---

## Bonus Calculation Test Cases

| Meetings Showed | Tiers | Expected Bonus | Breakdown |
|----------------|-------|----------------|-----------|
| 0 | [1-5@$50, 6-10@$75, 11+@$100] | $0 | No tiers hit |
| 3 | [1-5@$50, 6-10@$75, 11+@$100] | $150 | 3 x $50 |
| 5 | [1-5@$50, 6-10@$75, 11+@$100] | $250 | 5 x $50 |
| 8 | [1-5@$50, 6-10@$75, 11+@$100] | $475 | (5x$50) + (3x$75) |
| 10 | [1-5@$50, 6-10@$75, 11+@$100] | $625 | (5x$50) + (5x$75) |
| 12 | [1-5@$50, 6-10@$75, 11+@$100] | $825 | (5x$50) + (5x$75) + (2x$100) |
| 25 | [1-5@$50, 6-10@$75, 11+@$100] | $2,125 | (5x$50) + (5x$75) + (15x$100) |
| 1 | [1+@$100] | $100 | Single tier, 1 meeting |
| 10 | [1+@$100] | $1,000 | Single tier, 10 meetings |
