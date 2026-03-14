# DevLabs CFO - Complete Testing Guide

## 🎯 Test the Complete User Journey

This guide walks you through testing every feature of the authentication and user management system.

---

## Prerequisites

✅ Development server running: `npm run dev`  
✅ Supabase project configured  
✅ Environment variables set  

---

## Phase 1: Create Initial Admin (5 minutes)

### Step 1: Run Bootstrap SQL

1. Open Supabase Dashboard → SQL Editor
2. Open `docs/setup-initial-admin.sql`
3. **Modify these values:**
   ```sql
   admin_email TEXT := 'your-email@company.com';
   admin_password TEXT := 'SecurePassword123!';
   admin_name TEXT := 'Your Full Name';
   ```
4. Click "Run" to execute
5. Verify output: "Admin user created successfully!"

### Step 2: Verify Admin User

Run this query in SQL Editor:
```sql
SELECT 
  up.full_name,
  up.role,
  up.status,
  au.email
FROM user_profiles up
JOIN auth.users au ON au.id = up.user_id
WHERE up.role = 'ADMIN';
```

Expected result:
- One row with your details
- `role` = 'ADMIN'
- `status` = 'ACTIVE'

---

## Phase 2: Test Login Flow (2 minutes)

### Test 1: Admin Login

1. Navigate to: http://localhost:3002/login
2. Enter admin credentials
3. Click "Sign in"

**✅ Expected:**
- Redirect to `/dashboard`
- See welcome message with your name
- See navigation sidebar
- See user dropdown in header

**❌ If it fails:**
- Check credentials match SQL script
- Verify user exists in Supabase Auth dashboard
- Check browser console for errors

### Test 2: Invalid Login

1. Go to `/login`
2. Enter wrong password
3. Click "Sign in"

**✅ Expected:**
- Error message: "Invalid email or password"
- Stay on login page
- Form shows error state

---

## Phase 3: Test Navigation (3 minutes)

### Test 3: Sidebar Navigation

From the dashboard, click each nav item:

1. **Dashboard** → Should highlight and show dashboard home
2. **Financial Data** → Should navigate (empty placeholder page expected)
3. **Analytics** → Should navigate (empty placeholder page expected)
4. **User Management** → Should show user list page
5. **Settings** → Should navigate (empty placeholder page expected)

**✅ Expected:**
- Active nav item highlighted in blue
- Page content changes
- URL updates correctly
- No errors in console

### Test 4: User Dropdown

1. Click user avatar in top right
2. Verify dropdown shows:
   - Your name
   - Your email
   - Role badge (Admin)
   - Settings option
   - Profile option
   - Log out button

**✅ Expected:**
- Dropdown opens/closes smoothly
- All info displays correctly
- Links work (even if pages are placeholders)

---

## Phase 4: Test User Invitation (5 minutes)

### Test 5: Invite New User

1. Navigate to `/dashboard/admin/users`
2. Click "Add User" button
3. Fill form:
   - Email: `test-user@example.com`
   - Full Name: `Test User`
   - Role: `Executive`
4. Click "Send Invitation"

**✅ Expected:**
- Success message appears
- Modal closes automatically
- New user appears in table with "Inactive" status
- Check email inbox for invitation

**❌ If email not received:**
- Check Supabase Email settings
- Check spam folder
- Verify NEXT_PUBLIC_APP_URL in .env
- Check Supabase logs for email send status

### Test 6: Validate Form Errors

1. Click "Add User"
2. Try submitting empty form

**✅ Expected:**
- Validation errors for each field
- Can't submit until valid

3. Enter existing admin email
4. Submit

**✅ Expected:**
- Error: "A user with this email already exists"

---

## Phase 5: Test Invitation Acceptance (10 minutes)

### Test 7: Magic Link Flow

1. Check email for invitation
2. Click magic link in email
3. Should redirect to `/invite-accept`

**✅ Expected:**
- Shows "Welcome to DevLabs CFO"
- Shows user's email
- Password setup form visible

### Test 8: Set Password

1. Enter password: `short`

**✅ Expected:**
- Validation error: needs 8+ chars, uppercase, lowercase, number

2. Enter valid password: `TestPass123!`
3. Confirm password with mismatch

**✅ Expected:**
- Error: "Passwords don't match"

4. Enter matching valid password
5. Click "Activate Account"

