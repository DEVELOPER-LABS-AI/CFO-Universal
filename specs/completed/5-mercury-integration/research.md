# Research Findings: Mercury Banking Integration

**Created**: 2026-02-15
**Purpose**: Resolve technical clarifications for Mercury integration implementation
**Status**: Complete

---

## Research Summary

This document consolidates research findings for six critical technical questions about Mercury Bank's API. All findings inform architecture decisions and implementation strategy.

---

## R1: Authentication Flow

### Decision: Use API Key Authentication

**Finding**: Mercury supports both OAuth 2.0 and API Key authentication.

**API Key Method** (Recommended for internal integration):
- HTTP Basic Authentication: API key as username, empty password
- Bearer Token: `Authorization: Bearer {API_KEY}`
- Simple, immediate access without OAuth flow
- No token refresh required

**OAuth 2.0 Method** (For customer-facing products):
- Authorization Code Grant Type
- PKCE supported (Proof Key for Code Exchange)
- Requires prior approval from Mercury
- Access tokens expire and need refresh

**Rationale**: Since DevLabs CFO is an internal tool where admins connect their own Mercury accounts, API Key provides simpler implementation without OAuth complexity. Admin generates API key from Mercury dashboard and pastes into DevLabs CFO.

**Implementation Notes**:
```typescript
// Store API key encrypted (not OAuth tokens)
await prisma.mercuryConnection.create({
  data: {
    organization_id: orgId,
    api_key_encrypted: await encryptToken(apiKey),
    connection_status: 'ACTIVE',
  }
});

// Use in API calls
const headers = {
  'Authorization': `Bearer ${decryptedApiKey}`,
  'Content-Type': 'application/json'
};
```

**Security**:
- API keys encrypted at rest (same AES-256-GCM as OAuth tokens)
- Never log API keys in plain text
- Rotation supported (re-encrypt on rotation)

**Impact on Plan**:
- ✅ Simpler than OAuth (no callback endpoint, no token refresh)
- ✅ Reduces implementation time by ~1 day
- ⚠️ Admin must generate API key manually from Mercury dashboard

---

## R2: SDK Availability

### Decision: Use Direct HTTP Calls with Axios

**Finding**: No official Mercury SDK. Third-party options exist but limited.

**Available Packages**:
- `@paperos/mercury-bank`: Unofficial SDK with webhook support
- `@earlybird-labs/mercury-banking-mcp`: Community package

**Evaluation**:
| Package | Pros | Cons | Verdict |
|---------|------|------|---------|
| @paperos/mercury-bank | Webhook signature verification, TypeScript support | Unmaintained (2+ years), requires Partner ID/Secret | ❌ Not suitable |
| Official SDK | N/A | Doesn't exist | N/A |
| axios + TypeScript | Full control, lightweight, well-maintained | Manual implementation | ✅ **Recommended** |

**Rationale**: Building lightweight wrapper around Mercury's REST API provides:
- Full control over API calls and error handling
- No dependency on third-party unmaintained packages
- Easy to adapt as Mercury API evolves
- Proven pattern (similar to current Xero implementation if not using official SDK)

**Implementation**:
```typescript
// lib/mercury/client.ts
import axios, { AxiosInstance } from 'axios';

export class MercuryClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.mercury.com/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getTransactions(params: {
    limit?: number;
    start_after?: string;
    end_before?: string;
  }) {
    const response = await this.client.get('/transactions', { params });
    return response.data;
  }

  async getAccountBalance(accountId: string) {
    const response = await this.client.get(`/account/${accountId}`);
    return response.data;
  }
}
```

**Impact on Plan**:
- ✅ Lightweight implementation (no large SDK dependency)
- ✅ Easy to test and mock
- ⚠️ Requires manual typing of Mercury API responses (mitigated with Zod schemas)

---

## R3: API Rate Limits

### Decision: Implement Adaptive Rate Limiting with Monitoring

