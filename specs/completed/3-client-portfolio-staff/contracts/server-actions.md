# API Contracts: Server Actions

**Feature**: 3-client-portfolio-staff
**Created**: 2026-02-16
**Status**: Phase 0 Design Complete

---

## Overview

This document defines all Server Action contracts for Feature 3: Client Portfolio & Staff Management. Each action follows Next.js 15 Server Actions best practices with Zod validation and typed responses.

**File Organization**:
- `app/actions/client-management.ts` - Client CRUD
- `app/actions/service-management.ts` - Service templates & assignments
- `app/actions/staff-management.ts` - Staff & assignments
- `app/actions/subscription-management.ts` - Subscriptions & allocations
- `app/actions/agency-management.ts` - Agency partners & breakdowns
- `app/actions/productivity-management.ts` - BDR metrics
- `app/actions/roi-calculations.ts` - ROI snapshots & refresh

---

## Response Types

### Standard Response Wrapper
```typescript
type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>; // Zod validation errors
};
```

### Pagination Metadata
```typescript
type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type PaginatedResponse<T> = ActionResponse<{
  items: T[];
  pagination: PaginationMeta;
}>;
```

---

## Client Management

### createClient
**File**: `app/actions/client-management.ts`

**Description**: Create a new client with margin target

**Input Schema**:
```typescript
const CreateClientSchema = z.object({
  name: z.string().min(1).max(200),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED']),
  custom_margin_target: z.number().min(0).max(100).optional(),
  start_date: z.date().optional(),
});

type CreateClientInput = z.infer<typeof CreateClientSchema>;
```

**Output**:
```typescript
type CreateClientOutput = ActionResponse<{
  id: string;
  name: string;
  status: ClientStatus;
  relationship_type: RelationshipType;
  custom_margin_target: number | null;
  start_date: Date;
  created_at: Date;
}>;
```

**Validation**:
- Unique constraint: (organization_id, name)
- custom_margin_target: 0-100% or null

---

### getClients
**File**: `app/actions/client-management.ts`

**Description**: List clients with filtering and pagination

**Input Schema**:
```typescript
const GetClientsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'created_at', 'margin', 'revenue']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

type GetClientsInput = z.infer<typeof GetClientsSchema>;
```

**Output**:
```typescript
type GetClientsOutput = PaginatedResponse<{
  id: string;
  name: string;
  status: ClientStatus;
  relationship_type: RelationshipType;
  custom_margin_target: number | null;
  services_count: number;
  staff_count: number;
  created_at: Date;
}>;
```

**Query Optimizations**:
- Indexed search on `name` (partial match, case-insensitive)
- Filtered by `organization_id` (RLS)
- Exclude soft-deleted records by default

---

### getClientById
**File**: `app/actions/client-management.ts`

**Description**: Get single client with full details

**Input Schema**:
```typescript
const GetClientByIdSchema = z.object({
  id: z.string().uuid(),
});
```

**Output**:
```typescript
type GetClientByIdOutput = ActionResponse<{
  id: string;
  name: string;
  status: ClientStatus;
  relationship_type: RelationshipType;
  custom_margin_target: number | null;
  start_date: Date;
  churn_date: Date | null;
  services: Array<{
    service_id: string;
    service_name: string;
    standard_rate: number;
    custom_rate: number | null;
  }>;
  staff: Array<{
    staff_id: string;
    staff_name: string;
    staff_type: StaffType;
    allocation_percentage: number;
    start_date: Date;
    end_date: Date | null;
  }>;
  subscriptions: Array<{
    subscription_id: string;
    subscription_name: string;
    cost_allocated: number;
  }>;
  created_at: Date;
  updated_at: Date;
}>;
```

**Includes**:
- All assigned services with custom rates
- All assigned staff with allocations
- All subscription allocations

---

### updateClient
**File**: `app/actions/client-management.ts`

**Description**: Update client details

**Input Schema**:
```typescript
const UpdateClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  relationship_type: z.enum(['RETAINER', 'PROJECT_BASED', 'HOURLY', 'VALUE_BASED']).optional(),
  custom_margin_target: z.number().min(0).max(100).nullable().optional(),
  churn_date: z.date().nullable().optional(),
});

type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
```

