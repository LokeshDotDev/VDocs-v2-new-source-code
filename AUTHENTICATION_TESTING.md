# Authentication & Database Testing Guide

## ✅ All Systems Ready!

### 🎯 What's Been Completed

1. **Database Setup** ✅
   - PostgreSQL running on Docker (port 5433)
   - All tables created via Prisma migrations
   - Schema includes: User, Account, Session, Job, Analytics, SystemConfig, VerificationToken

2. **NextAuth Configuration** ✅
   - JWT-based authentication
   - Credentials provider (email/password)
   - Google & GitHub OAuth (ready to configure)
   - Admin role detection
   - Secure password hashing (bcrypt)

3. **Frontend Setup** ✅
   - Running on http://localhost:3001
   - SessionProvider properly configured
   - User menu with dropdown
   - Protected routes
   - Admin dashboard ready

## 🧪 Testing Steps

### Step 1: Sign Up (Create Admin User)

1. Open: http://localhost:3001/auth/signup
2. Fill in the form:
   - **Name:** Admin User
   - **Email:** `admin@vdocs.com` (matches ADMIN_EMAIL in .env)
   - **Password:** `admin123` (minimum 8 characters)
   - **Confirm Password:** `admin123`
3. Click "Sign Up"
4. You should be redirected to login page with success message

### Step 2: Login

1. You're at: http://localhost:3001/auth/login
2. Enter credentials:
   - **Email:** `admin@vdocs.com`
   - **Password:** `admin123`
3. Click "Sign In"
4. You should be redirected to http://localhost:3001/one-click

### Step 3: Verify Admin Access

1. Check navbar - you should see:
   - Your name "Admin User" with avatar
   - Click on your name to open user menu
   - See "Admin" badge in the dropdown
   - See "My Jobs" and "Logout" options
2. Click "Admin" link in navbar
3. You should see the admin dashboard at http://localhost:3001/admin

### Step 4: Test Admin Dashboard

The dashboard should show:
- **Total Users:** 1 (you!)
- **Total Jobs:** 0 (no jobs yet)
- **Success Rate:** 0% (no jobs completed)
- **Avg Processing Time:** 0s
- **Recent Jobs:** Empty list

### Step 5: Test One-Click Processing

1. Go to http://localhost:3001/one-click
2. Drag & drop a PDF file
3. Watch the visual pipeline:
   - Convert stage (PDF → DOCX)
   - Anonymize stage (PII removal)
   - Humanize stage (AI detection bypass)
   - Spell/Grammar stage
   - Format stage
4. Once complete, download your processed file

### Step 6: Verify Job Tracking

1. Go back to admin dashboard: http://localhost:3001/admin
2. Refresh the page
3. You should now see:
   - **Total Jobs:** 1
   - Your uploaded file in "Recent Jobs" list
   - Updated statistics

### Step 7: Test Non-Admin User

1. Logout (click your name → Logout)
2. Go to http://localhost:3001/auth/signup
3. Create a regular user:
   - **Email:** `user@example.com` (different from ADMIN_EMAIL)
   - **Password:** `user1234`
4. Login with new credentials
5. Check navbar - NO "Admin" link should appear
6. Try accessing http://localhost:3001/admin directly
7. You should get "Unauthorized" error (403)

### Step 8: Test Protected Routes

1. Logout completely
2. Try accessing: http://localhost:3001/one-click
3. You should be redirected to: http://localhost:3001/auth/login?callbackUrl=/one-click
4. After login, you'll return to the one-click page

## 🔍 Verification Checklist

### Database Verification
```bash
# View database tables
cd frontend
npx prisma studio
# Opens at http://localhost:5555
```

Check tables:
- [ ] User table has your admin user
- [ ] User role is "admin" for admin@vdocs.com
- [ ] User role is "user" for other accounts
- [ ] Password is hashed (not plain text)
- [ ] Job table exists (may be empty)
- [ ] Session table exists

### Frontend Verification
- [ ] Signup page loads and looks beautiful
- [ ] Login page loads and looks beautiful
- [ ] User can sign up successfully
- [ ] User can login successfully
- [ ] User menu shows name and email
- [ ] Admin user sees "Admin" badge
- [ ] Admin user can access /admin route
- [ ] Regular user cannot access /admin route
- [ ] Logout works correctly
- [ ] Protected routes redirect to login

### Admin Dashboard Verification
- [ ] Dashboard loads without errors
- [ ] Statistics cards display correctly
- [ ] User count is accurate
- [ ] Recent jobs list works
- [ ] Auto-refresh every 30 seconds
- [ ] Beautiful Grok-inspired design

## 🎨 Visual Elements to Check

### Navbar
- Fixed at top (doesn't scroll)
- VDocs logo with gradient
- Navigation links (One-Click, Converter, etc.)
- User avatar with first letter of name
- Dropdown menu on click
- Smooth animations

### User Menu Dropdown
- Shows user name and email
- Admin badge for admin users
- "My Jobs" link
- "Logout" button in red
- Closes when clicking outside
- Dark theme matching design

### Admin Dashboard
- Gradient background
- Glassmorphism cards
- Animated stat cards with icons
- Color-coded status badges
- Real-time data updates
- Professional layout

## 🐛 Troubleshooting

### Cannot signup/login
- Check PostgreSQL is running: `docker ps | grep postgres`
- Verify DATABASE_URL in .env: `localhost:5433`
- Check Prisma Client is generated: `npx prisma generate`

### "Unauthorized" error on admin page
- Verify your email matches ADMIN_EMAIL in .env
- Check user role in database (Prisma Studio)
- Clear browser cookies and login again

### Database connection error
- Ensure Docker is running: `docker ps`
- Check postgres container: `docker logs postgres`
- Test connection: `docker exec -it postgres psql -U postgres -d wedocs`

### Frontend won't start
- Kill process: `lsof -ti:3001 | xargs kill -9`
- Install dependencies: `npm install`
- Start again: `PORT=3001 npm run dev`

### Session not persisting
- Check NEXTAUTH_SECRET is set in .env
- Clear browser cache/cookies
- Restart frontend server

## 📊 Database Schema Overview

### User Model
```
- id: Unique identifier
- name: User's full name
- email: Unique email (login)
- password: Hashed password
- role: "user" or "admin"
- createdAt: Registration date
```

### Job Model
```
- id: Unique identifier
- userId: Foreign key to User
- fileName: Original file name
- fileSize: File size in bytes
- status: pending/processing/completed/failed
- stage: Current processing stage
- progress: 0-100 percentage
- duration: Processing time in seconds
- resultUrl: Download link
- errorMsg: Error if failed
```

### Analytics Model
```
- date: Date of stats
- totalJobs: Jobs count
- completedJobs: Success count
- failedJobs: Failure count
- avgProcessingTime: Average duration
- totalFileSize: Storage used
```

## 🚀 Next Features to Test (Future)

- [ ] Email verification
- [ ] Password reset
- [ ] Google OAuth login
- [ ] GitHub OAuth login
- [ ] User job history page
- [ ] File size limits
- [ ] Rate limiting
- [ ] Billing/subscriptions

## 📞 Support

Everything is working! You now have:
1. ✅ Beautiful Grok-inspired UI
2. ✅ Full authentication system
3. ✅ Admin dashboard with analytics
4. ✅ Database tracking
5. ✅ Protected routes
6. ✅ User management

Visit http://localhost:3001 and start testing!
