# DevLabs CFO - Initial Setup Guide

This guide will help you create your first admin user and get the system running.

---

## Prerequisites

✅ Database migrations applied
✅ Environment variables configured
✅ Next.js application running

---

## Step 1: Create Initial Admin User

### Option A: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Navigate to your project
   - Go to SQL Editor

2. **Run the Bootstrap Script**
   - Open `docs/setup-initial-admin.sql`
   - **IMPORTANT:** Update these values:
     ```sql
     admin_email TEXT := 'your-email@company.com';
     admin_password TEXT := 'YourSecurePassword123!';
     admin_name TEXT := 'Your Full Name';
     ```
   
3. **Execute the Script**
   - Paste the modified script into SQL Editor
   - Click "Run"
   - Verify you see: "Admin user created successfully!"

4. **Verify Creation**
   - Run the verification query at the bottom of the script
   - Confirm you see one row with role='ADMIN', status='ACTIVE'

### Option B: Using Supabase CLI

```bash
# Run the bootstrap script
supabase db execute -f docs/setup-initial-admin.sql
```

---

## Step 2: Login to the System

1. **Start the Development Server** (if not running)
   ```bash
   npm run dev
   ```

2. **Navigate to Login Page**
   - Open: http://localhost:3002/login

3. **Login with Admin Credentials**
   - Email: (the email you set in the script)
   - Password: (the password you set in the script)

4. **You Should Be Redirected To**
   - URL: http://localhost:3002/dashboard
   - Dashboard home page

---

## Step 3: Access Admin Panel

1. **Navigate to User Management**
   - Click on "Admin" or navigate to: http://localhost:3002/dashboard/admin/users

2. **Verify Admin Access**
   - You should see the user management page
   - Your admin user should be listed
   - "Add User" button should be visible

---

## Step 4: Invite Additional Users

1. **Click "Add User" Button**
   - Enter email, full name, and select role (Admin/Executive/Analyst)
   - Click "Send Invitation"

2. **User Receives Email**
   - Magic link sent via Supabase Email
   - Link expires in 24 hours
   - Single-use token

3. **New User Setup**
   - User clicks magic link
   - Sets password (8+ chars, uppercase, lowercase, number)
   - Account activated automatically
   - Redirected to login

---

## Troubleshooting

### "Invalid email or password"
- Double-check the credentials you set in the SQL script
- Ensure the script executed without errors
- Verify the user exists in Supabase Auth dashboard

### "User profile not found"
- The user_profiles record may not have been created
- Run the verification query to check
- Re-run the bootstrap script with a different email

### "Account has been deactivated"
- Check user_profiles.status is 'ACTIVE'
- Update in Supabase dashboard if needed:
  ```sql
  UPDATE user_profiles 
  SET status = 'ACTIVE' 
  WHERE user_id = 'your-user-id';
  ```

### "You do not have permission"
- Verify user_profiles.role is 'ADMIN'
- Update in Supabase dashboard:
  ```sql
  UPDATE user_profiles 
  SET role = 'ADMIN' 
  WHERE user_id = 'your-user-id';
  ```

### Magic Link Not Working
- Check Supabase Email configuration
- Verify NEXT_PUBLIC_APP_URL is set correctly
- Check spam folder
- Token may have expired (24 hours)

---

## Security Best Practices

🔒 **After Initial Setup:**

1. **Change Default Password**
   - Use "Forgot Password" flow
   - Set a strong, unique password

2. **Delete Bootstrap Script**
   - Remove or secure `setup-initial-admin.sql`
   - Contains plaintext password

3. **Enable 2FA** (Future Enhancement)
   - Will be available in future releases

4. **Audit Admin Actions**
   - All user management actions are logged
   - View at `/dashboard/admin/audit-logs` (coming soon)

---

## Next Steps

- ✅ Invite team members
- ✅ Explore the dashboard
- ✅ Configure financial data
- ✅ Set up integrations (Xero, Mercury)

---

## Support

For issues or questions:
- Check the main README.md
- Review architecture documentation
- Contact system administrator
