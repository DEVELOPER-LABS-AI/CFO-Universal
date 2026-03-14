# Supabase Redirect URL Configuration

## Step 1: Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard/projects
2. Click on your project: **fqljijavvxkthzozslzx**
3. Or direct link: https://supabase.com/dashboard/project/fqljijavvxkthzozslzx

## Step 2: Navigate to URL Configuration

1. In the left sidebar, click **Authentication**
2. Click on **URL Configuration** tab
3. You'll see sections for:
   - Site URL
   - Redirect URLs

## Step 3: Configure Site URL

Set the **Site URL** to your production URL:
```
https://devlabs-cfo.vercel.app
```

## Step 4: Configure Redirect URLs

Add these URLs to the **Redirect URLs** section (click "Add URL" for each):

### For Production:
```
https://devlabs-cfo.vercel.app/**
https://devlabs-cfo.vercel.app/auth/callback
https://devlabs-cfo.vercel.app/reset-password
```

### Keep Localhost for Development:
```
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
```

**Note**: The `/**` wildcard pattern allows all paths under that domain.

## Step 5: Save Configuration

1. Click **Save** at the bottom of the page
2. Wait for the confirmation message

## Step 6: Test Authentication Flow

After saving, test these flows:

### Login Flow:
1. Go to https://devlabs-cfo.vercel.app/login
2. Enter credentials
3. Should redirect to dashboard after login

### Password Reset Flow:
1. Go to https://devlabs-cfo.vercel.app/forgot-password
2. Enter email address
3. Check email for reset link
4. Click reset link → should go to https://devlabs-cfo.vercel.app/reset-password
5. Enter new password
6. Should redirect to login page

## Troubleshooting

**If you get "Invalid redirect URL" error:**
- Double-check the URLs are exactly as shown above
- Make sure there are no trailing slashes (except for `/**`)
- Verify the Site URL matches your production domain

**If password reset emails have wrong URL:**
- Check that `NEXT_PUBLIC_APP_URL` environment variable in Vercel is set to `https://devlabs-cfo.vercel.app`
- Redeploy after changing environment variables

**If authentication doesn't work:**
- Clear browser cookies and try again
- Check browser console for CORS errors
- Verify all Supabase environment variables are set correctly in Vercel
