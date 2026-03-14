# Deploying DevLabs CFO to Vercel

## Quick Deployment (Recommended - GitHub Integration)

This method automatically deploys every time you push to GitHub.

### Step 1: Connect GitHub to Vercel

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select **DEVELOPER-LABS-AI/CFO** repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Step 2: Add Environment Variables

Click **"Environment Variables"** and add these:

```
NEXT_PUBLIC_SUPABASE_URL=https://fqljijavvxkthzozslzx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbGppamF2dnhrdGh6b3pzbHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODk0NDEsImV4cCI6MjA4NjQ2NTQ0MX0.vCrh1KtidX-acb7ouEYP02L7VkFjqbdVdxz8BbLTejk
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbGppamF2dnhrdGh6b3pzbHp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg4OTQ0MSwiZXhwIjoyMDg2NDY1NDQxfQ.xt2TnXzw-k3X1c1Bu16mue09uGzHzxpq1TsMnaIr29k
DATABASE_URL=postgres://postgres:xomhot-zuqGuz-jutma7@db.fqljijavvxkthzozslzx.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://postgres:xomhot-zuqGuz-jutma7@db.fqljijavvxkthzozslzx.supabase.co:5432/postgres
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important**: Update `NEXT_PUBLIC_APP_URL` after deployment with your actual Vercel URL.

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Get your deployment URL (e.g., `https://devlabs-cfo.vercel.app`)

### Step 4: Update Supabase Redirect URLs

1. Go to **Supabase Dashboard**: https://fqljijavvxkthzozslzx.supabase.co
2. Navigate to **Authentication → URL Configuration**
3. Add your Vercel URL to **Redirect URLs**:
   ```
   https://your-app.vercel.app/**
   ```
4. Click **Save**

### Step 5: Update Environment Variable

1. Go back to Vercel → Project Settings → Environment Variables
2. Update `NEXT_PUBLIC_APP_URL` with your actual Vercel URL
3. Click **Redeploy** to apply changes

---

## Alternative: CLI Deployment

If you prefer using the command line:

```bash
cd "/Users/developerlabsai/Projects/RevenuePatch/DevLabs CFO"
vercel
```

Follow the prompts to:
1. Login to Vercel
2. Link to existing project or create new one
3. Deploy

---

## Post-Deployment Setup

### Create Admin User for Testing

Once deployed, your business partner will need an admin user to login:

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter email and password
4. **Auto Confirm Email**: ✅ Check this
5. Copy the User ID

Then run this SQL in **Supabase SQL Editor**:

```sql
DO $$
DECLARE
    v_user_id UUID := 'PASTE_USER_ID_HERE';
    v_org_id TEXT := 'org-devlabs-test';
BEGIN
    -- Create user profile
    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (v_user_id, 'Business Partner Name')
    ON CONFLICT (user_id) DO NOTHING;

    -- Link to organization
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (v_user_id, v_org_id, 'owner')
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    RAISE NOTICE 'User setup complete!';
END $$;
```

### Access the Dashboard

Your business partner can now:
1. Visit `https://your-app.vercel.app`
2. Login with the credentials created above
3. View the **Project Status Dashboard** showing development progress

---

## Troubleshooting

**Build fails with Prisma error:**
- Make sure `DATABASE_URL` and `DIRECT_URL` are set in environment variables
- Vercel will automatically run `prisma generate` during build

**Authentication not working:**
- Verify Supabase redirect URLs include your Vercel domain
- Check that all Supabase environment variables are set correctly

**Database connection fails:**
- Make sure the Supabase database is accessible from Vercel
- Check that connection strings are correct (use connection pooler port 6543 for DATABASE_URL)

---

## Continuous Deployment

Once connected via GitHub:
- Every push to `2-authentication` branch → deploys to preview URL
- Every merge to `main` branch → deploys to production URL

Your business partner will always see the latest version!
