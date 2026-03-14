# Implementation Plan: Mercury Banking Integration with OAuth 2.0 and Automated Transaction Sync

**Feature**: Mercury Banking Integration with OAuth 2.0 and Automated Transaction Sync
**Branch**: 5-mercury-integration
**Created**: 2026-02-15
**Status**: Planning Complete

---

## Executive Summary

This plan details the implementation of automated Mercury Bank integration with OAuth 2.0 authentication and daily synchronization of banking transactions. The system will eliminate manual expense tracking, provide real-time cash flow visibility, and enable automated transaction categorization with high accuracy.

**Key Deliverables:**
- OAuth 2.0 connection flow with encrypted token storage (reusing Xero encryption utilities)
- Daily automated sync of transactions → expense records
- Intelligent transaction categorization (90% accuracy target)
- Merchant-to-contractor mapping (85% accuracy target)
- Multi-account balance tracking with history
- Sync status monitoring dashboard
- Error handling with exponential backoff retry logic (reusing Xero patterns)
- Foreign currency conversion to USD

**Estimated Complexity**: Medium (6-8 days) - Leveraging existing Xero infrastructure

**Timeline Breakdown**:
- Days 1-2: Database schema + OAuth implementation (leverage Xero patterns)
- Days 3-4: Transaction sync service + merchant mapping
- Days 4-5: Categorization engine + balance tracking
- Days 6-7: Scheduled job setup + monitoring UI
- Day 8: Testing, error handling, documentation

---

## Technical Context

### Technology Stack

**OAuth & Authentication:**
- **Mercury API SDK** (if available) or **axios** for REST API calls - [NEEDS CLARIFICATION: R2]
- **Web Crypto API**: Token encryption/decryption (AES-256-GCM) - **REUSE** from Xero integration (`lib/xero/crypto.ts`)
- **Next.js Route Handlers**: OAuth callback endpoints (`/api/mercury/oauth/*`)

