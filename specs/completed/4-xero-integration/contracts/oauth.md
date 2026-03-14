# Xero OAuth 2.0 API Contract

**Feature**: Xero OAuth 2.0 Integration
**Version**: 1.0
**Created**: 2026-02-14

---

## Overview

This document defines the API contracts for Xero OAuth 2.0 authentication endpoints including authorization, callback, and disconnection flows.

---

## Endpoints

### 1. GET /api/xero/oauth/authorize

**Purpose**: Initiate OAuth 2.0 authorization flow by redirecting user to Xero consent screen.

**Authentication**: Required (authenticated user)

**Request**:
- **Method**: GET
- **Headers**:
  - `Cookie`: Session cookie with authenticated user
- **Query Parameters**: None

**Response**:
- **Status**: 302 (Redirect)
- **Headers**:
  - `Location`: Xero authorization URL
    ```
    https://login.xero.com/identity/connect/authorize?
      response_type=code&
      client_id={XERO_CLIENT_ID}&
      redirect_uri={XERO_REDIRECT_URI}&
      scope=offline_access accounting.transactions.read accounting.contacts.read&
      state={CSRF_TOKEN}
    ```

**Flow**:
1. Get authenticated user's organization_id
2. Generate CSRF token, store in session
3. Build Xero authorization URL with required scopes
4. Redirect user to Xero

**Error Responses**:
- `401 Unauthorized`: User not authenticated
  ```json
  { "error": "Authentication required" }
  ```
- `500 Internal Server Error`: Failed to generate authorization URL
  ```json
  { "error": "Failed to initiate OAuth flow" }
  ```

---

### 2. GET /api/xero/oauth/callback

**Purpose**: Handle OAuth callback from Xero, exchange authorization code for access/refresh tokens, encrypt and store tokens.

**Authentication**: Required (session with CSRF token)

**Request**:
- **Method**: GET
- **Headers**:
  - `Cookie`: Session cookie with CSRF token
- **Query Parameters**:
  - `code` (required): Authorization code from Xero
  - `state` (required): CSRF token (must match session)
  - `scope` (optional): Granted scopes (space-separated)

**Response**:
- **Success**: 302 (Redirect)
  - **Headers**:
    - `Location`: `/dashboard/integrations/xero?status=connected`

**Flow**:
1. Validate CSRF token matches session state
2. Exchange authorization code for access/refresh tokens (Xero API)
3. Get Xero tenant ID (organization identifier)
4. Encrypt access_token and refresh_token
5. Store encrypted tokens in `xero_connections` table
6. Create default expense category mappings
7. Redirect to integration dashboard with success message

**Error Responses**:
- `400 Bad Request`: Invalid authorization code or state
  ```json
  { "error": "Invalid authorization code" }
  ```
- `403 Forbidden`: CSRF token mismatch
  ```json
  { "error": "CSRF token validation failed" }
  ```
- `500 Internal Server Error`: Failed to exchange code or store tokens
  ```json
  { "error": "Failed to complete OAuth flow", "details": "Token exchange failed" }
  ```
  - Redirect: `/dashboard/integrations/xero?status=error&message={error}`

**Database Changes**:
- **Insert**: `xero_connections` record with encrypted tokens
- **Insert**: Default `xero_expense_category_mappings` (contractor, subscription, overhead)

**Audit Log**:
- `action_type`: "XERO_CONNECT"
- `actor_id`: Current user ID
- `action_details`: `{ xero_tenant_id, scopes_granted }`

---

### 3. POST /api/xero/oauth/disconnect

**Purpose**: Disconnect Xero integration, revoke tokens, and delete connection record.

**Authentication**: Required (admin or finance admin role)

**Request**:
- **Method**: POST
- **Headers**:
  - `Cookie`: Session cookie with authenticated user
  - `Content-Type`: application/json
- **Body**:
  ```json
  {
    "confirm": true
  }
  ```

**Response**:
- **Success**: 200 OK
  ```json
  {
    "success": true,
    "message": "Xero connection disconnected successfully"
  }
  ```

**Flow**:
1. Get user's organization_id
2. Find xero_connection for organization
3. Decrypt tokens
4. Revoke tokens with Xero API (optional - tokens expire in 60 days anyway)
5. Delete xero_connection record (CASCADE deletes sync_logs, contact_mappings, expense_mappings)
6. Update revenue_records and expense_records: Set sync_status = MANUAL for Xero-synced records
7. Return success

**Error Responses**:
- `401 Unauthorized`: User not authenticated
  ```json
  { "error": "Authentication required" }
  ```
- `403 Forbidden`: User not admin/finance admin
  ```json
  { "error": "Insufficient permissions" }
  ```
- `404 Not Found`: No Xero connection exists
  ```json
  { "error": "No Xero connection found for this organization" }
  ```
- `500 Internal Server Error`: Failed to disconnect
  ```json
  { "error": "Failed to disconnect Xero", "details": "Database error" }
  ```