**Output**:
```typescript
type UpdateClientOutput = ActionResponse<{
  id: string;
  name: string;
  status: ClientStatus;
  updated_at: Date;
}>;
```

**Validation**:
- If status changed to CHURNED: prompt to end all active assignments
- churn_date must be >= start_date

---

### softDeleteClient
**File**: `app/actions/client-management.ts`

**Description**: Soft delete client (set deleted_at timestamp)

**Input Schema**:
```typescript
const SoftDeleteClientSchema = z.object({
  id: z.string().uuid(),
});
```

**Output**:
```typescript
type SoftDeleteClientOutput = ActionResponse<{
  id: string;
  deleted_at: Date;
}>;
```

**Side Effects**:
- Sets deleted_at timestamp
- Preserves historical ROI data
- Client no longer appears in active queries

---

## Service Template Management

### createService
**File**: `app/actions/service-management.ts`

**Description**: Create a reusable service template

**Input Schema**:
```typescript
const CreateServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  standard_rate: z.number().positive(),
  target_margin: z.number().min(0).max(100),
});

type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
```

**Output**:
```typescript
type CreateServiceOutput = ActionResponse<{
  id: string;
  name: string;
  standard_rate: number;
  target_margin: number;
  is_active: boolean;
  created_at: Date;
}>;
```

---

### getServices
**File**: `app/actions/service-management.ts`

**Description**: List service templates

**Input Schema**:
```typescript
const GetServicesSchema = z.object({
  is_active: z.boolean().optional(),
  sortBy: z.enum(['name', 'created_at', 'standard_rate']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
```

**Output**:
```typescript
type GetServicesOutput = ActionResponse<Array<{
  id: string;
  name: string;
  standard_rate: number;
  target_margin: number;
  is_active: boolean;
  clients_count: number; // Count of assignments
}>>;
```

---

### assignServiceToClient
**File**: `app/actions/service-management.ts`

**Description**: Assign service template to client with optional custom rate

**Input Schema**:
```typescript
const AssignServiceSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid(),
  custom_rate: z.number().positive().optional(),
});

type AssignServiceInput = z.infer<typeof AssignServiceSchema>;
```

**Output**:
```typescript
type AssignServiceOutput = ActionResponse<{
  client_id: string;
  service_id: string;
  custom_rate: number | null;
}>;
```

**Validation**:
- Prevents duplicate assignments (composite PK)
- custom_rate overrides service.standard_rate when present

---

### removeServiceFromClient
**File**: `app/actions/service-management.ts`

**Description**: Remove service assignment from client

**Input Schema**:
```typescript
const RemoveServiceSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid(),
});
```

**Output**:
```typescript
type RemoveServiceOutput = ActionResponse<{ success: true }>;
```

---

## Staff Management

### createStaff
**File**: `app/actions/staff-management.ts`

**Description**: Add staff member (BDR, Admin, Contractor, or Agency Staff)

**Input Schema**:
```typescript
const CreateStaffSchema = z.object({
  name: z.string().min(1).max(200),
  staff_type: z.enum(['BDR', 'ADMIN', 'CONTRACTOR', 'AGENCY_STAFF']),
  rate: z.number().positive(),
  rate_type: z.enum(['MONTHLY', 'HOURLY', 'PROJECT']),
  engagement_type: z.enum(['W2', '1099', 'CORP_TO_CORP']),
  agency_id: z.string().uuid().optional(),
}).refine(
  (data) => {
    // If staff_type = AGENCY_STAFF, agency_id is required
    if (data.staff_type === 'AGENCY_STAFF') {
      return data.agency_id !== undefined;
    }
    return true;
  },
  {
    message: "agency_id required when staff_type is AGENCY_STAFF",
    path: ['agency_id']
  }
);

type CreateStaffInput = z.infer<typeof CreateStaffSchema>;
```

**Output**:
```typescript
type CreateStaffOutput = ActionResponse<{
  id: string;
  name: string;
  staff_type: StaffType;
  rate: number;
  rate_type: RateType;
  created_at: Date;
}>;
```

---

### getStaff
**File**: `app/actions/staff-management.ts`

