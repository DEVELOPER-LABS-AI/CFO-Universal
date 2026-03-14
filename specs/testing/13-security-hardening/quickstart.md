# Quickstart: Security & Quality Hardening

## Pre-requisites
- Node.js 18+, npm
- Access to the `13-security-hardening` branch
- Valid `.env` with Supabase credentials

## Setup
```bash
git checkout 13-security-hardening
npm install
npx prisma generate
```

## Key Files to Understand First
1. `lib/auth/helpers.ts` - All auth helper functions (requireAuth, requireAdmin, etc.)
2. `lib/auth/organization.ts` - Organization scoping (getOrganizationId)
3. `lib/validations/auth.ts` - Password validation schemas
4. `middleware.ts` - Next.js middleware for session refresh

## Implementation Order
1. Start with `lib/auth/helpers.ts` - remove auto-provisioning, add `requireAdminOrExecutive()`
2. Then secure API routes in `app/api/mercury/` (largest batch)
3. Then fix error handling across all files
4. Then password validation and env validation

## Verification
```bash
npx tsc --noEmit                    # Zero TypeScript errors
npx next build                       # Clean build
grep -r "catch (error: any)" app/ components/ lib/  # Must return 0
grep -r "executeRawUnsafe" app/ lib/                 # Must return 0
grep -r "autoProvisionUser" lib/                     # Must return 0
```
