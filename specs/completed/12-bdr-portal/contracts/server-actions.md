# Server Action Contracts: BDR Portal

**Feature**: 12-bdr-portal
**Date**: 2026-03-03

---

## BDR Portal Actions (`app/actions/bdr-portal-actions.ts`)

### `getBDRDashboard()`

**Auth**: `requireBDR()`
**Input**: None
**Output**:
```typescript
{
  success: true,
  data: {
    bdr: { id: string; name: string; staffType: string };
    currentPayPlan: {
      id: string;
      name: string;
      baseMetric: 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED';
      tiers: { minThreshold: number; maxThreshold: number | null; payoutRate: number; sortOrder: number }[];
    } | null;
    currentReport: {
      id: string;
      month: number;
      year: number;
      meetingsBooked: number;
      meetingsShowed: number;
      calculatedBonus: number;
      status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_CORRECTION';
    } | null;
    recentExpenses: {
      id: string;
      expenseDate: string;
      category: string;
      amount: number;
      status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
    }[];
    monthlyStats: {
      totalBonus: number;
      totalExpensesApproved: number;
      totalExpensesPending: number;
    };
  }
} | { success: false, error: string }
```

---

### `getBDRMonthlyReport(input)`

**Auth**: `requireBDR()`
**Input** (Zod: `getBDRReportSchema`):
```typescript
{
  month: number;  // 1-12
  year: number;   // 2000-2100
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    report: {
      id: string;
      month: number;
      year: number;
      meetingsBooked: number;
      meetingsShowed: number;
      calculatedBonus: number;
      bonusBreakdown: { tierName: string; meetingsInRange: number; rate: number; subtotal: number }[];
      status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_CORRECTION';
      notes: string | null;
      adminNotes: string | null;
      submittedAt: string | null;
      approvedAt: string | null;
    } | null;  // null if no report for that month yet
    payPlan: { ... } | null;
  }
} | { success: false, error: string }
```

---

### `saveBDRReport(input)`

**Auth**: `requireBDR()`
**Input** (Zod: `saveBDRReportSchema`):
```typescript
{
  month: number;           // 1-12
  year: number;            // 2000-2100
  meetings_booked: number; // >= 0
  meetings_showed: number; // >= 0
  notes?: string;          // max 1000 chars
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    id: string;
    calculatedBonus: number;
    bonusBreakdown: { tierName: string; meetingsInRange: number; rate: number; subtotal: number }[];
    status: 'DRAFT';
  }
} | { success: false, error: string }
```
**Logic**:
- Upserts report for (staff_id, month, year)
- Only allowed if status is DRAFT or NEEDS_CORRECTION
- Auto-calculates bonus using assigned pay plan tiers
- Stores bonus breakdown as JSON
- Does NOT change status (stays DRAFT or NEEDS_CORRECTION)

---

### `submitBDRReport(input)`

**Auth**: `requireBDR()`
**Input** (Zod: `submitBDRReportSchema`):
```typescript
{
  report_id: string;  // UUID
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'SUBMITTED'; submittedAt: string }
} | { success: false, error: string }
```
**Logic**:
- Validates report belongs to authenticated BDR
- Validates status is DRAFT or NEEDS_CORRECTION
- Transitions status → SUBMITTED
- Sets `submitted_at` timestamp
- Snapshots current pay_plan_id

---

### `getBDRExpenses(input)`

**Auth**: `requireBDR()`
**Input** (Zod: `getBDRExpensesSchema`):
```typescript
{
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
  page?: number;    // default 1
  pageSize?: number; // default 20, max 50
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    expenses: {
      id: string;
      expenseDate: string;
      category: { id: string; name: string };
      amount: number;
      description: string | null;
      hasReceipt: boolean;
      status: string;
      adminNotes: string | null;
      createdAt: string;
    }[];
    total: number;
    page: number;
    pageSize: number;
  }
} | { success: false, error: string }
```

---

### `createBDRExpense(formData)`