**Description**: List staff with filtering

**Input Schema**:
```typescript
const GetStaffSchema = z.object({
  staff_type: z.enum(['BDR', 'ADMIN', 'CONTRACTOR', 'AGENCY_STAFF']).optional(),
  agency_id: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
```

**Output**:
```typescript
type GetStaffOutput = PaginatedResponse<{
  id: string;
  name: string;
  staff_type: StaffType;
  rate: number;
  rate_type: RateType;
  assignments_count: number;
  utilization_percentage: number; // Sum of allocation_percentage across active assignments
}>;
```

**Calculated Fields**:
- `utilization_percentage`: Sum of allocation_percentage for active assignments (end_date IS NULL)

---

### createStaffAssignment
**File**: `app/actions/staff-management.ts`

**Description**: Assign staff member to client with allocation percentage

**Input Schema**:
```typescript
const CreateStaffAssignmentSchema = z.object({
  staff_id: z.string().uuid(),
  client_id: z.string().uuid(),
  allocation_percentage: z.number().min(0).max(100),
  start_date: z.date().optional(),
});

type CreateStaffAssignmentInput = z.infer<typeof CreateStaffAssignmentSchema>;
```

**Output**:
```typescript
type CreateStaffAssignmentOutput = ActionResponse<{
  id: string;
  staff_id: string;
  client_id: string;
  allocation_percentage: number;
  start_date: Date;
  warnings?: string[]; // e.g., "Staff total allocation now 120%"
}>;
```

