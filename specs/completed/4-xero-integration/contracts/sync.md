# Xero Sync Job API Contract

**Feature**: Xero OAuth 2.0 Integration
**Version**: 1.0
**Created**: 2026-02-14

---

## Overview

This document defines the API contracts for Xero sync job execution endpoints including scheduled sync, manual sync, sync status retrieval, and retry logic.

---

## Endpoints

### 1. POST /api/xero/sync

**Purpose**: Trigger Xero data synchronization (invoices + expenses) for an organization. Can be triggered by pg_cron (scheduled) or admin user (manual).

**Authentication**: CRON_SECRET header (for scheduled) OR admin user session (for manual)

**Request**:
- **Method**: POST
- **Headers**:
  - `Authorization`: `Bearer {CRON_SECRET}` (for scheduled sync)
  - OR `Cookie`: Session cookie with admin user (for manual sync)
  - `Content-Type`: application/json
- **Body**:
  ```json
  {
    "sync_type": "FULL",           // INVOICES | EXPENSES | CONTACTS | FULL
    "organization_id": "uuid"      // Optional (inferred from session if manual)
  }
  ```

**Response**:
- **Success**: 200 OK
  ```json
  {
    "success": true,
    "sync_log_id": "uuid",
    "message": "Sync job started",
    "estimated_duration_ms": 120000
  }
  ```

**Flow**:
1. Validate authentication (CRON_SECRET OR admin session)
2. Get organization_id (from request body OR user session)
3. Find xero_connection for organization
4. Verify connection_status = ACTIVE
5. Create sync_log record (status: PENDING → RUNNING)
6. Check token expiry, refresh if needed
7. Execute sync based on sync_type:
   - INVOICES: Call `syncInvoices()`
   - EXPENSES: Call `syncExpenses()`
   - CONTACTS: Refresh contact mappings
   - FULL: Call all sync functions
8. Update sync_log with results (counts, errors, duration)
9. Set sync_log status: SUCCESS | FAILED | PARTIAL
10. Update xero_connection.last_sync_at and last_sync_status
11. Return sync_log_id

**Error Responses**:
- `401 Unauthorized`: Invalid CRON_SECRET or no session
  ```json
  { "error": "Unauthorized" }
  ```
- `403 Forbidden`: User not admin
  ```json
  { "error": "Insufficient permissions" }
  ```
- `404 Not Found`: No Xero connection exists
  ```json
  { "error": "Xero connection not found for this organization" }
  ```
- `409 Conflict`: Sync already running
  ```json
  { "error": "Sync job already in progress", "sync_log_id": "uuid" }
  ```
- `500 Internal Server Error`: Sync job failed
  ```json
  { "error": "Sync job failed", "details": "Token refresh failed" }
  ```

**Database Changes**:
- **Insert**: `xero_sync_logs` record (status progression: PENDING → RUNNING → SUCCESS/FAILED)
- **Insert/Update**: `revenue_records` with xero_invoice_id
- **Insert/Update**: `expense_records` with xero_expense_id
- **Insert**: `xero_contact_mappings` for new contacts
- **Update**: `xero_connections` (last_sync_at, last_sync_status)

**Audit Log**:
- `action_type`: "XERO_SYNC_TRIGGERED"
- `actor_id`: User ID (if manual) OR null (if scheduled)
- `action_details`: `{ sync_type, sync_log_id, triggered_by }`

---

### 2. GET /api/xero/sync/status

**Purpose**: Get current sync status and recent sync history for an organization.

**Authentication**: Required (authenticated user)

**Request**:
- **Method**: GET
- **Headers**:
  - `Cookie`: Session cookie with authenticated user
- **Query Parameters**:
  - `limit` (optional): Number of sync logs to return (default: 10, max: 100)
  - `offset` (optional): Pagination offset (default: 0)

