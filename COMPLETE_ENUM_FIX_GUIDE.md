# Complete Enum Standardization Guide

**Date**: February 16, 2026
**Priority**: 🔴 CRITICAL
**Status**: Requires database cleanup

---

## 🎯 What We Accomplished

### ✅ Phase 1: Prisma Schema Standardization
- Added `@@map()` attributes to **all 33 enums**
- Mercury enums (9): Map to `snake_case` (e.g., `mercury_connection_status`)
- Core/Xero enums (24): Map to `PascalCase` (e.g., `"ClientStatus"`)
- Regenerated Prisma client with correct mappings

### ✅ Phase 2: Testing & Verification
- Verified Mercury enum fix works for `expense_record` creation
- Created comprehensive test suite
- Documented all changes

---

## 🔴 Remaining Issue: Duplicate Enum Types in Database

### Problem
The database has **TWO sets of Mercury enum types**:

1. **From `fix-mercury-schema.sql`** (should be removed):
   ```sql
   "MercuryConnectionStatus"  -- PascalCase with quotes
   "MercurySyncType"
   "ExpenseRecordSyncStatus"
   ... etc
   ```

2. **From Supabase migration `20260215_add_mercury_integration.sql`** (correct):
   ```sql
   mercury_connection_status  -- snake_case, no quotes
   mercury_sync_type
   expense_record_sync_status
   ... etc
   ```

### Why This Causes Errors
PostgreSQL sees both types and gets confused when comparing values:
```
operator does not exist: "MercuryConnectionStatus" = mercury_connection_status
```

---

## 🔧 SOLUTION: Run Database Cleanup

### Step 1: Run Cleanup SQL Script

**In Supabase SQL Editor**, run the cleanup script:

```bash
# File created: cleanup-duplicate-enums.sql
```

Or copy/paste this SQL directly into Supabase:

```sql
-- Drop duplicate PascalCase Mercury enum types
DROP TYPE IF EXISTS "public"."MercuryConnectionStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncType" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncStatus" CASCADE;
DROP TYPE IF EXISTS "public"."MercurySyncTrigger" CASCADE;
DROP TYPE IF EXISTS "public"."MappingConfidence" CASCADE;
DROP TYPE IF EXISTS "public"."MappingSource" CASCADE;
DROP TYPE IF EXISTS "public"."CategorizationRuleType" CASCADE;
DROP TYPE IF EXISTS "public"."MercuryAccountType" CASCADE;
DROP TYPE IF EXISTS "public"."ExpenseRecordSyncStatus" CASCADE;
```

### Step 2: Verify Cleanup

Run this query to verify only snake_case enums remain:

```sql
SELECT typname as enum_name
FROM pg_type
WHERE typtype = 'e'
  AND (
    typname LIKE '%mercury%'
    OR typname LIKE '%mapping%'
    OR typname LIKE '%expense_record%'
  )
ORDER BY typname;
```

**Expected output** (only snake_case):
```
categorization_rule_type
expense_record_sync_status
mapping_confidence
mapping_source
mercury_account_type
mercury_connection_status
mercury_sync_status
mercury_sync_trigger
mercury_sync_type
```

### Step 3: Test Mercury Sync

After cleanup, test Mercury sync:

```bash
# If you have an active Mercury connection:
curl -X POST http://localhost:3000/api/mercury/sync/manual \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org-devlabs-test","syncMode":"test"}'
```

---

## 📋 Complete Enum Mapping Reference

### Core Enums (Prisma PascalCase → Database PascalCase)
| Prisma Enum | Database Type |
|-------------|---------------|
| `ClientStatus` | `"ClientStatus"` |
| `RateType` | `"RateType"` |
| `EngagementType` | `"EngagementType"` |
| `RevenueStatus` | `"RevenueStatus"` |
| `SyncSource` | `"SyncSource"` |
| `ExpenseCategory` | `"ExpenseCategory"` |
| `OAuthProvider` | `"OAuthProvider"` |
| `SyncStatus` | `"SyncStatus"` |
| `TargetScope` | `"TargetScope"` |
| `UserRole` | `"UserRole"` |
| `UserStatus` | `"UserStatus"` |
| `RelationshipType` | `"RelationshipType"` |
| `AuditActionType` | `"AuditActionType"` |