**Business Logic**:
- Calculate total allocation for staff
- Warn (don't block) if total > 100%
- Cost allocation: staff.rate × (allocation_percentage / 100)

---

### endStaffAssignment
**File**: `app/actions/staff-management.ts`

**Description**: End staff assignment by setting end_date

**Input Schema**:
```typescript
const EndStaffAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  end_date: z.date(),
});
```

**Output**:
```typescript
type EndStaffAssignmentOutput = ActionResponse<{
  id: string;
  end_date: Date;
}>;
```

**Validation**:
- end_date >= start_date

---

## Subscription Management

### createSubscription
**File**: `app/actions/subscription-management.ts`

**Description**: Add SaaS subscription

**Input Schema**:
```typescript
const CreateSubscriptionSchema = z.object({
  name: z.string().min(1).max(200),
  total_cost: z.number().positive(),
  total_seats: z.number().int().positive().optional(),
  billing_frequency: z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']),
});

type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
```

**Output**:
```typescript
type CreateSubscriptionOutput = ActionResponse<{
  id: string;
  name: string;
  total_cost: number;
  total_seats: number | null;
  billing_frequency: string;
  created_at: Date;
}>;
```

---

### getSubscriptions
**File**: `app/actions/subscription-management.ts`

**Description**: List subscriptions with utilization

**Input Schema**:
```typescript
const GetSubscriptionsSchema = z.object({
  is_active: z.boolean().optional(),
});
```

**Output**:
```typescript
type GetSubscriptionsOutput = ActionResponse<Array<{
  id: string;
  name: string;
  total_cost: number;
  total_seats: number | null;
  allocated_seats: number;
  allocated_cost: number;
  unutilized_cost: number;
  is_active: boolean;
}>>;
```

**Calculated Fields**:
- `allocated_seats`: Sum of seats_allocated across all allocations
- `allocated_cost`: Sum of cost_allocated across all allocations
- `unutilized_cost`: total_cost - allocated_cost

---

### createSubscriptionAllocation
**File**: `app/actions/subscription-management.ts`

**Description**: Allocate subscription cost to client or staff (hybrid: seat-based or percentage-based)

**Input Schema**:
```typescript
const CreateSubscriptionAllocationSchema = z.object({
  subscription_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  allocation_type: z.enum(['SEAT_BASED', 'PERCENTAGE_BASED']),
  seats_allocated: z.number().int().positive().optional(),
  percentage_allocated: z.number().min(0).max(100).optional(),
}).refine(
  (data) => {
    // Exactly one of client_id OR staff_id must be set
    return (data.client_id && !data.staff_id) || (!data.client_id && data.staff_id);
  },
  {
    message: "Must allocate to either client or staff, not both",
    path: ['client_id', 'staff_id']
  }
).refine(
  (data) => {
    // If SEAT_BASED, seats_allocated required
    if (data.allocation_type === 'SEAT_BASED') {
      return data.seats_allocated !== undefined;
    }
    return true;
  },
  {
    message: "seats_allocated required for SEAT_BASED allocation",
    path: ['seats_allocated']
  }
).refine(
  (data) => {
    // If PERCENTAGE_BASED, percentage_allocated required
    if (data.allocation_type === 'PERCENTAGE_BASED') {
      return data.percentage_allocated !== undefined;
    }
    return true;
  },
  {
    message: "percentage_allocated required for PERCENTAGE_BASED allocation",
    path: ['percentage_allocated']
  }
);

type CreateSubscriptionAllocationInput = z.infer<typeof CreateSubscriptionAllocationSchema>;
```

**Output**:
```typescript
type CreateSubscriptionAllocationOutput = ActionResponse<{
  id: string;
  subscription_id: string;
  client_id: string | null;
  staff_id: string | null;
  allocation_type: AllocationType;
  seats_allocated: number | null;
  percentage_allocated: number | null;
  cost_allocated: number;
  warnings?: string[];
}>;
```

**Calculation Logic**:
```typescript
// cost_allocated calculation
if (allocation_type === 'SEAT_BASED') {
  const costPerSeat = subscription.total_cost / subscription.total_seats;
  cost_allocated = costPerSeat * seats_allocated;
} else {
  cost_allocated = subscription.total_cost * (percentage_allocated / 100);
}
```

**Validation**:
- SEAT_BASED: Sum of seats_allocated ≤ subscription.total_seats (hard constraint)
- PERCENTAGE_BASED: Sum of percentage_allocated can exceed 100% (warn only)

---

### removeSubscriptionAllocation
**File**: `app/actions/subscription-management.ts`

**Description**: Remove subscription allocation

**Input Schema**:
```typescript
const RemoveSubscriptionAllocationSchema = z.object({
  allocation_id: z.string().uuid(),
});
```

**Output**:
```typescript
type RemoveSubscriptionAllocationOutput = ActionResponse<{ success: true }>;
```

---

## Agency Partner Management

### createAgency
**File**: `app/actions/agency-management.ts`

**Description**: Add agency partner

**Input Schema**:
```typescript
const CreateAgencySchema = z.object({
  name: z.string().min(1).max(200),
  monthly_payment: z.number().positive(),
  start_date: z.date().optional(),
});

type CreateAgencyInput = z.infer<typeof CreateAgencySchema>;
```

**Output**:
```typescript
type CreateAgencyOutput = ActionResponse<{
  id: string;
  name: string;
  monthly_payment: number;
  start_date: Date;
  created_at: Date;
}>;
```

---

### createAgencyMonthlyBreakdown
**File**: `app/actions/agency-management.ts`

**Description**: Record variable monthly staffing breakdown

**Input Schema**:
```typescript
const StaffBreakdownItemSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.enum(['BDR', 'ADMIN', 'CONTRACTOR']),
  cost: z.number().positive(),
});

const CreateAgencyMonthlyBreakdownSchema = z.object({
  agency_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  breakdown: z.array(StaffBreakdownItemSchema).min(1),
});

type CreateAgencyMonthlyBreakdownInput = z.infer<typeof CreateAgencyMonthlyBreakdownSchema>;
```

**Output**:
```typescript
type CreateAgencyMonthlyBreakdownOutput = ActionResponse<{
  id: string;
  agency_id: string;
  month: number;
  year: number;
  breakdown: Array<{
    name: string;
    role: string;
    cost: number;
  }>;
  breakdown_total: number;
  variance: number; // breakdown_total - agency.monthly_payment
  warnings?: string[]; // e.g., "Variance: $500 (breakdown exceeds payment)"
}>;
```

**Calculated Fields**:
- `breakdown_total`: Sum of all staff costs in breakdown array
- `variance`: breakdown_total - agency.monthly_payment

**Business Logic**:
- Warn if variance is significant (> $100 or > 10%)
- Allow save regardless of variance (admin may have negotiated different amount)

---

### getAgencyBreakdownHistory
**File**: `app/actions/agency-management.ts`

**Description**: Get historical monthly breakdowns for agency

**Input Schema**:
```typescript
const GetAgencyBreakdownHistorySchema = z.object({
  agency_id: z.string().uuid(),
  startYear: z.number().int().optional(),
  endYear: z.number().int().optional(),
});
```

**Output**:
```typescript
type GetAgencyBreakdownHistoryOutput = ActionResponse<Array<{
  id: string;
  month: number;
  year: number;
  breakdown: Array<{
    name: string;
    role: string;
    cost: number;
  }>;
  breakdown_total: number;
  variance: number;
  created_at: Date;
}>>;
```

**Query Pattern**:
- Order by year DESC, month DESC
- Filter by date range if provided

---

## BDR Productivity Management

### recordBDRProductivity
**File**: `app/actions/productivity-management.ts`

**Description**: Record meetings attended for BDR (per client or aggregate)

**Input Schema**:
```typescript
const RecordBDRProductivitySchema = z.object({
  bdr_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  meetings_attended: z.number().int().min(0),
});

type RecordBDRProductivityInput = z.infer<typeof RecordBDRProductivitySchema>;
```

**Output**:
```typescript
type RecordBDRProductivityOutput = ActionResponse<{
  id: string;
  bdr_id: string;
  client_id: string | null;
  month: number;
  year: number;
  meetings_attended: number;
  created_at: Date;
}>;
```

**Business Logic**:
- If client_id IS NULL: aggregate metric for BDR across all clients
- If client_id IS NOT NULL: per-client metric
- Unique constraint prevents duplicates: (bdr_id, client_id, month, year)

---

### getBDRProductivityMetrics
**File**: `app/actions/productivity-management.ts`

**Description**: Get productivity metrics for BDR

**Input Schema**:
```typescript
const GetBDRProductivityMetricsSchema = z.object({
  bdr_id: z.string().uuid(),
  startMonth: z.number().int().min(1).max(12).optional(),
  startYear: z.number().int().optional(),
  endMonth: z.number().int().min(1).max(12).optional(),
  endYear: z.number().int().optional(),
});
```

**Output**:
```typescript
type GetBDRProductivityMetricsOutput = ActionResponse<Array<{
  month: number;
  year: number;
  client_id: string | null;
  client_name: string | null;
  meetings_attended: number;
}>>;
```

**Query Pattern**:
- Order by year DESC, month DESC
- Filter by date range if provided
- Include client name join for per-client metrics

---

## ROI Calculations

### refreshClientROI
**File**: `app/actions/roi-calculations.ts`

**Description**: Calculate and store client ROI snapshot for specific month

**Input Schema**:
```typescript
const RefreshClientROISchema = z.object({
  client_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

type RefreshClientROIInput = z.infer<typeof RefreshClientROISchema>;
```

**Output**:
```typescript
type RefreshClientROIOutput = ActionResponse<{
  id: string;
  client_id: string;
  month: number;
  year: number;
  revenue: number;
  total_costs: number;
  profit: number;
  roi_percentage: number;
  margin_percentage: number;
  calculated_at: Date;
  cost_breakdown: {
    bdr_costs: number;
    contractor_costs: number;
    subscription_costs: number;
    service_costs: number;
  };
}>;
```

**Calculation Logic**:
```typescript
// 1. Get revenue from Xero invoices
revenue = await getClientRevenue(client_id, month, year);

// 2. Calculate costs
bdr_costs = sum(staff.rate * allocation% for staff_type=BDR);
contractor_costs = sum(staff.rate * allocation% for staff_type=CONTRACTOR);
subscription_costs = sum(subscription_allocations.cost_allocated);
service_costs = sum(client_services.custom_rate or standard_rate);

total_costs = bdr_costs + contractor_costs + subscription_costs + service_costs;

// 3. Calculate metrics
profit = revenue - total_costs;
roi_percentage = total_costs > 0 ? (profit / total_costs) * 100 : 0;
margin_percentage = revenue > 0 ? (profit / revenue) * 100 : 0;
```

**Upsert Behavior**:
- Use UPSERT to update existing snapshot or create new
- Update `calculated_at` timestamp on each refresh

---

### refreshBDRROI
**File**: `app/actions/roi-calculations.ts`

**Description**: Calculate and store BDR ROI snapshot for specific month

**Input Schema**:
```typescript
const RefreshBDRROISchema = z.object({
  bdr_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

type RefreshBDRROIInput = z.infer<typeof RefreshBDRROISchema>;
```

**Output**:
```typescript
type RefreshBDRROIOutput = ActionResponse<{
  id: string;
  bdr_id: string;
  month: number;
  year: number;
  revenue_attributed: number;
  bdr_cost: number;
  profit: number;
  roi_percentage: number;
  margin_percentage: number;
  meetings_attended_total: number;
  calculated_at: Date;
}>;
```

**Calculation Logic**:
```typescript
// 1. Get BDR assignments for month
const assignments = await getActiveAssignments(bdr_id, month, year);

// 2. Calculate attributed revenue
revenue_attributed = 0;
for (const assignment of assignments) {
  const client_revenue = await getClientRevenue(assignment.client_id, month, year);
  revenue_attributed += client_revenue * (assignment.allocation_percentage / 100);
}

// 3. Get BDR cost (monthly rate)
bdr_cost = staff.rate; // Assumes RateType = MONTHLY

// 4. Calculate metrics
profit = revenue_attributed - bdr_cost;
roi_percentage = bdr_cost > 0 ? (profit / bdr_cost) * 100 : 0;
margin_percentage = revenue_attributed > 0 ? (profit / revenue_attributed) * 100 : 0;

// 5. Get total meetings attended
meetings_attended_total = sum(meetings_attended where bdr_id=? AND month=? AND year=?);
```

---

### getClientROIDashboard
**File**: `app/actions/roi-calculations.ts`

**Description**: Get portfolio dashboard with all client ROI metrics

**Input Schema**:
```typescript
const GetClientROIDashboardSchema = z.object({
  month: z.number().int().min(1).max(12).optional(), // Defaults to current month
  year: z.number().int().optional(), // Defaults to current year
  status: z.enum(['ACTIVE', 'INACTIVE', 'CHURNED']).optional(),
  minMargin: z.number().optional(),
  maxMargin: z.number().optional(),
  sortBy: z.enum(['name', 'revenue', 'costs', 'margin_percentage', 'roi_percentage']).default('margin_percentage'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type GetClientROIDashboardInput = z.infer<typeof GetClientROIDashboardSchema>;
```

**Output**:
```typescript
type GetClientROIDashboardOutput = ActionResponse<{
  clients: Array<{
    id: string;
    name: string;
    status: ClientStatus;
    relationship_type: RelationshipType;
    revenue: number;
    total_costs: number;
    profit: number;
    roi_percentage: number;
    margin_percentage: number;
    target_margin: number | null;
    calculated_at: Date;
  }>;
  summary: {
    total_clients: number;
    total_revenue: number;
    total_costs: number;
    total_profit: number;
    avg_margin: number;
    avg_roi: number;
  };
}>;
```

**Query Optimizations**:
- Read from ClientROI table (pre-calculated snapshots)
- Filter by organization_id (RLS)
- Apply status, margin range filters
- Sort by specified column
- Calculate summary statistics in-memory or via SQL aggregations

---

### getBDRPerformanceDashboard
**File**: `app/actions/roi-calculations.ts`

**Description**: Get BDR performance dashboard with ROI metrics

**Input Schema**:
```typescript
const GetBDRPerformanceDashboardSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
  sortBy: z.enum(['name', 'revenue_attributed', 'roi_percentage', 'margin_percentage', 'meetings_attended']).default('roi_percentage'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type GetBDRPerformanceDashboardInput = z.infer<typeof GetBDRPerformanceDashboardSchema>;
```

**Output**:
```typescript
type GetBDRPerformanceDashboardOutput = ActionResponse<{
  bdrs: Array<{
    id: string;
    name: string;
    revenue_attributed: number;
    bdr_cost: number;
    profit: number;
    roi_percentage: number;
    margin_percentage: number;
    meetings_attended_total: number;
    clients_count: number;
    calculated_at: Date;
  }>;
  summary: {
    total_bdrs: number;
    total_revenue_attributed: number;
    total_bdr_costs: number;
    avg_roi: number;
    avg_margin: number;
    total_meetings_attended: number;
  };
}>;
```

---

## Bulk Operations

### distributeAllocationEvenly
**File**: `app/actions/staff-management.ts`

**Description**: Distribute staff allocation evenly across multiple clients

**Input Schema**:
```typescript
const DistributeAllocationEvenlySchema = z.object({
  staff_id: z.string().uuid(),
  client_ids: z.array(z.string().uuid()).min(1),
});
```

**Output**:
```typescript
type DistributeAllocationEvenlyOutput = ActionResponse<{
  assignments: Array<{
    client_id: string;
    allocation_percentage: number;
  }>;
  warnings?: string[];
}>;
```

**Logic**:
```typescript
const evenPercentage = Math.floor(100 / client_ids.length);
const remainder = 100 % client_ids.length;

// Distribute remainder across first N clients
assignments = client_ids.map((client_id, index) => ({
  client_id,
  allocation_percentage: evenPercentage + (index < remainder ? 1 : 0)
}));
```

---

### bulkEndAssignments
**File**: `app/actions/staff-management.ts`

**Description**: End multiple assignments at once (e.g., when client churns)

**Input Schema**:
```typescript
const BulkEndAssignmentsSchema = z.object({
  assignment_ids: z.array(z.string().uuid()).min(1),
  end_date: z.date(),
});
```

**Output**:
```typescript
type BulkEndAssignmentsOutput = ActionResponse<{
  updated_count: number;
  failed_ids: string[];
}>;
```

---

## Export Operations

### exportClientsToCSV
**File**: `app/api/export/clients/route.ts` (API Route, not Server Action)

**Description**: Stream CSV export of client portfolio data (from R6 research)

**Query Parameters**:
```typescript
type ExportClientsParams = {
  filters?: string; // JSON.stringify(filters)
  columns?: string; // Comma-separated column names
};
```

**Supported Columns**:
- name, status, relationship_type
- revenue, costs, profit, margin_percentage, roi_percentage
- bdrs_count, services_count, staff_count
- created_at, churn_date

**Response**:
- Stream: CSV data in chunks (50 rows at a time)
- Headers:
  - Content-Type: text/csv; charset=utf-8
  - Content-Disposition: attachment; filename="clients-[timestamp].csv"
  - Cache-Control: no-cache

**Implementation Pattern**:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Streaming implementation from R6 research
  // Uses fast-csv library with ReadableStream
}
```

---

## Error Handling

### Standard Error Codes
```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'      // Zod validation failed
  | 'NOT_FOUND'             // Resource not found
  | 'DUPLICATE'             // Unique constraint violation
  | 'UNAUTHORIZED'          // RLS policy violation
  | 'FOREIGN_KEY_ERROR'     // Referenced entity doesn't exist
  | 'CONSTRAINT_VIOLATION'  // Check constraint failed
  | 'INTERNAL_ERROR';       // Unexpected server error
```

### Error Response Format
```typescript
{
  success: false,
  error: "Human-readable error message",
  errorCode: "VALIDATION_ERROR",
  errors: {
    fieldName: ["Error message 1", "Error message 2"]
  }
}
```

---

## Rate Limiting

**Not implemented in MVP**. Future consideration:
- Use Upstash Redis for rate limiting
- Limit expensive operations (ROI refresh, CSV export)
- Per-organization limits

---

## Authentication & Authorization

**All Server Actions require authentication**:
```typescript
const session = await auth();
if (!session) {
  return { success: false, error: 'Unauthorized' };
}
```

**RLS enforces organization isolation**:
- All queries automatically filtered by organization_id
- Users can only access data for organizations they belong to
- No additional authorization checks needed in actions

---

## Next Steps

1. ✅ Review API contracts with team
2. ✅ Implement Zod validation schemas in `lib/validations/`
3. ✅ Create Server Actions files in `app/actions/`
4. ✅ Update `plan.md` with API contract references
5. ✅ Begin Phase 1 implementation

---

**API Contracts Complete**: 2026-02-16