**Data Synchronization:**
- **Vercel Cron** or **Supabase pg_cron**: Scheduled job trigger (default 2 AM UTC)
- **Next.js API Routes**: Sync execution endpoints (`/api/mercury/sync`)
- **Prisma**: Database ORM for sync logging and token management
- **string-similarity**: Fuzzy name matching for merchant-to-contractor mapping - **REUSE** from Xero
- **bottleneck**: Rate limiting - **REUSE** from Xero (adapt for Mercury's rate limits) - [NEEDS CLARIFICATION: R3]

**Database Layer:**
- **Prisma**: Schema management for new tables (mercury_connections, mercury_sync_logs, merchant_mappings, categorization_rules)
- **PostgreSQL (Supabase)**: Token storage with RLS policies
- **Supabase RLS**: Organization-level data isolation

**Categorization & Mapping:**
- **Pattern Matching**: Regex-based categorization rules
- **Fuzzy String Matching**: `string-similarity` for merchant-to-contractor linking
- **Transaction History**: Learn from manual corrections over time

**Monitoring & Logging:**
- **JSONB fields**: Flexible error logging in mercury_sync_logs table
- **Next.js UI**: Sync history dashboard with error details
- **Reuse components**: Adapt Xero's `SyncHistoryTable.tsx` for Mercury

**Development Tools:**
- **TypeScript Strict Mode**: Type-safe integration services
- **Zod**: API response validation and schema parsing
- **Vitest**: Unit tests for categorization and mapping logic

---

## Constitution Check

### Compliance Summary

**✅ COMPLIANT:**
- Technology Stack: Next.js 16, React 19, Prisma, Supabase, Vercel deployment
- Multi-tenancy: All data scoped by `organization_id` with RLS policies
- Security: OAuth tokens encrypted with AES-256-GCM, no client-side keys
- Database: Supabase pooler URLs, Prisma migrations, soft deletes where applicable
- Integration: OAuth 2.0 for Mercury, daily incremental sync strategy
- Code Quality: TypeScript strict mode, Zod validation, comprehensive error handling

**🔍 RESEARCH TASKS (Phase 0):**
1. **R1**: Research Mercury API authentication flow (OAuth 2.0 vs API key)
2. **R2**: Investigate Mercury SDK availability and features
3. **R3**: Document Mercury API rate limits and best practices
4. **R4**: Analyze Mercury transaction data structure and fields
5. **R5**: Review Mercury multi-currency transaction format
6. **R6**: Identify Mercury account types and balance tracking API

All research findings will resolve [NEEDS CLARIFICATION] markers and be documented in `research.md`.

---

## Architecture Decisions

### Decision 1: Reuse Xero's OAuth and Encryption Infrastructure

**Rationale**: Mercury integration follows same OAuth 2.0 pattern as Xero - avoid reinventing the wheel

**Implementation**:
- **Reuse** `lib/xero/crypto.ts` encryption utilities for Mercury tokens
- **Adapt** Xero's OAuth flow structure for Mercury endpoints
- **Share** `ENCRYPTION_KEY` environment variable for all integrations
- **Pattern**:
  ```typescript
  // Reuse from Xero
  import { encryptToken, decryptToken } from '@/lib/xero/crypto';

  // Adapt for Mercury
  const encryptedAccessToken = await encryptToken(mercuryTokens.access_token);
  await prisma.mercuryConnection.create({
    data: {
      organization_id: orgId,
      access_token_encrypted: encryptedAccessToken,
      // ...
    }
  });
  ```

**Benefits**:
- ✅ Consistent security patterns across integrations
- ✅ Reduced implementation time (no new crypto code)
- ✅ Single encryption key management
- ✅ Proven, tested encryption logic

**Trade-offs**:
- ⚠️ Tight coupling to Xero's crypto module (acceptable for now, could extract to `lib/integrations/crypto.ts` for better organization later)

---

### Decision 2: Use Pattern-Based Categorization with Learning

**Rationale**: Rule-based categorization is transparent, debuggable, and allows admin customization

**Implementation**:
```typescript
// Categorization priority cascade
async function categorizeTransaction(transaction: MercuryTransaction): Promise<Category> {
  // 1. Check contractor/vendor exact match (highest priority)
  const contractor = await mapMerchantToContractor(transaction.merchant_name);
  if (contractor) return { type: 'CONTRACTOR', contractor_id: contractor.id, confidence: 0.95 };

  // 2. Check admin-defined rules (by priority order)
  const rules = await getCategorizationRules(orgId);
  for (const rule of rules.sort((a, b) => b.priority - a.priority)) {
    if (matchesRule(transaction, rule)) {
      return { type: rule.category, confidence: 0.90 };
    }
  }

  // 3. Check default keyword patterns
  if (/aws|google cloud|azure|vercel|netlify/i.test(transaction.description)) {
    return { type: 'SUBSCRIPTION', confidence: 0.80 };
  }

  if (/rent|lease|utilities|insurance/i.test(transaction.description)) {
    return { type: 'OVERHEAD', confidence: 0.75 };
  }

  if (/payroll|salary|wages/i.test(transaction.description)) {
    return { type: 'PAYROLL', confidence: 0.70 };
  }

  // 4. Uncategorized fallback
  return { type: 'OTHER', confidence: 0.0 };
}
```

**Learning Mechanism**:
- Admin manually categorizes "OTHER" transactions
- System creates new categorization rule from manual correction
- New rule applied to future transactions with same merchant/pattern

**Alternatives Considered**:
- **Machine Learning**: Rejected for MVP - Requires training data, complex deployment, less transparent
- **Fixed Categories Only**: Rejected - Not flexible enough for agency-specific expenses

**Trade-offs**:
- ✅ Pros: Transparent, customizable, no ML infrastructure needed
- ✅ Pros: Improves over time with admin feedback
- ⚠️ Cons: Initial accuracy lower until rules built up (mitigated by good default patterns)

---

### Decision 3: Tiered Merchant Matching Similar to Xero Contact Mapping

**Rationale**: Reuse proven fuzzy matching approach from Xero integration, adapted for merchants

**Implementation**:
```typescript
async function mapMerchantToContractor(merchantName: string): Promise<Contractor | null> {
  // Tier 1: Check cache (O(1) lookup)
  const cached = await getCachedMerchantMapping(merchantName);
  if (cached) return cached.contractor;

  // Tier 2: Exact name match (case-insensitive, normalized)
  const normalized = normalizeName(merchantName);
  const exactMatch = await findContractorByNormalizedName(normalized);
  if (exactMatch) {
    await cacheMerchantMapping(merchantName, exactMatch.id, 'EXACT', 0.95);
    return exactMatch;
  }

  // Tier 3: Fuzzy name match (> 0.85 similarity threshold)
  const fuzzyMatches = await findContractorsByFuzzyName(merchantName);
  const bestMatch = fuzzyMatches.find(m => m.similarity > 0.85);
  if (bestMatch) {
    await cacheMerchantMapping(merchantName, bestMatch.id, 'FUZZY', bestMatch.similarity);
    return bestMatch;
  }

  // Tier 4: No match - flag for manual mapping
  await flagUnmappedMerchant(merchantName);
  return null;
}
```

**Normalization Logic** (reuse from Xero):
- Lowercase
- Remove special characters (Inc, LLC, Corp, Ltd)
- Trim whitespace
- Remove duplicate spaces

**Benefits**:
- ✅ 85%+ accuracy target achievable (proven with Xero contacts)
- ✅ Performance optimized with caching
- ✅ Admin can manually map unmapped merchants

---

### Decision 4: Foreign Currency Conversion in Sync Layer

**Rationale**: Store both original and USD amounts for audit trail while reporting in USD

**Implementation**:
```typescript
interface MercuryTransaction {
  id: string;
  amount: number;
  currency: string;
  exchange_rate?: number; // Present if currency != USD
  amount_usd?: number;    // Calculated or provided by Mercury
}

async function syncTransaction(tx: MercuryTransaction) {
  const amountUSD = tx.currency === 'USD'
    ? tx.amount
    : (tx.amount_usd || tx.amount * (tx.exchange_rate || 1));

  await prisma.expenseRecord.create({
    data: {
      mercury_transaction_id: tx.id,
      amount: amountUSD,              // USD for reporting
      original_amount: tx.amount,      // Original for audit
      original_currency: tx.currency,
      exchange_rate: tx.exchange_rate,
      // ...
    }
  });
}
```

**Database Schema Addition**:
```prisma
model ExpenseRecord {
  // Existing fields...
  amount             Decimal  // Always in USD for reporting
  original_amount    Decimal? // Original currency amount
  original_currency  String?  // ISO currency code (USD, EUR, GBP)
  exchange_rate      Decimal? // Conversion rate used
}
```

**Benefits**:
- ✅ All reporting uses USD (consistent)
- ✅ Audit trail preserved (original amount + rate)
- ✅ Supports future multi-currency reporting if needed

---

### Decision 5: Scheduled Sync via Vercel Cron (Simplified from Xero)

**Rationale**: Simpler setup than pg_cron, adequate for daily sync requirements

**Implementation**:
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/mercury/sync/cron",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

**Route Handler** (`/api/mercury/sync/cron/route.ts`):
```typescript
export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger sync for all active Mercury connections
  const connections = await prisma.mercuryConnection.findMany({
    where: { connection_status: 'ACTIVE' }
  });

  for (const connection of connections) {
    await syncMercuryTransactions(connection.id);
  }

  return NextResponse.json({ success: true, synced: connections.length });
}
```

**Alternatives Considered**:
- **Supabase pg_cron**: Used for Xero, but adds complexity for similar outcome
- **Manual trigger only**: Rejected - Violates daily automation requirement

**Trade-offs**:
- ✅ Pros: Simpler setup, works out-of-box on Vercel
- ✅ Pros: Scales to multiple organizations automatically
- ⚠️ Cons: Requires Vercel Pro for reliable cron execution (acceptable - already using Pro)

---

## Risks & Mitigation

### Risk 1: Mercury API Rate Limits Stricter Than Expected

**Impact**: Sync failures, slow sync performance
**Probability**: Medium
**Mitigation**:
- Implement adaptive rate limiting with bottleneck (reuse from Xero)
- Use batch API endpoints if available
- Paginate large transaction lists
- Monitor 429 responses and adjust throttling

### Risk 2: Merchant Name Variations Reduce Matching Accuracy

**Impact**: Below 85% accuracy target, more manual mapping required
**Probability**: High
**Mitigation**:
- Start with conservative 0.85 similarity threshold, adjust based on metrics
- Provide bulk mapping UI for similar merchants
- Learn from admin corrections (create rules)
- Consider merchant aliases table for known variations

### Risk 3: Foreign Currency Conversion Rate Availability

**Impact**: Inaccurate USD conversion, reporting errors
**Probability**: Low (to be confirmed in R5)
**Mitigation**:
- Prefer Mercury's provided USD equivalent if available
- Fallback to exchange rate * amount if only rate provided
- Log missing conversion data for manual review
- Validate converted amounts are reasonable (sanity checks)

### Risk 4: Multiple Bank Accounts Complicate Sync Logic

**Impact**: Performance degradation, complex error handling
**Probability**: Medium
**Mitigation**:
- Sync accounts in parallel (Promise.all)
- Isolate errors per account (don't fail entire sync)
- Add account filtering to manual sync UI
- Monitor per-account sync performance

---

## Success Criteria Validation

**From spec.md:**
- [ ] **Automation Efficiency**: 95% of transactions imported automatically
  - **Validation**: Query `(COUNT(*) WHERE mercury_transaction_id IS NOT NULL) / (SELECT COUNT(*) FROM mercury_transactions)`

- [ ] **Categorization Accuracy**: 90% of transactions correctly categorized
  - **Validation**: Monthly audit of 100 random transactions, compare system vs manual review

- [ ] **Sync Reliability**: 95% of scheduled syncs complete successfully
  - **Validation**: Query `(COUNT(*) WHERE status = 'SUCCESS') / COUNT(*) FROM mercury_sync_logs`

- [ ] **Merchant Matching Accuracy**: 85% of merchants matched to contractors
  - **Validation**: Query `(COUNT(*) WHERE contractor_id IS NOT NULL) / COUNT(*) FROM expense_records WHERE mercury_transaction_id IS NOT NULL`

- [ ] **Error Recovery**: 90% of transient errors resolved via retry
  - **Validation**: Query `(COUNT(*) WHERE retry_count > 0 AND status = 'SUCCESS') / (SELECT COUNT(*) WHERE error_type = 'TRANSIENT')`

- [ ] **Performance**: Daily sync completes within 10 minutes
  - **Validation**: Query `AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FROM mercury_sync_logs WHERE status = 'SUCCESS'`

- [ ] **Data Accuracy**: 99% of synced transactions match Mercury source
  - **Validation**: Sample audit of 100 random transactions, compare amounts/dates/merchants

- [ ] **User Efficiency**: Admin reviews 100 transactions in under 15 minutes
  - **Validation**: Time study with actual users

---

## Next Steps

1. Complete Phase 0 research tasks (R1-R6) → `research.md`
2. Create detailed data model → `data-model.md`
3. Define API contracts → `contracts/api-endpoints.md`
4. Run `/speckit.tasks` to generate task breakdown
5. Begin Phase 1 implementation

**Estimated Total Duration**: 6-8 days (excluding 1 day for research)

---

## Appendices

### Appendix A: Reusable Components from Xero Integration

- `lib/xero/crypto.ts` → Token encryption/decryption
- `lib/xero/retry.ts` → Exponential backoff retry logic
- `lib/xero/rate-limiter.ts` → Bottleneck rate limiting
- `components/xero/SyncHistoryTable.tsx` → Adapt for Mercury
- `components/xero/ManualSyncButton.tsx` → Adapt for Mercury
- `components/xero/ConnectionStatus.tsx` → Adapt for Mercury

### Appendix B: Environment Variables Required

```env
# Mercury OAuth
MERCURY_CLIENT_ID=your_client_id
MERCURY_CLIENT_SECRET=your_client_secret
MERCURY_REDIRECT_URI=https://devlabs-cfo.vercel.app/api/mercury/oauth/callback

# Encryption (shared with Xero)
ENCRYPTION_KEY=your_32_byte_hex_key

# Cron Authentication
CRON_SECRET=your_secure_random_string
```

### Appendix C: Constitution Compliance Checklist

- [x] Uses Supabase pooler URLs for database connection
- [x] Prisma migrations for all schema changes
- [x] Row Level Security (RLS) on all new tables
- [x] OAuth tokens encrypted at rest (AES-256-GCM)
- [x] Next.js 16 App Router with Server Components
- [x] TypeScript strict mode enabled
- [x] Soft deletes where applicable (merchant_mapping_cache can be hard deleted)
- [x] UUID primary keys on all new tables
- [x] created_at, updated_at timestamps on all entities
- [x] No client-side database access (Server Actions only)