**Auth**: `requireBDR()`
**Input** (FormData — matches `createBDRExpenseSchema` + optional file):
```typescript
FormData {
  expense_date: string;   // ISO date, not in future
  category_id: string;    // UUID
  amount: string;         // positive number (string from form)
  description?: string;   // max 500 chars
  receipt?: File;          // max 10MB, PDF/JPG/PNG
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'SUBMITTED'; hasReceipt: boolean }
} | { success: false, error: string }
```
**Logic**:
- Validates category exists and belongs to org
- If receipt file provided: validates size/type, uploads to Supabase Storage `bdr-receipts` bucket
- Creates BDRExpenseClaim with status SUBMITTED
- Sets `has_receipt` flag

---

### `getExpenseCategories()`

**Auth**: `requireBDR()` or `requireAuth()`
**Input**: None
**Output**:
```typescript
{
  success: true,
  data: { id: string; name: string; description: string | null }[]
} | { success: false, error: string }
```

---

### `getReceiptUrl(input)`

**Auth**: `requireBDR()`
**Input** (Zod):
```typescript
{
  expense_id: string;  // UUID
}
```
**Output**:
```typescript
{
  success: true,
  data: { url: string }  // Signed URL, 1 hour expiry
} | { success: false, error: string }
```
**Logic**:
- Validates expense belongs to authenticated BDR
- Generates signed URL from Supabase Storage

---

## BDR Receipt Actions (`app/actions/bdr-receipt-actions.ts`)

### `uploadReceipt(formData)`

**Auth**: `requireBDR()`
**Input** (FormData):
```typescript
FormData {
  expense_id: string;
  file: File;  // max 10MB, PDF/JPG/PNG
}
```
**Output**:
```typescript
{
  success: true,
  data: { receiptPath: string; fileName: string }
} | { success: false, error: string }
```
**Logic**:
- Validates expense belongs to BDR and status is SUBMITTED
- Validates file (10MB max, PDF/JPG/PNG only)
- Uploads to `bdr-receipts/{org_id}/{staff_id}/{expense_id}/{uuid}-{name}`
- Updates expense record with receipt path, file name, size, mime type
- Sets `has_receipt = true`

---

## BDR Admin Actions (`app/actions/bdr-admin-actions.ts`)

### `createPayPlan(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN) (admin only)
**Input** (Zod: `createPayPlanSchema`):
```typescript
{
  name: string;                    // required, max 200
  description?: string;           // max 1000
  base_metric: 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED';
  effective_start: string;        // ISO date
  effective_end?: string;         // ISO date, optional
  tiers: {
    min_threshold: number;        // >= 1
    max_threshold?: number;       // nullable for top tier
    payout_rate: number;          // > 0
  }[];                            // at least 1 tier
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; name: string; tierCount: number }
} | { success: false, error: string }
```
**Logic**:
- Validates no tier gaps/overlaps
- Creates pay plan + tiers in transaction
- Sets `sort_order` automatically based on `min_threshold`

---

### `updatePayPlan(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod: `updatePayPlanSchema`):
```typescript
{
  id: string;                      // UUID
  name?: string;
  description?: string;
  base_metric?: 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED';
  effective_end?: string;
  tiers?: { ... }[];              // Full tier replacement
}
```
**Output**: Same as create
**Logic**:
- Validates plan belongs to org
- If tiers provided, replaces all tiers (delete + create in transaction)
- Does NOT affect already-approved reports using this plan

---

### `assignPayPlan(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod: `assignPayPlanSchema`):
```typescript
{
  pay_plan_id: string;     // UUID
  staff_id: string;        // UUID (BDR staff)
  effective_from: string;  // ISO date
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; staffName: string; planName: string }
} | { success: false, error: string }
```
**Logic**:
- Validates staff is a BDR (staff_type = 'BDR')
- Closes any existing active assignment (sets `effective_to`)
- Creates new assignment

---