**Response**:
- **Success**: 200 OK
  ```json
  {
    "connection": {
      "id": "uuid",
      "xero_tenant_id": "tenant-123",
      "connection_status": "ACTIVE",
      "last_sync_at": "2026-02-14T02:00:00Z",
      "last_sync_status": "SUCCESS",
      "created_at": "2026-02-10T10:00:00Z"
    },
    "current_sync": {
      "id": "uuid",
      "status": "RUNNING",
      "sync_type": "FULL",
      "started_at": "2026-02-14T08:00:00Z",
      "progress": {
        "invoices_processed": 45,
        "expenses_processed": 12
      }
    } | null,
    "recent_syncs": [
      {
        "id": "uuid",
        "sync_type": "FULL",
        "status": "SUCCESS",
        "started_at": "2026-02-14T02:00:00Z",
        "completed_at": "2026-02-14T02:05:32Z",
        "duration_ms": 332000,
        "invoices_processed": 50,
        "invoices_failed": 0,
        "expenses_processed": 20,
        "expenses_failed": 0,
        "contacts_mapped": 10,
        "contacts_unmapped": 2,
        "triggered_by": "SCHEDULED"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 25
    }
  }
  ```

**Flow**:
1. Get user's organization_id
2. Find xero_connection for organization
3. Find running sync_log (status: RUNNING) if exists
4. Query recent sync_logs (ORDER BY started_at DESC, LIMIT, OFFSET)
5. Return connection + current sync + recent syncs

**Error Responses**:
- `401 Unauthorized`: User not authenticated
  ```json
  { "error": "Authentication required" }
  ```
- `404 Not Found`: No Xero connection exists
  ```json
  { "error": "Xero connection not found" }
  ```

---

### 3. POST /api/xero/sync/retry

**Purpose**: Retry a failed sync job. Re-executes sync using same sync_type as original failed job.

**Authentication**: Required (admin or finance admin role)

**Request**:
- **Method**: POST
- **Headers**:
  - `Cookie`: Session cookie with admin user
  - `Content-Type`: application/json
- **Body**:
  ```json
  {
    "sync_log_id": "uuid"  // ID of failed sync to retry
  }
  ```

**Response**:
- **Success**: 200 OK
  ```json
  {
    "success": true,
    "new_sync_log_id": "uuid",
    "message": "Retry sync job started",
    "original_sync_log_id": "uuid"
  }
  ```

**Flow**:
1. Get user's organization_id
2. Find original sync_log by ID
3. Verify sync_log belongs to user's organization (RLS)
4. Verify original status = FAILED or PARTIAL
5. Create new sync_log with triggered_by = RETRY
6. Execute sync with same sync_type
7. Return new sync_log_id

**Error Responses**:
- `401 Unauthorized`: User not authenticated
  ```json
  { "error": "Authentication required" }
  ```
- `403 Forbidden`: User not admin
  ```json
  { "error": "Insufficient permissions" }
  ```
- `404 Not Found`: Sync log not found
  ```json
  { "error": "Sync log not found" }
  ```
- `400 Bad Request`: Original sync not failed
  ```json
  { "error": "Can only retry failed or partial syncs", "status": "SUCCESS" }
  ```
- `409 Conflict`: Sync already running
  ```json
  { "error": "Another sync is already in progress" }
  ```

**Database Changes**:
- **Insert**: New `xero_sync_logs` record with triggered_by = RETRY
- Same changes as `/api/xero/sync` endpoint

**Audit Log**:
- `action_type`: "XERO_SYNC_RETRY"
- `actor_id`: Current user ID
- `action_details`: `{ original_sync_log_id, new_sync_log_id }`

---

### 4. GET /api/xero/sync/logs/:id

**Purpose**: Get detailed information about a specific sync log including full error array.

**Authentication**: Required (authenticated user)

**Request**:
- **Method**: GET
- **Headers**:
  - `Cookie`: Session cookie with authenticated user
- **Path Parameters**:
  - `id` (required): Sync log ID (UUID)

**Response**:
- **Success**: 200 OK
  ```json
  {
    "id": "uuid",
    "connection_id": "uuid",
    "sync_type": "FULL",
    "status": "PARTIAL",
    "started_at": "2026-02-14T02:00:00Z",
    "completed_at": "2026-02-14T02:05:32Z",
    "duration_ms": 332000,
    "invoices_processed": 50,
    "invoices_failed": 2,
    "expenses_processed": 20,
    "expenses_failed": 1,
    "contacts_mapped": 10,
    "contacts_unmapped": 2,
    "triggered_by": "SCHEDULED",
    "errors": [
      {
        "type": "MAPPING_ERROR",
        "message": "Could not map Xero contact to client",
        "context": {
          "xero_contact_id": "contact-123",
          "xero_contact_name": "New Client Corp",
          "attempted_strategies": ["email", "name_exact", "name_fuzzy"],
          "similarity_scores": [0.0, 0.0, 0.72]
        },
        "timestamp": "2026-02-14T02:03:15Z"
      },
      {
        "type": "API_ERROR",
        "message": "Xero API rate limit exceeded",
        "context": {
          "http_status": 429,
          "retry_count": 3,
          "retry_after": 60
        },
        "timestamp": "2026-02-14T02:04:00Z"
      }
    ],
    "created_at": "2026-02-14T02:00:00Z"
  }
  ```

