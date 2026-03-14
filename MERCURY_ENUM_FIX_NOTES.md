# Mercury Enum Fix - Implementation Notes

**Date**: February 16, 2026
**Issue**: PostgreSQL enum type mismatch blocking Mercury transaction sync
**Status**: ✅ **RESOLVED**

---

## Problem Summary

Mercury transaction sync was failing with the error:
```
column "mercury_sync_status" is of type expense_record_sync_status
but expression is of type "ExpenseRecordSyncStatus"
```

### Root Cause

**Dual Enum Schema Conflict**: The database had enums created with two different naming conventions:

1. **Prisma-managed enums** (from `manual-migration.sql`):
   - Used PascalCase with quotes: `"ClientStatus"`, `"UserRole"`, etc.

2. **Supabase-managed enums** (from `20260215_add_mercury_integration.sql`):
   - Used snake_case without quotes: `expense_record_sync_status`, `mercury_connection_status`, etc.

Prisma's default behavior assumed all enums would use PascalCase, but the Mercury enums were created with snake_case, causing type mismatch errors.

---

## Solution Implemented

### Added `@@map` Attributes to Prisma Schema

Updated 9 Mercury-related enums in `prisma/schema.prisma` to explicitly map to their snake_case PostgreSQL type names:

```prisma
enum MercuryConnectionStatus {
  ACTIVE
  DISCONNECTED
  API_ERROR

  @@map("mercury_connection_status")  // ← Added this
}

enum MercurySyncType {
  TRANSACTIONS
  BALANCES
  FULL

  @@map("mercury_sync_type")  // ← Added this
}

enum MercurySyncStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  PARTIAL

  @@map("mercury_sync_status")  // ← Added this
}

enum MercurySyncTrigger {
  SYSTEM
  MANUAL
  RETRY

  @@map("mercury_sync_trigger")  // ← Added this
}

enum MappingConfidence {
  EXACT
  FUZZY
  MANUAL

  @@map("mapping_confidence")  // ← Added this
}

enum MappingSource {
  SYSTEM
  ADMIN_USER

  @@map("mapping_source")  // ← Added this
}

enum CategorizationRuleType {
  MERCHANT_NAME
  DESCRIPTION_KEYWORD
  AMOUNT_RANGE

  @@map("categorization_rule_type")  // ← Added this
}

enum MercuryAccountType {
  CHECKING
  SAVINGS
  TREASURY

  @@map("mercury_account_type")  // ← Added this
}

enum ExpenseRecordSyncStatus {
  MANUAL
  SYNCED
  CATEGORIZATION_FAILED
  MAPPING_FAILED

  @@map("expense_record_sync_status")  // ← Added this
}
```

---

## Changes Made

### Files Modified

1. **`prisma/schema.prisma`**
   - Added `@@map()` attribute to 9 Mercury enums
   - No breaking changes to enum values
   - Maintains backward compatibility

### Commands Executed

```bash
# Regenerate Prisma Client
npx prisma generate
```

---

## Verification

### Test Results

Created and ran `test-mercury-enum-fix.ts` which verified:

✅ **Test 1**: Create expense record with `mercury_sync_status` → **PASSED**
✅ **Test 2**: Update `mercury_sync_status` → **PASSED**
✅ **Test 3**: Query by `mercury_sync_status` → **PASSED**

### SQL Query Verification

**Before Fix**:
```sql
CAST($11::text AS "ExpenseRecordSyncStatus")  -- ❌ Type not found
```

**After Fix**:
```sql
CAST($11::text AS "public"."expense_record_sync_status")  -- ✅ Correct!
```

---

## Impact

### What This Fixes

✅ Mercury transaction sync now works
✅ Expense records can be created with `mercury_sync_status`
✅ All Mercury enum fields now function correctly
✅ No database migration required

### What Remains Unchanged

- TypeScript enum values (`'SYNCED'`, `'MANUAL'`, etc.) remain the same
- Application code using enums requires NO changes
- Database schema unchanged (no migration needed)
- Existing data unaffected

---

## Future Recommendations

### 1. Standardize All Enums

Consider adding `@@map()` to ALL enums for consistency:

```prisma
enum ClientStatus {
  ACTIVE
  INACTIVE
  CHURNED

  @@map("client_status")  // or @@map("ClientStatus")
}
```

### 2. Migration Best Practice

Going forward, choose ONE convention:

**Option A**: Use Prisma migrations for ALL schema changes
**Option B**: Use Supabase migrations for ALL schema changes

**Current State**: Mixed approach (not recommended)

### 3. Schema Validation

Add to CI/CD:
```bash
# Verify Prisma schema matches database
npx prisma db pull --print
npx prisma validate
```

---

## Rollback Plan

If needed, revert by:

1. Remove `@@map()` attributes from `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Revert to previous commit: `git checkout HEAD~1 prisma/schema.prisma`

---

## Related Documentation

- Prisma Enum Mapping: https://www.prisma.io/docs/orm/reference/prisma-schema-reference#map-enum
- PostgreSQL Enum Types: https://www.postgresql.org/docs/current/datatype-enum.html
- Mercury API: https://docs.mercury.com/reference/

---

## Commit Information

```
fix: Add @@map attributes to Mercury enums to resolve PostgreSQL type mismatch

- Added @@map("snake_case") to 9 Mercury-related enums
- Resolves error: column "mercury_sync_status" is of type expense_record_sync_status
  but expression is of type "ExpenseRecordSyncStatus"
- Tested with test-mercury-enum-fix.ts - all tests passing
- No database migration required
- No breaking changes to application code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Questions?

If Mercury sync still fails after this fix, check:

1. Prisma client regenerated: `npx prisma generate`
2. Application restarted (to load new Prisma client)
3. Database has correct enum types: Run `supabase/migrations/verify_mercury_schema.sql`

