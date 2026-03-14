# API Contracts: Mercury Banking Integration

**Created**: 2026-02-15
**Purpose**: REST API endpoint definitions for Mercury integration
**Status**: Ready for Implementation

---

## Overview

This document defines all API endpoints for Mercury Bank integration, including connection management, transaction sync, merchant mapping, and categorization rules.

---

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://devlabs-cfo.vercel.app/api`

---

## Authentication

All endpoints require authenticated user session (Supabase Auth).

**Headers**:
```http
Cookie: sb-access-token=<session_token>
Content-Type: application/json
```

**Authorization Checks**:
- All endpoints verify user belongs to organization
- Connection management requires `ADMIN` or `FINANCE_ADMIN` role
- Manual sync requires `ADMIN` or `FINANCE_ADMIN` role

---

## Connection Management Endpoints

### POST /api/mercury/connect

**Purpose**: Connect Mercury account using API key

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**:
```typescript
{
  api_key: string;  // Mercury API key from dashboard
}
```

**Response Success (200)**:
```typescript
{
  success: true;
  connection: {
    id: string;
    organization_id: string;
    connection_status: 'ACTIVE';
    created_at: string;  // ISO 8601
  }
}
```

**Response Error (400)**:
```typescript
{
  error: string;  // "Invalid API key" | "API key already exists"
}
```

**Response Error (401)**:
```typescript
{
  error: 'Unauthorized';
  message: 'Requires ADMIN or FINANCE_ADMIN role';
}
```

**Implementation Notes**:
1. Validate API key by making test call to Mercury API
2. Encrypt API key before storing
3. Check for existing ACTIVE connection (prevent duplicates)
4. Create mercury_connection record
5. Trigger initial sync (optional)

---

### POST /api/mercury/disconnect

**Purpose**: Disconnect Mercury account

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**: None

**Response Success (200)**:
```typescript
{
  success: true;
  message: 'Mercury account disconnected successfully';
}
```

**Response Error (404)**:
```typescript
{
  error: 'Connection not found';
}
```

**Implementation Notes**:
1. Find active mercury_connection for user's organization
2. Set connection_status = 'DISCONNECTED'
3. Set deleted_at = NOW() (soft delete)
4. Keep sync logs and merchant mappings for historical reference
5. Optionally mark all mercury-synced expenses as sync_status = 'MANUAL'

---

### GET /api/mercury/connection/status

**Purpose**: Get current Mercury connection status

**Authentication**: Required

**Query Parameters**: None

**Response Success (200)**:
```typescript
{
  connected: boolean;
  connection?: {
    id: string;
    organization_id: string;
    connection_status: 'ACTIVE' | 'DISCONNECTED' | 'API_ERROR';
    last_sync_at: string | null;  // ISO 8601
    last_sync_status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
    created_at: string;  // ISO 8601
  }
}
```

**Response Not Connected (200)**:
```typescript
{
  connected: false;
}
```

---

## Sync Endpoints

### POST /api/mercury/sync

**Purpose**: Trigger manual transaction sync

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**:
```typescript
{
  sync_type: 'TRANSACTIONS' | 'BALANCES' | 'FULL';  // Default: FULL
}
```

**Response Success (200)**:
```typescript
{
  success: true;
  sync_log_id: string;
  message: 'Sync started successfully';
}
```

**Response Error (404)**:
```typescript
{
  error: 'No active Mercury connection found';
}
```

**Response Error (409)**:
```typescript
{
  error: 'Sync already in progress';
  current_sync_id: string;
}
```

