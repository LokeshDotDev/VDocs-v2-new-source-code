# VDocs - Complete SAAS Platform

## 🎨 What's New

### ✅ Beautiful Grok-Inspired UI
- Dark theme with gradient backgrounds (#050910, #0a1020, #0b1224)
- Glassmorphism effects with backdrop-blur
- Gradient text and buttons (indigo to purple)
- Smooth animations and transitions
- Professional fixed navbar and footer

### ✅ Authentication System
- **NextAuth.js v5** with JWT sessions
- **3 Login Methods**:
  - Email/Password (with bcrypt hashing)
  - Google OAuth
  - GitHub OAuth
- Protected routes with middleware
- User registration with validation
- Beautiful auth pages matching design system

### ✅ Admin Dashboard
- Real-time statistics and analytics
- User management and monitoring
- Job tracking with status
- Performance metrics (success rate, avg processing time)
- Storage tracking
- Recent jobs list with details
- **Admin-only access** (based on email)

### ✅ Database Integration
- **PostgreSQL** with Prisma ORM
- **7 Models**:
  - User (authentication, role management)
  - Account (OAuth providers)
  - Session (user sessions)
  - Job (processing job tracking)
  - Analytics (daily aggregated stats)
  - SystemConfig (key-value configuration)
  - VerificationToken (email verification)
- Automatic admin detection by email
- Job tracking with stages and progress

### ✅ Enhanced One-Click Processing
- Visual 5-stage pipeline:
  1. Convert (PDF → DOCX)
  2. Anonymize (PII removal)
  3. Humanize (AI detection bypass)
  4. Spell/Grammar (corrections)
  5. Format (final polish)
- Real-time progress updates
- Animated stage cards
- Error handling with detailed messages
- Individual file downloads

### ✅ Universal Converter
- 100+ format support
- Documents: PDF, DOCX, ODT, RTF, TXT, HTML, EPUB, etc.
- Images: PNG, JPG, WEBP, BMP, TIFF, SVG, etc.
- Videos: MP4, AVI, MOV, MKV, WebM, etc.
- Audio: MP3, WAV, OGG, FLAC, AAC, etc.
- Individual file downloads (not ZIP)

### ✅ Smart Navigation
- Fixed top navbar (doesn't scroll)
- User menu with dropdown
- Shows user name and email
- Admin badge for admin users
- Logout functionality
- Conditional "Admin" link (admin-only)
- Hides on landing and auth pages

## 📁 New Files Created

### Authentication
- `frontend/app/auth/login/page.tsx` - Login page
- `frontend/app/auth/signup/page.tsx` - Registration page
- `frontend/app/api/auth/signup/route.ts` - Registration API
- `frontend/app/api/auth/[...nextauth]/route.ts` - NextAuth handlers
- `frontend/lib/auth.ts` - NextAuth configuration
- `frontend/middleware.ts` - Route protection

### Database
- `frontend/prisma/schema.prisma` - Database schema
- `frontend/lib/prisma.ts` - Prisma client singleton
- `frontend/types/next-auth.d.ts` - TypeScript types

### Admin Dashboard
- `frontend/app/admin/page.tsx` - Admin dashboard UI
- `frontend/app/api/admin/dashboard/route.ts` - Dashboard API

### Documentation
- `SETUP_INSTRUCTIONS.md` - Complete setup guide
- `setup.sh` - Automated setup script
- `.env.example` - Environment variables template

## 🚀 Quick Start

### 1. Setup Database
```bash
# Create PostgreSQL database
createdb vdocs

# Copy environment file
cd frontend
cp .env.example .env
# Edit .env with your database URL and secrets
```

### 2. Run Migrations
```bash
cd frontend
npx prisma migrate dev --name init
npx prisma generate
```

### 3. Start Services
```bash
# Terminal 1: Docker services
docker-compose up

# Terminal 2: Backend
cd server && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 4. Create Admin User
1. Visit http://localhost:3001/auth/signup
2. Use the email you set as `ADMIN_EMAIL` in `.env`
3. Complete registration
4. Login at http://localhost:3001/auth/login
5. Access admin dashboard at http://localhost:3001/admin

## 📊 Admin Dashboard Features

### Statistics Cards
- **Total Users** - All registered users + active users (last 7 days)
- **Total Jobs** - All processing jobs + currently processing
- **Success Rate** - Percentage of completed jobs
- **Avg Processing Time** - Average duration in seconds

### Detailed Metrics
- Completed jobs count
- Failed jobs count
- Total storage used (in GB)

### Recent Jobs Table
- File names and status
- Creation timestamps
- Processing duration
- Status badges (completed/failed/processing)

### Real-time Updates
- Auto-refreshes every 30 seconds
- Live job status tracking
- Performance monitoring

## 🔐 Security Features

### Authentication
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with secure secret
- Session management with NextAuth
- CSRF protection

### Authorization
- Protected routes with middleware
- Admin-only dashboard access
- Email-based admin detection
- Automatic role assignment

### Route Protection
- `/` - Public landing page
- `/auth/*` - Public auth pages
- All other routes - Requires authentication
- `/admin` - Requires admin role

## 🎯 Environment Variables

### Required
```env
DATABASE_URL="postgresql://user:password@localhost:5432/vdocs"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"  # Generate: openssl rand -base64 32
ADMIN_EMAIL="admin@example.com"
```

### Optional (OAuth)
```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"
GITHUB_ID="your-github-app-id"
GITHUB_SECRET="your-github-secret"
```

## 🎨 Design System

### Colors
- Background: `#050910`, `#0a1020`, `#0b1224`
- Primary: Indigo (`#6366f1`) to Purple (`#a855f7`) gradients
- Text: Slate shades (`slate-100`, `slate-400`)
- Borders: `white/10`, `white/20`

### Effects
- Glassmorphism: `backdrop-blur-lg`
- Gradients: `bg-gradient-to-br from-indigo-500/10 to-purple-500/10`
- Animations: `transition-colors`, `hover:scale-105`
- Shadows: `shadow-xl`, `shadow-2xl`

### Typography
- Headings: Bold, gradient text
- Body: `text-slate-400`
- Interactive: `hover:text-indigo-400`

## 📱 Pages Overview

### Public Pages
- **/** - Landing page (coming soon)
- **/auth/login** - Login with email or OAuth
- **/auth/signup** - User registration

### Protected Pages
- **/one-click** - Main processing interface with visual pipeline
- **/convert** - Universal file converter
- **/reductor** - Document anonymization
- **/humanizer** - AI humanization
- **/editor** - Document editor (CKEditor)
- **/jobs** - User job history (coming soon)

### Admin Pages
- **/admin** - Admin dashboard with analytics

## 🔧 Tech Stack

### Frontend
- **Next.js 15.4.5** - React framework with App Router
- **React 19.1.0** - UI library
- **NextAuth.js v5** - Authentication
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Lucide React** - Icons

### Backend
- **Node.js** - JavaScript runtime
- **Express** - API framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database

### Python Services
- **FastAPI** - API framework
- **PyMuPDF** - PDF processing
- **Transformers** - AI models
- **FFmpeg** - Media conversion
- **LibreOffice** - Document conversion

## 📈 Database Schema

### User Table
```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  password      String?
  emailVerified DateTime?
  image         String?
  role          String    @default("user")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  jobs          Job[]
  sessions      Session[]
  accounts      Account[]
}
```

### Job Table
```prisma
model Job {
  id          String    @id @default(cuid())
  userId      String
  fileName    String
  fileSize    BigInt
  fileType    String
  status      String    @default("pending")
  stage       String?
  progress    Int       @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  duration    Float?
  resultUrl   String?
  errorMsg    String?
  metadata    Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}
```

## 🎯 Next Steps

### To Complete Setup:
1. ✅ Install dependencies: `npm install` (done)
2. ✅ Generate Prisma: `npx prisma generate` (done)
3. ⏳ Create `.env` file with database URL
4. ⏳ Run migrations: `npx prisma migrate dev`
5. ⏳ Start all services
6. ⏳ Create first admin user

### Future Enhancements:
- Email verification system
- User job history page
- File size limits and quotas
- Billing/subscription system
- API rate limiting
- Webhook notifications
- Export analytics reports
- Team collaboration features

## 📞 Support

For detailed setup instructions, see [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)

For technical documentation, check the markdown files in the root directory.

## 🎉 What You Can Do Now

1. **Sign up** with your email and get admin access
2. **Upload files** through the one-click interface
3. **Track processing** with real-time visual feedback
4. **Monitor stats** in the admin dashboard
5. **Convert files** in 100+ formats
6. **Manage users** and view job history

---

**Built with ❤️ using Next.js, React, and Grok-inspired design**