**Finding**: Rate limits not publicly documented.

**What We Know**:
- No explicit limits in public documentation
- Standard banking API practices suggest conservative limits exist
- 429 responses indicate rate limit exceeded
- Contact api@mercury.com for specific limits

**Implementation Strategy**:
```typescript
// lib/mercury/rate-limiter.ts
import Bottleneck from 'bottleneck';

// Conservative initial limits (adjust after contacting Mercury)
const limiter = new Bottleneck({
  maxConcurrent: 5,        // Max 5 concurrent requests
  minTime: 1000,           // Min 1 second between requests
  reservoir: 60,           // 60 requests per...
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000  // ...60 seconds
});

// Wrap all Mercury API calls
export async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  return limiter.schedule(fn);
}

// Handle 429 responses
limiter.on('failed', async (error, jobInfo) => {
  if (error.response?.status === 429) {
    const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
    console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
    return retryAfter * 1000; // Bottleneck will wait this many ms before retry
  }
});
```

**Monitoring**:
- Log all 429 responses with timestamps
- Track requests per minute in sync logs
- Alert if rate limits consistently hit

**Action Item**:
- **TODO**: Contact api@mercury.com before production deployment
- **TODO**: Adjust limiter config based on Mercury's response
- **TODO**: Monitor initial production syncs for rate limit violations

**Impact on Plan**:
- ✅ Reuses Bottleneck pattern from Xero integration
- ✅ Gracefully handles rate limits without sync failures
- ⚠️ Initial conservative limits may slow first sync (acceptable trade-off)

---

## R4: Transaction Data Structure

### Decision: Design Expense Record Schema Around Mercury's Transaction Object

**Finding**: Mercury transaction API returns comprehensive financial data.

**Core Transaction Fields**:
```typescript
interface MercuryTransaction {
  id: string;                      // Unique transaction ID
  amount: number;                  // In dollars (USD)
  bankDescription: string | null;  // Bank's description of transaction
  counterpartyId: string;          // ID of other party
  counterpartyName: string;        // Merchant/payee name
  counterpartyNickname: string | null;
  createdAt: string;               // ISO 8601 timestamp
  dashboardLink: string;           // Link to Mercury dashboard

  // Detailed routing/account info (for wires, ACH, etc.)
  details: {
    address?: Address;
    domesticWireRoutingInfo?: DomesticWire;
    electronicRoutingInfo?: ACH;
    internationalWireRoutingInfo?: InternationalWire;
  };
}

interface MercuryTransactionsResponse {
  total: number;
  transactions: MercuryTransaction[];
}
```

**Pagination Support**:
- Cursor-based: `limit`, `order`, `start_after`, `end_before`
- No page number pagination (avoids skipped/duplicate records)

**Mapping to Expense Records**:
```typescript
// Map Mercury transaction → ExpenseRecord
{
  mercury_transaction_id: transaction.id,
  amount: transaction.amount,  // Already in USD
  description: transaction.bankDescription || transaction.counterpartyName,
  merchant_name: transaction.counterpartyName,
  transaction_date: new Date(transaction.createdAt),
  // ...categorization, contractor mapping
}
```

**Implementation Notes**:
- Use `id` for deduplication (unique constraint)
- Use `counterpartyName` for merchant-to-contractor mapping
- Use `bankDescription` for categorization keywords
- Use `createdAt` for transaction timestamp
- Use cursor pagination for large sync operations

**Impact on Plan**:
- ✅ Clear field mapping to expense records
- ✅ Cursor pagination prevents data loss in large syncs
- ✅ `counterpartyName` enables merchant matching

---

## R5: Multi-Currency Support

### Decision: Store USD Amounts Only (Foreign Currency Already Converted)

**Finding**: Mercury automatically converts foreign currency to USD before transactions hit account.