**✅ Expected:**
- Success message
- Redirect to `/login`
- Message shown: "Account activated successfully"

---

## Phase 6: Test New User Login (3 minutes)

### Test 9: Login as New User

1. On login page, enter:
   - Email: `test-user@example.com`
   - Password: (what you set)
2. Click "Sign in"

**✅ Expected:**
- Redirect to `/dashboard`
- Welcome message with "Test User"
- Navigation sidebar visible
- **No "User Management" option** (not admin)

### Test 10: Verify Role Restrictions

1. Try to navigate to: `/dashboard/admin/users`

**✅ Expected:**
- Redirect to `/dashboard`
- Error message: "You do not have permission"
- User cannot access admin features

---

## Phase 7: Test Password Reset (5 minutes)

### Test 11: Forgot Password Flow

1. Logout (click user dropdown → Log out)
2. Click "Forgot password?" on login page
3. Enter admin email
4. Click "Send reset link"

**✅ Expected:**
- Success screen: "Check your email"
- Email sent to inbox

5. Check email and click reset link
6. Should redirect to `/reset-password`

### Test 12: Reset Password

1. Enter new password
2. Confirm password
3. Click "Reset password"

**✅ Expected:**
- Success message
- Redirect to `/login`
- Message: "Password reset successfully"

4. Login with new password

**✅ Expected:**
- Login works with new password
- Old password no longer works

---

## Phase 8: Test Logout (2 minutes)

### Test 13: Logout Functionality

1. While logged in, click user dropdown
2. Click "Log out"

**✅ Expected:**
- Redirect to `/login`
- Session cleared
- Cannot access `/dashboard` without login
- Attempting to visit `/dashboard` redirects to login

---

## Phase 9: Test Inactive User (3 minutes)

### Test 14: Deactivate User

1. Login as admin
2. Go to User Management
3. In Supabase Dashboard → Table Editor → `user_profiles`
4. Find test user, change `status` to `INACTIVE`
5. Save changes

### Test 15: Verify Inactive User Blocked

1. Login as test user

**✅ Expected:**
- Error: "Your account has been deactivated"
- Cannot access dashboard
- Redirect to login

2. Re-activate user (set status back to `ACTIVE`)
3. Login should work again

---

## ✅ Success Criteria

All tests passing means:

- ✅ Admin creation works
- ✅ Login/logout works
- ✅ Password reset works
- ✅ User invitation works
- ✅ Invitation acceptance works
- ✅ Role-based access control works
- ✅ Status enforcement works
- ✅ Navigation works
- ✅ All forms validate correctly
- ✅ Error handling works

---

## 🐛 Common Issues & Fixes

### Issue: "User profile not found"
**Fix:** Run verification query to check user_profiles table

### Issue: Magic link doesn't work
**Fix:** 
- Check NEXT_PUBLIC_APP_URL matches your dev server
- Verify Supabase email template redirects correctly
- Check token hasn't expired (24 hours)

### Issue: "Account inactive" after accepting invitation
**Fix:** Check acceptInvitation action set status to 'ACTIVE'

### Issue: Can't access admin pages as admin
**Fix:**
- Verify role in user_profiles is 'ADMIN' (uppercase)
- Check middleware is running
- Clear cookies and re-login

### Issue: Logout doesn't work
**Fix:**
- Check browser console for errors
- Verify logoutUser action in auth.ts
- Clear cookies manually and re-test

---

## 📊 Test Results Template

Use this to track your testing:

```
Date: ___________
Tester: ___________

Phase 1: Admin Creation          [ ] Pass [ ] Fail
Phase 2: Login Flow              [ ] Pass [ ] Fail
Phase 3: Navigation              [ ] Pass [ ] Fail
Phase 4: User Invitation         [ ] Pass [ ] Fail
Phase 5: Invitation Acceptance   [ ] Pass [ ] Fail
Phase 6: New User Login          [ ] Pass [ ] Fail
Phase 7: Password Reset          [ ] Pass [ ] Fail
Phase 8: Logout                  [ ] Pass [ ] Fail
Phase 9: Inactive User           [ ] Pass [ ] Fail

Notes:
_____________________________________________________
_____________________________________________________
```

---

## 🎉 Next Steps After Testing

Once all tests pass:
1. Document any bugs found
2. Consider adding admin user actions (edit/delete)
3. Start building financial features
4. Prepare for deployment