**Implementation Notes**:
1. Check for active connection
2. Check if sync already running (status = 'RUNNING')
3. Create sync_log with status = 'PENDING'
4. Update to status = 'RUNNING'
5. Execute sync asynchronously
6. Update sync_log with results (status, counts, errors)
7. Return immediately (don't wait for sync completion)

---

### GET /api/mercury/sync/cron

**Purpose**: Scheduled sync endpoint (called by Vercel Cron)

**Authentication**: CRON_SECRET required

**Headers**:
```http
Authorization: Bearer <CRON_SECRET>
```

**Query Parameters**: None

**Response Success (200)**:
```typescript
{
  success: true;
  synced_organizations: number;
  sync_log_ids: string[];
}
```

**Response Error (401)**:
```typescript
{
  error: 'Unauthorized';
  message: 'Invalid CRON_SECRET';
}
```

**Implementation Notes**:
1. Verify CRON_SECRET from Authorization header
2. Find all active mercury_connections
3. Trigger sync for each connection
4. Return count of synced organizations
5. Syncs run asynchronously (don't block response)

---

### GET /api/mercury/sync/status

**Purpose**: Get sync history and current sync status

**Authentication**: Required

**Query Parameters**:
```typescript
{
  limit?: number;   // Default: 50, Max: 100
  offset?: number;  // Default: 0
  status?: 'SUCCESS' | 'FAILED' | 'PARTIAL';  // Filter by status
}
```

**Response Success (200)**:
```typescript
{
  current_sync: {
    id: string;
    status: 'RUNNING';
    started_at: string;
    sync_type: 'TRANSACTIONS' | 'BALANCES' | 'FULL';
  } | null;
  recent_syncs: Array<{
    id: string;
    sync_type: 'TRANSACTIONS' | 'BALANCES' | 'FULL';
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    transactions_processed: number;
    transactions_failed: number;
    balances_updated: number;
    triggered_by: 'SYSTEM' | 'MANUAL' | 'RETRY';
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }
}
```

---

### GET /api/mercury/sync/logs/:id

**Purpose**: Get detailed sync log with errors

**Authentication**: Required

**URL Parameters**:
- `id`: Sync log ID (UUID)

**Response Success (200)**:
```typescript
{
  sync_log: {
    id: string;
    connection_id: string;
    sync_type: 'TRANSACTIONS' | 'BALANCES' | 'FULL';
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    transactions_processed: number;
    transactions_failed: number;
    balances_updated: number;
    errors: Array<{
      type: 'API_ERROR' | 'MAPPING_FAILURE' | 'CATEGORIZATION_FAILURE' | 'VALIDATION_ERROR' | 'RATE_LIMIT';
      message: string;
      context?: {
        transaction_id?: string;
        merchant_name?: string;
        http_status?: number;
        retry_count?: number;
      };
      timestamp: string;
    }> | null;
    triggered_by: 'SYSTEM' | 'MANUAL' | 'RETRY';
    triggered_by_user_id: string | null;
  }
}
```

**Response Error (404)**:
```typescript
{
  error: 'Sync log not found';
}
```

---

### POST /api/mercury/sync/retry

**Purpose**: Retry a failed sync

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**:
```typescript
{
  sync_log_id: string;  // ID of failed sync to retry
}
```

**Response Success (200)**:
```typescript
{
  success: true;
  new_sync_log_id: string;
  original_sync_log_id: string;
}
```

**Response Error (400)**:
```typescript
{
  error: 'Cannot retry sync';
  message: 'Sync must have status FAILED or PARTIAL';
}
```

**Implementation Notes**:
1. Find original sync_log
2. Verify status is FAILED or PARTIAL
3. Create new sync_log with triggered_by = 'RETRY'
4. Execute sync with same sync_type
5. Return new sync_log_id

---

## Merchant Mapping Endpoints

### GET /api/mercury/merchants/unmapped

**Purpose**: Get list of unmapped merchants

**Authentication**: Required

**Query Parameters**:
```typescript
{
  limit?: number;  // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```

**Response Success (200)**:
```typescript
{
  unmapped_merchants: Array<{
    id: string;
    mercury_merchant_name: string;
    normalized_merchant_name: string;
    transaction_count: number;  // Number of transactions with this merchant
    total_amount: number;        // Total amount across all transactions
    first_seen: string;         // ISO 8601
    last_seen: string;          // ISO 8601
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }
}
```

---

### POST /api/mercury/merchants/map

**Purpose**: Manually map merchant to contractor

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**:
```typescript
{
  merchant_name: string;       // Merchant name to map
  contractor_id: string;       // Target contractor ID
}
```

**Response Success (200)**:
```typescript
{
  success: true;
  mapping: {
    id: string;
    mercury_merchant_name: string;
    contractor_id: string;
    mapping_confidence: 'MANUAL';
    mapped_by: 'ADMIN_USER';
    mapped_at: string;  // ISO 8601
  }
}
```

**Response Error (404)**:
```typescript
{
  error: 'Contractor not found';
}
```

**Implementation Notes**:
1. Validate contractor_id exists and belongs to organization
2. Create or update merchant_mapping_cache entry
3. Set mapping_confidence = 'MANUAL', mapped_by = 'ADMIN_USER'
4. Optionally reprocess unprocessed transactions with this merchant

---

### GET /api/mercury/merchants/mapped

**Purpose**: Get all merchant-to-contractor mappings

**Authentication**: Required

**Query Parameters**:
```typescript
{
  mapping_confidence?: 'EXACT' | 'FUZZY' | 'MANUAL';  // Filter by confidence
  limit?: number;  // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```

**Response Success (200)**:
```typescript
{
  mappings: Array<{
    id: string;
    mercury_merchant_name: string;
    contractor: {
      id: string;
      name: string;
    };
    mapping_confidence: 'EXACT' | 'FUZZY' | 'MANUAL';
    confidence_score: number | null;
    mapped_by: 'SYSTEM' | 'ADMIN_USER';
    mapped_at: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }
}
```

---

## Categorization Rules Endpoints

### GET /api/mercury/rules

**Purpose**: Get all categorization rules

**Authentication**: Required

**Query Parameters**:
```typescript
{
  is_active?: boolean;  // Filter by active/inactive
  category?: 'CONTRACTOR' | 'SUBSCRIPTION' | 'OVERHEAD' | 'PAYROLL' | 'OTHER';
}
```

**Response Success (200)**:
```typescript
{
  rules: Array<{
    id: string;
    rule_type: 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE';
    pattern: string;
    category: 'CONTRACTOR' | 'SUBSCRIPTION' | 'OVERHEAD' | 'PAYROLL' | 'OTHER';
    priority: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
}
```

---

### POST /api/mercury/rules

**Purpose**: Create new categorization rule

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**Request Body**:
```typescript
{
  rule_type: 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE';
  pattern: string;  // Regex or "min-max" for AMOUNT_RANGE
  category: 'CONTRACTOR' | 'SUBSCRIPTION' | 'OVERHEAD' | 'PAYROLL' | 'OTHER';
  priority?: number;  // Default: 100
}
```

**Response Success (201)**:
```typescript
{
  success: true;
  rule: {
    id: string;
    rule_type: 'MERCHANT_NAME' | 'DESCRIPTION_KEYWORD' | 'AMOUNT_RANGE';
    pattern: string;
    category: string;
    priority: number;
    is_active: true;
    created_at: string;
  }
}
```

**Response Error (400)**:
```typescript
{
  error: 'Invalid pattern';
  message: 'Pattern must be valid regex for MERCHANT_NAME type';
}
```

**Validation Rules**:
- pattern must be valid regex if rule_type is MERCHANT_NAME or DESCRIPTION_KEYWORD
- pattern must be format "min-max" if rule_type is AMOUNT_RANGE
- priority must be 1-1000

---

### PUT /api/mercury/rules/:id

**Purpose**: Update categorization rule

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**URL Parameters**:
- `id`: Rule ID (UUID)

**Request Body**:
```typescript
{
  pattern?: string;
  category?: 'CONTRACTOR' | 'SUBSCRIPTION' | 'OVERHEAD' | 'PAYROLL' | 'OTHER';
  priority?: number;
  is_active?: boolean;
}
```

**Response Success (200)**:
```typescript
{
  success: true;
  rule: {
    id: string;
    rule_type: string;
    pattern: string;
    category: string;
    priority: number;
    is_active: boolean;
    updated_at: string;
  }
}
```

---

### DELETE /api/mercury/rules/:id

**Purpose**: Delete categorization rule

**Authentication**: Required (ADMIN or FINANCE_ADMIN)

**URL Parameters**:
- `id`: Rule ID (UUID)

**Response Success (200)**:
```typescript
{
  success: true;
  message: 'Rule deleted successfully';
}
```

**Response Error (404)**:
```typescript
{
  error: 'Rule not found';
}
```

---

## Balance History Endpoints

### GET /api/mercury/balances

**Purpose**: Get current account balances

**Authentication**: Required

**Query Parameters**: None

**Response Success (200)**:
```typescript
{
  accounts: Array<{
    mercury_account_id: string;
    account_name: string;
    account_type: 'CHECKING' | 'SAVINGS' | 'TREASURY';
    current_balance: number;
    available_balance: number;
    last_updated: string;  // ISO 8601
  }>;
  total_balance: number;  // Sum of all current balances
}
```

---

### GET /api/mercury/balances/history

**Purpose**: Get balance history over time

**Authentication**: Required

**Query Parameters**:
```typescript
{
  mercury_account_id?: string;  // Filter by specific account
  start_date?: string;          // ISO 8601 date (default: 30 days ago)
  end_date?: string;            // ISO 8601 date (default: today)
  account_type?: 'CHECKING' | 'SAVINGS' | 'TREASURY';  // Filter by type
}
```

**Response Success (200)**:
```typescript
{
  snapshots: Array<{
    snapshot_date: string;  // ISO 8601 date
    mercury_account_id: string;
    account_name: string;
    account_type: 'CHECKING' | 'SAVINGS' | 'TREASURY';
    current_balance: number;
    available_balance: number;
  }>;
  total_snapshots: number;
}
```

---

## Error Responses

### Standard Error Format

All endpoints return errors in this format:

```typescript
{
  error: string;         // Error type
  message?: string;      // Human-readable error message
  details?: any;         // Additional error context
}
```

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required or CRON_SECRET invalid
- **403 Forbidden**: User lacks required role/permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., sync already running)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error

---

## Rate Limiting

**Client-side rate limits** (per user):
- **Connection management**: 10 requests per minute
- **Manual sync**: 5 requests per minute (to prevent abuse)
- **Merchant mapping**: 30 requests per minute
- **Categorization rules**: 30 requests per minute
- **Read endpoints**: 100 requests per minute

**Mercury API rate limits** (enforced by Mercury):
- Handled by bottleneck rate limiter
- 429 responses trigger exponential backoff
- See research.md for details

---

## Webhooks (Future Phase)

### POST /api/webhooks/mercury

**Purpose**: Receive real-time transaction updates from Mercury

**Authentication**: HMAC signature verification

**Headers**:
```http
X-Mercury-Signature: <hmac_signature>
Content-Type: application/json
```

**Request Body**:
```typescript
{
  type: 'transaction.created' | 'transaction.updated' | 'transaction.deleted';
  data: {
    transaction: MercuryTransaction;
  };
  timestamp: string;  // ISO 8601
}
```

**Response Success (200)**:
```typescript
{
  received: true;
}
```

**Implementation** (Phase 2):
1. Verify HMAC signature using Partner Secret
2. Parse webhook body
3. Process transaction (create/update expense record)
4. Return 200 immediately (process async)

---

## TypeScript Types

All request/response types available in:
- `types/mercury-api.ts` - API endpoint types
- `types/mercury-integration.ts` - Mercury transaction types

**Usage**:
```typescript
import type { MercurySyncRequest, MercurySyncResponse } from '@/types/mercury-api';

export async function POST(request: NextRequest): Promise<NextResponse<MercurySyncResponse>> {
  const body: MercurySyncRequest = await request.json();
  // ...
}
```

---

## Next Steps

1. Implement API routes in `app/api/mercury/`
2. Create Zod validation schemas for all request/response types
3. Write integration tests for all endpoints
4. Document in Postman/OpenAPI spec (optional)

**API contracts complete** ✅