### `getPayPlans()`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input**: None
**Output**:
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    description: string | null;
    baseMetric: string;
    effectiveStart: string;
    effectiveEnd: string | null;
    isActive: boolean;
    tierCount: number;
    assignedBDRCount: number;
    tiers: { minThreshold: number; maxThreshold: number | null; payoutRate: number }[];
  }[]
} | { success: false, error: string }
```

---

### `getBDRReportsForReview(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  month: number;  // 1-12
  year: number;
  status?: 'SUBMITTED' | 'APPROVED' | 'NEEDS_CORRECTION';
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    reports: {
      id: string;
      bdrName: string;
      staffId: string;
      meetingsBooked: number;
      meetingsShowed: number;
      calculatedBonus: number;
      bonusBreakdown: { ... }[];
      payPlanName: string | null;
      status: string;
      notes: string | null;
      adminNotes: string | null;
      submittedAt: string | null;
    }[];
    summary: {
      totalReports: number;
      totalBonus: number;
      submitted: number;
      approved: number;
      needsCorrection: number;
    };
  }
} | { success: false, error: string }
```

---

### `approveReport(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod: `approveReportSchema`):
```typescript
{
  report_id: string;  // UUID
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'APPROVED'; approvedAt: string }
} | { success: false, error: string }
```
**Logic**:
- Validates report status is SUBMITTED
- Sets status → APPROVED, `approved_at`, `approved_by`

---

### `flagReportForCorrection(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod: `flagReportSchema`):
```typescript
{
  report_id: string;     // UUID
  admin_notes: string;   // required, max 1000
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'NEEDS_CORRECTION' }
} | { success: false, error: string }
```
**Logic**:
- Validates report status is SUBMITTED
- Sets status → NEEDS_CORRECTION, stores admin_notes

---

### `getExpensesForApproval(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
  page?: number;
  pageSize?: number;
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    expenses: {
      id: string;
      bdrName: string;
      staffId: string;
      expenseDate: string;
      category: string;
      amount: number;
      description: string | null;
      hasReceipt: boolean;
      receiptPath: string | null;
      status: string;
      createdAt: string;
    }[];
    summary: {
      totalPending: number;
      totalApproved: number;
      totalRejected: number;
      pendingAmount: number;
      approvedAmount: number;
    };
    total: number;
    page: number;
  }
} | { success: false, error: string }
```

---

### `approveExpense(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  expense_id: string;       // UUID
  admin_notes?: string;     // max 500
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'APPROVED'; approvedAt: string }
} | { success: false, error: string }
```

---

### `rejectExpense(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  expense_id: string;     // UUID
  admin_notes: string;    // required, max 500
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'REJECTED' }
} | { success: false, error: string }
```

---

### `markExpenseReimbursed(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  expense_id: string;  // UUID
}
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; status: 'REIMBURSED'; reimbursedAt: string }
} | { success: false, error: string }
```

---

### `getBDRCompensationSummary(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  month: number;    // 1-12
  year: number;
}
```
**Output**:
```typescript
{
  success: true,
  data: {
    month: number;
    year: number;
    totalBonuses: number;
    totalExpensesApproved: number;
    grandTotal: number;
    perBDR: {
      staffId: string;
      name: string;
      bonus: number;
      reportStatus: string | null;
      expensesApproved: number;
      expensesPending: number;
      total: number;
    }[];
  }
} | { success: false, error: string }
```

---

### `manageExpenseCategories(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
// Create
{ action: 'create'; name: string; description?: string }
// Update
{ action: 'update'; id: string; name?: string; description?: string; is_active?: boolean }
```
**Output**:
```typescript
{
  success: true,
  data: { id: string; name: string; isActive: boolean }
} | { success: false, error: string }
```

---

### `getAdminReceiptUrl(input)`

**Auth**: `requireAuth()` (ADMIN or AGENCY_ADMIN)
**Input** (Zod):
```typescript
{
  expense_id: string;  // UUID
}
```
**Output**:
```typescript
{
  success: true,
  data: { url: string }  // Signed URL, 1 hour expiry
} | { success: false, error: string }
```
**Logic**:
- Validates expense belongs to admin's org
- Generates signed URL from Supabase Storage