**Key Facts**:
- **Inbound foreign currency**: Converted to USD before deposit
- **Outbound foreign currency**: Sent in foreign currency, but debited in USD equivalent
- **Conversion fee**: 1% for non-USD international wires
- **Exchange rates**: Not locked for recurring payments; use rate on processing date
- **API representation**: All amounts in USD (post-conversion)

**Implications**:
```typescript
// Mercury API returns transactions in USD
interface MercuryTransaction {
  amount: number;  // Already in USD (post-conversion)
  currency: 'USD'; // Always USD
}

// No need for currency conversion logic
await prisma.expenseRecord.create({
  data: {
    mercury_transaction_id: transaction.id,
    amount: transaction.amount,  // USD
    // No original_amount, original_currency, exchange_rate needed
  }
});
```

**Simplification from Original Plan**:
- ❌ **Removed**: `original_amount`, `original_currency`, `exchange_rate` fields
- ❌ **Removed**: Currency conversion logic in sync layer
- ✅ **Simplified**: All transactions stored as USD amounts
- ✅ **Assumption Updated**: Mercury handles conversion upstream

**Impact on Spec**:
- Update assumption: "Foreign currency transactions automatically converted to USD by Mercury"
- Remove currency fields from data requirements
- Simplify sync implementation (no conversion logic)

**Impact on Plan**:
- ✅ Reduces implementation complexity significantly
- ✅ Removes potential for conversion errors
- ✅ Faster sync performance (no extra calculations)
- ⚠️ Cannot reconstruct original foreign currency amount (acceptable - not in MVP scope)

---

## R6: Account Types and Balance Tracking

### Decision: Support Checking, Savings, and Treasury Accounts

**Finding**: Mercury provides three account types with programmatic balance access.

**Account Types**:

1. **Checking Accounts**:
   - Standard business checking
   - Routing and account numbers provided
   - Most common account type
   - API: `/account/{id}`

2. **Savings Accounts**:
   - Interest-bearing savings
   - FDIC insured
   - API: `/account/{id}`

3. **Treasury Accounts**:
   - High-yield treasury accounts
   - Available for balances > $250,000
   - API: `/treasury` (separate endpoint)

**Balance Fields**:
```typescript
interface MercuryAccount {
  id: string;
  availableBalance: number;  // In dollars, accounts for pending
  currentBalance: number;     // In dollars, includes pending
  createdAt: string;
  status: 'active' | 'deleted' | 'pending' | 'archived';
  accountNumber?: string;
  routingNumber?: string;
}
```

**Implementation Strategy**:
```typescript
// lib/mercury/account-sync.ts
async function syncAccountBalances(apiKey: string) {
  const client = new MercuryClient(apiKey);

  // Get all accounts (checking + savings)
  const accounts = await client.getAccounts();

  // Get treasury accounts separately
  const treasury = await client.getTreasuryAccounts();

  const allAccounts = [...accounts, ...treasury];

  for (const account of allAccounts) {
    await prisma.accountBalanceHistory.create({
      data: {
        mercury_account_id: account.id,
        account_type: determinetype(account),  // CHECKING, SAVINGS, TREASURY
        balance: account.currentBalance,       // For reporting
        available_balance: account.availableBalance,  // For withdrawal limits
        snapshot_date: new Date(),
      }
    });
  }
}
```

**Balance Usage**:
- **currentBalance**: Use for accounting/reporting (includes pending transactions)
- **availableBalance**: Use for withdrawal calculations (excludes pending)

**Impact on Plan**:
- ✅ Supports all Mercury account types
- ✅ Accurate balance tracking with pending transaction awareness
- ⚠️ Requires separate API call for treasury accounts (acceptable - rare use case)

---

## Bonus Finding: Webhooks for Real-Time Updates

### Recommendation: Implement Webhooks for Future Enhancement

**Finding**: Mercury supports real-time webhooks for transaction updates.

**Capabilities**:
- **Event Types**: Transaction created, transaction updated, transaction deleted
- **Security**: HMAC signature verification using Partner Secret
- **Reliability**: Failed deliveries retry with exponential backoff
- **Filtering**: Subscribe to specific event types only

