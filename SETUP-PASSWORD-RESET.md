# Setting Up Password Reset in Supabase

## Overview
This guide helps you configure password reset functionality in Supabase Dashboard.

## Step 1: Enable Email Authentication

1. Go to **Supabase Dashboard**: https://fqljijavvxkthzozslzx.supabase.co
2. Navigate to **Authentication → Providers**
3. Find **Email** provider
4. Ensure it's **Enabled** (should already be enabled)
5. Check that **Confirm email** is enabled (for new registrations)

## Step 2: Configure Redirect URLs

1. Go to **Authentication → URL Configuration**
2. Under **Redirect URLs**, add the following:
   - Development: `http://localhost:3002/**`
   - Production: `https://yourdomain.com/**` (when deployed)
3. Click **Save**

## Step 3: Customize Email Templates

1. Go to **Authentication → Email Templates**
2. Click on **Reset Password** template
3. Customize the email content (optional):

```html
<h2>Reset Password</h2>
<p>Follow this link to reset your DevLabs CFO password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

4. Click **Save**

## Step 4: Test Password Reset Flow

### Test Scenario 1: Successful Password Reset

1. Go to **http://localhost:3002/login**
2. Click **"Forgot password?"**
3. Enter your email address
4. Click **"Send reset link"**
5. Check your email inbox
6. Click the reset link in the email
7. Enter new password (must meet requirements):
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
8. Click **"Reset password"**
9. You should be redirected to login page
10. Login with your new password

### Test Scenario 2: Expired Token

1. Request a password reset email
2. Wait for the link to expire (1 hour) OR use an old reset link
3. Click the expired link
4. You should see an error message with option to request a new link
5. Click **"Request new link"** to go back to forgot password page

### Test Scenario 3: Invalid Email (Security Test)

1. Go to **http://localhost:3002/forgot-password**
2. Enter a non-existent email address
3. Click **"Send reset link"**
4. You should see a success message (this is intentional - prevents email enumeration)
5. No email will be sent (but user doesn't know this)

## Troubleshooting

**Error: "Invalid or expired reset link"**
- The reset link may have expired (1 hour limit)
- Request a new reset link
- Make sure you're clicking the most recent link

**Error: "Failed to update password"**
- Check that new password meets all complexity requirements
- Try clearing browser cache and cookies
- Check browser console for errors

**Not receiving reset email:**
- Check spam/junk folder
- Verify email provider is enabled in Supabase Dashboard
- Check Supabase logs: Dashboard → Logs → Auth Logs
- Ensure redirect URLs are configured correctly

**Password requirements not met:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*, etc.)

## Security Features

✅ **Email Enumeration Protection**: Always shows success message, even for non-existent emails
✅ **Token Expiration**: Reset links expire after 1 hour
✅ **Single-use Tokens**: Reset tokens can only be used once
✅ **Session Invalidation**: All existing sessions are terminated after password change
✅ **Password Complexity**: Strong password requirements enforced

## Production Checklist

Before deploying to production:

- [ ] Update redirect URLs with production domain
- [ ] Customize email template with company branding
- [ ] Set up custom email domain (optional, via Supabase settings)
- [ ] Test password reset flow in production environment
- [ ] Configure rate limiting for password reset requests (Supabase handles this automatically)
- [ ] Set up monitoring for failed password reset attempts

## Next Steps

Once password reset is working:
- Test with actual users
- Monitor auth logs for any issues
- Proceed to **Phase 6: Profile Management**