**Database Changes**:
- **Delete**: `xero_connections` record (CASCADE deletes related records)
- **Update**: `revenue_records` and `expense_records` where sync_status = SYNCED → MANUAL

**Audit Log**:
- `action_type`: "XERO_DISCONNECT"
- `actor_id`: Current user ID
- `action_details`: `{ xero_tenant_id, connection_id }`

---

## Data Models

### XeroConnection (Database Table)

```typescript
interface XeroConnection {
  id: string;                     // UUID
  organization_id: string;        // UUID (foreign key)
  xero_tenant_id: string;         // Xero organization identifier
  access_token: string;           // Encrypted OAuth access token
  refresh_token: string;          // Encrypted OAuth refresh token
  token_expiry: Date;             // Access token expiration timestamp
  scopes_granted: string[];       // Array of granted scopes
  connection_status: ConnectionStatus; // ACTIVE, DISCONNECTED, TOKEN_EXPIRED, ERROR
  last_sync_at: Date | null;      // Last successful sync timestamp
  last_sync_status: SyncStatus | null; // SUCCESS, FAILED, PARTIAL
  created_at: Date;
  updated_at: Date;
}

enum ConnectionStatus {
  ACTIVE = 'ACTIVE',
  DISCONNECTED = 'DISCONNECTED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  ERROR = 'ERROR'
}

enum SyncStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL'
}
```

---

## Security Considerations

### CSRF Protection
- Generate random CSRF token on `/authorize` request
- Store token in httpOnly session cookie
- Validate token on `/callback` request (must match session)

### Token Encryption
- Encrypt access_token and refresh_token using AES-256-GCM
- Encryption key stored in `XERO_TOKEN_ENCRYPTION_KEY` environment variable
- Never log tokens in plain text

### Redirect URI Validation
- OAuth redirect URI must match registered URI in Xero Developer Portal
- Validate state parameter to prevent CSRF attacks

### Scope Validation
- Request minimum required scopes: `offline_access`, `accounting.transactions.read`, `accounting.contacts.read`
- Validate granted scopes match requested scopes

---

## Testing Checklist

### Unit Tests
- [ ] Test CSRF token generation and validation
- [ ] Test token encryption/decryption roundtrip
- [ ] Test authorization URL construction

### Integration Tests
- [ ] Test OAuth flow with mock Xero API
- [ ] Test token storage and retrieval
- [ ] Test disconnect flow with CASCADE deletes

### E2E Tests
- [ ] Test complete OAuth flow in browser
- [ ] Test error handling (invalid code, CSRF mismatch)
- [ ] Test disconnect and reconnect

---

## Example Flows

### Successful OAuth Connection

```
User → GET /api/xero/oauth/authorize
       ← 302 Redirect to Xero
       → User authorizes on Xero site
       ← 302 Redirect to /api/xero/oauth/callback?code=ABC&state=XYZ
       → POST to Xero token endpoint
       ← Receive access_token, refresh_token, tenant_id
       → Encrypt tokens
       → INSERT into xero_connections
       → INSERT default expense_category_mappings
       ← 302 Redirect to /dashboard/integrations/xero?status=connected
```

### OAuth Callback Error (CSRF Mismatch)

```
User → GET /api/xero/oauth/callback?code=ABC&state=INVALID
       → Validate state !== session CSRF token
       ← 403 Forbidden
       ← 302 Redirect to /dashboard/integrations/xero?status=error&message=CSRF+validation+failed
```

### Disconnect Flow

```
Admin → POST /api/xero/oauth/disconnect { confirm: true }
        → GET xero_connection for organization
        → Decrypt tokens
        → Optional: Revoke with Xero API
        → DELETE xero_connection (CASCADE)
        → UPDATE revenue_records SET sync_status = 'MANUAL'
        ← 200 OK { success: true }
```

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `XERO_CLIENT_ID` | Yes | OAuth client ID from Xero Developer Portal | `A1B2C3D4E5F6...` |
| `XERO_CLIENT_SECRET` | Yes | OAuth client secret | `X9Y8Z7W6V5U4...` |
| `XERO_REDIRECT_URI` | Yes | OAuth callback URL (must match Xero app config) | `https://devlabs-cfo.vercel.app/api/xero/oauth/callback` |
| `XERO_TOKEN_ENCRYPTION_KEY` | Yes | 32-byte base64-encoded AES key | `base64:ABC123...` |

---

## Rate Limits

Xero API rate limits (not applicable to OAuth endpoints):
- Token endpoint: No published limit (reasonable use expected)
- Authorization endpoint: No published limit

---

## References

- [Xero OAuth 2.0 Documentation](https://developer.xero.com/documentation/guides/oauth2/overview)
- [Xero OAuth 2.0 Scopes](https://developer.xero.com/documentation/guides/oauth2/scopes)
- [xero-node SDK OAuth Guide](https://github.com/XeroAPI/xero-node#oauth-20)