**Flow**:
1. Get user's organization_id
2. Find sync_log by ID
3. Verify sync_log belongs to user's organization (via connection_id → organization_id)
4. Return full sync_log with errors array

**Error Responses**:
- `401 Unauthorized`: User not authenticated
  ```json
  { "error": "Authentication required" }
  ```
- `404 Not Found`: Sync log not found or doesn't belong to user's organization
  ```json
  { "error": "Sync log not found" }
  ```

---

## Data Models

### XeroSyncLog (Database Table)

```typescript
interface XeroSyncLog {
  id: string;                     // UUID
  connection_id: string;          // UUID (foreign key to xero_connections)
  sync_type: SyncType;            // INVOICES | EXPENSES | CONTACTS | FULL
  status: SyncJobStatus;          // PENDING | RUNNING | SUCCESS | FAILED | PARTIAL
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;     // Milliseconds
  invoices_processed: number;
  invoices_failed: number;
  expenses_processed: number;
  expenses_failed: number;
  contacts_mapped: number;
  contacts_unmapped: number;
  errors: SyncError[];            // JSONB array
  triggered_by: SyncTrigger;      // SCHEDULED | MANUAL | RETRY
  created_at: Date;
}

enum SyncType {
  INVOICES = 'INVOICES',
  EXPENSES = 'EXPENSES',
  CONTACTS = 'CONTACTS',
  FULL = 'FULL'
}

enum SyncJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL'
}

enum SyncTrigger {
  SCHEDULED = 'SCHEDULED',
  MANUAL = 'MANUAL',
  RETRY = 'RETRY'
}

interface SyncError {
  type: 'API_ERROR' | 'MAPPING_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
  message: string;
  context: {
    xero_invoice_id?: string;
    xero_contact_id?: string;
    http_status?: number;
    retry_count?: number;
    [key: string]: any;
  };
  timestamp: string;              // ISO 8601
}
```

---

## Business Logic

### Sync Execution Flow

```typescript
async function executeSync(
  organizationId: string,
  syncType: SyncType,
  triggeredBy: SyncTrigger
): Promise<string> {
  // 1. Create sync log
  const syncLog = await createSyncLog({
    connection_id,
    sync_type: syncType,
    status: 'PENDING',
    triggered_by: triggeredBy
  });

  try {
    // 2. Update status to RUNNING
    await updateSyncLogStatus(syncLog.id, 'RUNNING');

    // 3. Get and refresh tokens if needed
    const xeroClient = await getXeroClientWithTokenRefresh(organizationId);

    // 4. Execute sync operations
    if (syncType === 'INVOICES' || syncType === 'FULL') {
      await syncInvoices(xeroClient, syncLog.id);
    }

    if (syncType === 'EXPENSES' || syncType === 'FULL') {
      await syncExpenses(xeroClient, syncLog.id);
    }

    if (syncType === 'CONTACTS' || syncType === 'FULL') {
      await refreshContactMappings(xeroClient, syncLog.id);
    }

    // 5. Determine final status
    const finalStatus = determineFinalStatus(syncLog);

    // 6. Update sync log with completion
    await completeSyncLog(syncLog.id, finalStatus);

    // 7. Update connection last_sync_at
    await updateConnectionLastSync(connection_id);

    return syncLog.id;

  } catch (error) {
    // Mark sync as FAILED
    await completeSyncLog(syncLog.id, 'FAILED', error);
    throw error;
  }
}

function determineFinalStatus(syncLog: XeroSyncLog): SyncJobStatus {
  const totalProcessed = syncLog.invoices_processed + syncLog.expenses_processed;
  const totalFailed = syncLog.invoices_failed + syncLog.expenses_failed;

  if (totalFailed === 0) return 'SUCCESS';
  if (totalProcessed === 0) return 'FAILED';
  return 'PARTIAL';  // Some succeeded, some failed
}
```