**Implementation (Future Phase 2)**:
```typescript
// app/api/webhooks/mercury/route.ts
import { verifyWebhookSignature } from '@paperos/mercury-bank';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-mercury-signature');

  // Verify signature before parsing
  if (!verifyWebhookSignature(body, signature, process.env.MERCURY_PARTNER_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.type === 'transaction.created') {
    await syncSingleTransaction(event.data.transaction);
  }

  return NextResponse.json({ received: true });
}
```

**Benefits**:
- ✅ Real-time transaction updates (no polling delay)
- ✅ Reduces API calls (no scheduled polling needed)
- ✅ Lower latency for cash flow visibility

**Out of MVP Scope**:
- Requires Partner ID and Partner Secret (need Mercury approval)
- Adds webhook endpoint security and verification
- Requires idempotent handling of duplicate events

**Action Item**:
- **Phase 2**: Apply for Mercury Partner Program
- **Phase 2**: Implement webhook signature verification
- **Phase 2**: Migrate from polling to event-driven sync

---

## Summary of Implementation Changes

### Updated Architecture Decisions

| Original Plan | Research Finding | Updated Decision |
|---------------|------------------|------------------|
| OAuth 2.0 flow | API Key simpler | Use API Key authentication |
| Use Mercury SDK if available | No official SDK exists | Build axios wrapper |
| TBD rate limits | Not documented | Conservative limits + monitoring |
| Support multi-currency | Mercury converts upstream | Store USD only |
| Poll for transactions | Webhooks available | MVP: Polling, Phase 2: Webhooks |

### Revised Timeline Impact

**Time Savings**:
- OAuth implementation: -1 day (API Key simpler)
- Currency conversion: -0.5 days (not needed)
- **Total savings**: 1.5 days

**Revised Estimate**: 5-6 days (down from 6-8 days)

### Updated Dependencies

**npm Packages**:
- ✅ `axios` - HTTP client for Mercury API
- ✅ `bottleneck` - Rate limiting (reuse from Xero)
- ✅ `string-similarity` - Merchant matching (reuse from Xero)
- ❌ ~~`@paperos/mercury-bank`~~ - Not needed for MVP (Phase 2 for webhooks)

**Environment Variables**:
- `MERCURY_API_KEY` (not CLIENT_ID/SECRET)
- `ENCRYPTION_KEY` (shared with Xero)
- `CRON_SECRET` (shared with Xero)

---

## Next Steps

1. **Update plan.md**:
   - Remove OAuth endpoints (use simple connect/disconnect)
   - Remove currency conversion logic
   - Simplify data model (no foreign currency fields)

2. **Create data-model.md**:
   - Define mercury_connections (store API key, not OAuth tokens)
   - Define mercury_sync_logs
   - Define merchant_mapping_cache
   - Define transaction_categorization_rules
   - Define account_balance_history
   - Update expense_records (no currency fields)

3. **Define API contracts**:
   - GET /api/mercury/connect (accept API key)
   - POST /api/mercury/disconnect
   - POST /api/mercury/sync
   - GET /api/mercury/sync/status
   - Mercury API wrapper methods

4. **Proceed to tasks.md generation**

---

**Research Complete**: All [NEEDS CLARIFICATION] markers resolved ✅

**Sources**:
- [Mercury API Documentation](https://docs.mercury.com/reference/welcome-to-mercury-api)
- [Mercury OAuth Integration](https://docs.mercury.com/docs/integrations-with-oauth2)
- [Mercury Transactions API](https://docs.mercury.com/reference/transactions-1)
- [Mercury Treasury API](https://docs.mercury.com/reference/treasury-1)
- [Mercury Webhooks](https://docs.mercury.com/changelog/webhooks-now-avaliable)
- [@paperos/mercury-bank npm](https://www.npmjs.com/package/@paperos/mercury-bank)
