# Supabase Manual Migration Guide

Complete step-by-step guide for manually applying the DevLabs CFO database schema to Supabase.

---

## Prerequisites

- Supabase project created and accessible
- Supabase SQL Editor access
- Database connection details in `.env` file

---

## Migration Steps

### Step 1: Apply Database Schema

**File**: `prisma/manual-migration.sql`

**What it does**:
- Creates 9 ENUM types
- Creates 13 tables with proper constraints
- Creates 30+ indexes for performance
- Creates 16 foreign key relationships

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `prisma/manual-migration.sql`
4. Paste and click **Run**

**Verification**:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'core_%'
    OR tablename LIKE 'financial_%'
    OR tablename LIKE 'analytics_%'
    OR tablename LIKE 'integrations_%'
    OR tablename LIKE 'system_%')
ORDER BY tablename;
```

Expected: 13 tables listed

---

### Step 2: Setup User-Organization Mapping

**File**: `prisma/rls-setup.sql`

**What it does**:
- Creates `user_organizations` mapping table
- Creates helper function `get_user_organization_id()`
- Enables RLS on mapping table

**Why needed**: Supabase's `auth.users` table is managed by Supabase and shouldn't be modified. This mapping table links users to organizations.

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `prisma/rls-setup.sql`
4. Paste and click **Run**

**Verification**:
```sql
SELECT public.get_user_organization_id();
-- Should return NULL if no mapping exists yet
```

---

### Step 3: Apply Row Level Security Policies

**File**: `prisma/rls-policies.sql`

**What it does**:
- Enables RLS on all 13 tables
- Creates policies for organization-level data isolation
- Ensures users can only access their organization's data

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `prisma/rls-policies.sql`
4. Paste and click **Run**

**Verification**:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected: Multiple policies per table

---

### Step 4: Create Test Organization

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Run this query:

```sql
INSERT INTO core_organizations (id, name, subscription_tier, updated_at)
VALUES (
    gen_random_uuid()::text,
    'DevLabs Test Agency',
    'pro',
    CURRENT_TIMESTAMP
)
RETURNING id;
```

3. **Save the returned ID** - you'll need it in Step 5

---

### Step 5: Create User in Supabase Auth

**Instructions**:
1. Open Supabase Dashboard → Authentication → Users
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. **Copy the User ID** from the user list

---

### Step 6: Link User to Organization

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Run this query (replace placeholders):

```sql
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES (
    'PASTE-USER-ID-FROM-STEP-5',        -- UUID from Auth dashboard
    'PASTE-ORG-ID-FROM-STEP-4',         -- UUID from Step 4
    'owner'
);
```

**Verification**:
```sql
SELECT * FROM public.user_organizations;
```

Expected: One row with your user-org mapping

---

### Step 7: Generate Prisma Client

**Instructions**:
```bash
cd "/Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO"
npm run db:generate
```

Expected: `✔ Generated Prisma Client`

---

### Step 8: Seed Test Data

**Instructions**:
```bash
npm run db:seed
```

Expected output:
```
✅ Organization created: DevLabs Test Agency
✅ Service created: Web Development
✅ Service created: SEO Services
✅ Client created: Acme Corporation
✅ Client created: Globex Industries
✅ Client created: Initech Solutions
✅ Contractor created: John Developer
✅ Contractor created: Jane Designer
...
✨ Seed data complete!
```

---

### Step 9: Verify Everything Works

**Option A: Prisma Studio**
```bash
npm run db:studio
```

Browse all tables and verify test data is visible.

**Option B: SQL Query**
```sql
SELECT
    c.name as client_name,
    c.status,
    COUNT(r.id) as revenue_count,
    SUM(r.amount) as total_revenue
FROM core_clients c
LEFT JOIN financial_revenue_records r ON r.client_id = c.id
GROUP BY c.id, c.name, c.status
ORDER BY total_revenue DESC;
```

Expected: See test clients with revenue data

---

## Troubleshooting

### Error: "column organization_id does not exist"

**Cause**: Tried to run `rls-policies.sql` before `rls-setup.sql`

**Fix**: Run `rls-setup.sql` first (Step 2), then retry `rls-policies.sql`

---

### Error: "relation user_organizations does not exist"

**Cause**: Skipped Step 2

**Fix**: Run `rls-setup.sql` (Step 2)

---

### RLS Blocking All Queries

**Cause**: User not linked to an organization

**Fix**:
1. Verify mapping exists:
   ```sql
   SELECT * FROM public.user_organizations WHERE user_id = auth.uid();
   ```
2. If empty, complete Step 6

---

### Seed Script Fails

**Possible causes**:
1. Schema not applied (run Step 1)
2. Prisma Client not generated (run Step 7)
3. Database connection issue (check `.env` file)

**Fix**: Follow steps in order, verify each step before proceeding

---

## Next Steps After Migration

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Build Frontend**: Follow Next.js setup in main README.md

3. **Configure Integrations**: Set up Xero, Mercury API keys in `.env`

4. **Deploy to Vercel**: Follow deployment guide in README.md

---

## Summary of Files

| File | Purpose | When to Run |
|------|---------|-------------|
| `manual-migration.sql` | Creates all tables, enums, indexes | Step 1 (First) |
| `rls-setup.sql` | Creates user-org mapping | Step 2 (Second) |
| `rls-policies.sql` | Applies RLS policies | Step 3 (Third) |
| `seed.ts` | Populates test data | Step 8 (After schema setup) |

---

## Quick Reference: Order Matters!

✅ **Correct Order**:
1. manual-migration.sql
2. rls-setup.sql
3. rls-policies.sql
4. Create organization
5. Create user
6. Link user to org
7. Generate Prisma client
8. Seed data

❌ **Wrong Order** (will fail):
- rls-policies.sql before rls-setup.sql → Error: function doesn't exist
- Seed before schema → Error: tables don't exist
- Generate client before schema → Error: schema mismatch

---

**Questions?** Check [DATABASE.md](./DATABASE.md) for detailed schema documentation.