### Token Refresh Logic

```typescript
async function getXeroClientWithTokenRefresh(
  organizationId: string
): Promise<XeroClient> {
  const connection = await getXeroConnection(organizationId);

  // Check if token expires within 5 minutes
  const expiryThreshold = new Date(Date.now() + 5 * 60 * 1000);

  if (connection.token_expiry < expiryThreshold) {
    // Refresh tokens
    const decryptedRefreshToken = await decryptToken(connection.refresh_token);

    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET
    });

    const newTokenSet = await xeroClient.refreshToken(decryptedRefreshToken);

    // Encrypt new tokens
    const encryptedAccessToken = await encryptToken(newTokenSet.access_token);
    const encryptedRefreshToken = await encryptToken(newTokenSet.refresh_token);

    // Update database
    await updateXeroConnection(connection.id, {
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expiry: new Date(Date.now() + newTokenSet.expires_in * 1000),
      updated_at: new Date()
    });
  }

  // Return initialized Xero client
  const decryptedAccessToken = await decryptToken(connection.access_token);
  return initializeXeroClient(decryptedAccessToken, connection.xero_tenant_id);
}
```

---

## Error Handling

### Transient Errors (Retry)
- 429 (Rate Limit): Respect `Retry-After` header, use exponential backoff
- 503 (Service Unavailable): Retry with exponential backoff (1s, 2s, 4s)
- Network timeouts: Retry with exponential backoff

### Permanent Errors (No Retry)
- 401 (Unauthorized): Token refresh failed → set connection_status = TOKEN_EXPIRED
- 404 (Not Found): Record doesn't exist in Xero → log error, skip record
- 400 (Bad Request): Invalid data → log error, skip record

### Mapping Errors
- Contact mapping failure → set revenue.sync_status = MAPPING_FAILED
- Expense categorization failure → set expense.sync_status = CATEGORIZATION_FAILED

---

## Security Considerations

### CRON_SECRET Validation
- Scheduled sync requests must include `Authorization: Bearer {CRON_SECRET}` header
- CRON_SECRET is a secure random token stored in environment variables
- Prevents unauthorized sync job execution

### Rate Limiting
- Implement request queue using `bottleneck` package
- Limit: 60 requests per minute (Xero API limit)
- Respect `Retry-After` header on 429 responses

### Organization Isolation
- All sync operations scoped to organization_id
- RLS policies enforce data isolation
- Cannot trigger sync for other organizations

---

## Testing Checklist

### Unit Tests
- [ ] Test sync log creation and status transitions
- [ ] Test token refresh logic (expiry check, refresh call)
- [ ] Test final status determination (SUCCESS, FAILED, PARTIAL)

### Integration Tests
- [ ] Test invoice sync with mock Xero API (50 invoices)
- [ ] Test expense sync with mock Xero API (20 expenses)
- [ ] Test sync retry for failed job
- [ ] Test sync status retrieval with pagination

### E2E Tests
- [ ] Test manual sync trigger from admin UI
- [ ] Test scheduled sync via pg_cron
- [ ] Test sync history display with error details
- [ ] Test retry button functionality

---

## Performance Considerations

### Sync Execution Time
- Target: <15 minutes for 500 invoices + 200 expenses
- Batch processing: Process 50 records at a time
- Parallel processing: Invoice and expense sync can run in parallel (if sync_type = FULL)

### Database Query Optimization
- Use indexes on foreign keys (connection_id, organization_id)
- Pagination for sync history (LIMIT, OFFSET)
- JSONB indexing for error querying (if needed)

---

## References

- [Xero Accounting API - Invoices](https://developer.xero.com/documentation/api/accounting/invoices)
- [Xero Accounting API - Bills](https://developer.xero.com/documentation/api/accounting/bills)
- [Xero Accounting API - Bank Transactions](https://developer.xero.com/documentation/api/accounting/banktransactions)
- [Xero API Rate Limits](https://developer.xero.com/documentation/guides/oauth2/limits)