### Xero Enums (Prisma PascalCase → Database PascalCase)
| Prisma Enum | Database Type |
|-------------|---------------|
| `ConnectionStatus` | `"ConnectionStatus"` |
| `XeroSyncStatus` | `"XeroSyncStatus"` |
| `SyncType` | `"SyncType"` |
| `SyncJobStatus` | `"SyncJobStatus"` |
| `SyncTrigger` | `"SyncTrigger"` |
| `MappingType` | `"MappingType"` |
| `NotificationType` | `"NotificationType"` |
| `NotificationPriority` | `"NotificationPriority"` |
| `NotificationStatus` | `"NotificationStatus"` |
| `ExpenseType` | `"ExpenseType"` |
| `RevenueSyncStatus` | `"RevenueSyncStatus"` |
| `ExpenseSyncStatus` | `"ExpenseSyncStatus"` |

### Mercury Enums (Prisma PascalCase → Database snake_case)
| Prisma Enum | Database Type |
|-------------|---------------|
| `MercuryConnectionStatus` | `mercury_connection_status` |
| `MercurySyncType` | `mercury_sync_type` |
| `MercurySyncStatus` | `mercury_sync_status` |
| `MercurySyncTrigger` | `mercury_sync_trigger` |
| `MappingConfidence` | `mapping_confidence` |
| `MappingSource` | `mapping_source` |
| `CategorizationRuleType` | `categorization_rule_type` |
| `MercuryAccountType` | `mercury_account_type` |
| `ExpenseRecordSyncStatus` | `expense_record_sync_status` |

---

## 📝 Files Modified

1. **`prisma/schema.prisma`**
   - Added `@@map()` to all 33 enums
   - Ensures Prisma knows exact PostgreSQL type names

2. **`cleanup-duplicate-enums.sql`**
   - Removes duplicate PascalCase Mercury enums
   - Must be run in Supabase SQL Editor

3. **`check-column-types.sql`**
   - Diagnostic query to verify column types
   - Helpful for troubleshooting

4. **`MERCURY_ENUM_FIX_NOTES.md`**
   - Original enum fix documentation
   - Covers initial Mercury sync issue

5. **`COMPLETE_ENUM_FIX_GUIDE.md`** (this file)
   - Complete standardization guide
   - Includes cleanup instructions

---

## ✅ Testing Checklist

After running cleanup SQL:

- [ ] Run cleanup SQL in Supabase
- [ ] Verify only correct enum types exist
- [ ] Restart Next.js application (`npm run dev`)
- [ ] Test Mercury connection query
- [ ] Test Mercury sync (test mode with 1 transaction)
- [ ] Test Xero connection query (if applicable)
- [ ] Verify expense record creation works
- [ ] Check application logs for enum errors

---

## 🚀 Next Steps

1. **Immediate** (Required):
   - Run `cleanup-duplicate-enums.sql` in Supabase
   - Verify cleanup successful
   - Test Mercury sync

2. **Short-term** (Recommended):
   - Delete `fix-mercury-schema.sql` (it created duplicates)
   - Document enum naming convention for team
   - Add enum validation to CI/CD

3. **Long-term** (Best Practice):
   - Choose ONE migration tool (Prisma OR Supabase)
   - Create migration strategy document
   - Add database schema drift detection

---

## 🔄 Rollback Plan

If issues occur after cleanup:

1. The duplicate enums can be recreated by running `fix-mercury-schema.sql`
2. Revert Prisma schema: `git checkout HEAD~1 prisma/schema.prisma`
3. Regenerate Prisma client: `npx prisma generate`

However, this will bring back the original enum mismatch errors.

---

## 📞 Support

If Mercury sync still fails after cleanup:

1. Check Prisma client regenerated: `npx prisma generate`
2. Verify application restarted
3. Run verification SQL to check enum types
4. Check application logs for specific enum errors
5. Review `MERCURY_ENUM_FIX_NOTES.md` for additional context

---

## 🎓 Lessons Learned

### What Caused This Issue

1. **Mixed Migration Sources**:
   - Some enums created by Prisma migrations (PascalCase)
   - Some enums created by Supabase migrations (snake_case)

2. **Quick Fix Attempt**:
   - `fix-mercury-schema.sql` tried to recreate Mercury enums
   - Created duplicates instead of fixing the mapping

3. **Missing Explicit Mapping**:
   - Prisma assumed all enums used same naming convention
   - No `@@map()` attributes caused type mismatches

### Best Practices Going Forward

✅ **Use `@@map()` for all enums** - Be explicit about database type names
✅ **Standardize migration tool** - Don't mix Prisma and manual SQL migrations
✅ **Document conventions** - Team should know enum naming rules
✅ **Test after migrations** - Catch enum issues early
✅ **Avoid duplicate types** - Check existing types before creating new ones

---

**Ready to proceed?** Run the cleanup SQL and your Mercury sync will work!

