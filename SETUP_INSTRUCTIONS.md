# VDocs Setup Instructions

## Prerequisites
- PostgreSQL installed and running
- Node.js 18+ installed
- Docker Desktop running (for Python services)

## Step 1: Database Setup

### Create PostgreSQL Database
```bash
# Using psql
createdb vdocs

# Or using PostgreSQL shell
psql postgres
CREATE DATABASE vdocs;
\q
```

### Create .env File
```bash
cd frontend
cp .env.example .env
```

Edit `.env` and update:
```env
DATABASE_URL="postgresql://yourusername:yourpassword@localhost:5432/vdocs"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="generate-a-random-secret-here"  # Run: openssl rand -base64 32
ADMIN_EMAIL="your-admin@email.com"

# Optional: OAuth providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_ID=""
GITHUB_SECRET=""
```

### Run Database Migration
```bash
cd frontend
npx prisma migrate dev --name init
```

This will:
- Create all database tables
- Generate Prisma Client
- Create migration files

## Step 2: Start All Services

### Terminal 1: Python Services
```bash
cd /Users/vivekvyas/Desktop/Vdocs/vdocs-sourceCode
docker-compose up
```

This starts:
- Python Manager (port 8000)
- PDF2HTMLex Service (port 8001)
- Universal Converter (port 8002)
- Humanizer Service (port 8003)
- Reductor V3 Service (port 8004)

### Terminal 2: Backend Server
```bash
cd server
npm install
npm run dev
```

Runs on port 3000

### Terminal 3: Frontend
```bash
cd frontend
npm install
npm run dev
```

Runs on port 3001

## Step 3: Access the Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Admin Dashboard: http://localhost:3001/admin (requires admin email)

## Step 4: Create First User

1. Go to http://localhost:3001/auth/signup
2. Fill in:
   - Name: Your Name
   - Email: Use the email you set as ADMIN_EMAIL in .env
   - Password: At least 8 characters
3. Click "Sign Up"
4. Go to login page and sign in
5. You'll have admin access automatically

## Database Management Commands

### View Database
```bash
cd frontend
npx prisma studio
```
Opens GUI at http://localhost:5555

### Reset Database
```bash
cd frontend
npx prisma migrate reset
```

### Update Schema
After editing `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name your_migration_name
npx prisma generate
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `psql postgres`
- Check DATABASE_URL format
- Ensure database exists: `\l` in psql

### NextAuth Errors
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Restart dev server after .env changes

### Admin Access Not Working
- Ensure your email in signup matches ADMIN_EMAIL in .env
- Check role in database: `npx prisma studio`
- Verify middleware.ts is not blocking /admin route

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| NEXTAUTH_URL | Frontend URL | Yes |
| NEXTAUTH_SECRET | Random secret for JWT | Yes |
| ADMIN_EMAIL | Email for admin user | Yes |
| GOOGLE_CLIENT_ID | Google OAuth | No |
| GOOGLE_CLIENT_SECRET | Google OAuth | No |
| GITHUB_ID | GitHub OAuth | No |
| GITHUB_SECRET | GitHub OAuth | No |

## Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
npm start
```

### Environment Variables for Production
- Use production database URL
- Generate new NEXTAUTH_SECRET
- Update NEXTAUTH_URL to your domain
- Enable OAuth providers for production

## Next Steps

After setup:
1. ✅ Test user registration and login
2. ✅ Access admin dashboard
3. ✅ Upload a file through one-click processing
4. ✅ Check job tracking in admin panel
5. Configure OAuth providers (optional)
6. Set up email verification (optional)
