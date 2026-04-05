# ⚡ TERRITORY RUNNER - LOCAL SETUP & QUICK START

Complete guide to set up Territory Runner locally with Google OAuth and professional emails, then deploy to production.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Clone & Install

```bash
# Clone repository
git clone https://github.com/your-username/territory-runner.git
cd territory-runner

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Setup Google OAuth

> **Complete the Google OAuth setup first!** See `DEPLOYMENT_FREE_GUIDE.md` → Section 1

After setting up Google Cloud project:
1. Copy your `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
2. Add to backend `.env` and frontend `.env.local` (see Step 3)

### Step 3: Create Environment Files

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/territory_runner
JWT_SECRET_KEY=dev-secret-key-change-in-production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@territoryrunner.local
SMTP_FROM_NAME=Territory Runner
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-secret
APP_NAME=Territory Runner
OTP_DEBUG_MODE=true
SKIP_AUTH=false
```

**Frontend** (`frontend/.env.local`):
```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your-google-web-client-id
EXPO_PUBLIC_APP_NAME=Territory Runner
```

### Step 4: Start Database

```bash
# If using Docker
docker run --name territory-runner-db \
  -e POSTGRES_DB=territory_runner \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:16

# Run migrations
cd backend
python migrate.py
cd ..
```

### Step 5: Run Backend

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
# Should show: Uvicorn running on http://127.0.0.1:8000
```

### Step 6: Run Frontend

```bash
cd frontend
npm start
# For web: http://localhost:3000
# For iOS: npm run ios
# For Android: npm run android
```

### Step 7: Test Login

**Traditional Login:**
1. Click "Create New Account" on login screen
2. Enter email, username, password
3. Verify email with OTP code
4. Login with credentials

**Google Login (NEW!):**
1. Click "Sign in with Google" button
2. Select Google account
3. Automatic account creation and login
4. Enter profile info on first login

---

## 🔧 Detailed Setup Instructions

### Backend Setup

#### Prerequisites

- Python 3.12+
- PostgreSQL 13+
- pip / venv

#### Step-by-Step

1. **Create Python virtual environment**
   ```bash
   cd backend
   python -m venv venv
   
   # Activate (Windows)
   venv\Scripts\activate
   
   # Activate (macOS/Linux)
   source venv/bin/activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Setup PostgreSQL**
   
   **Option A: Using Docker**
   ```bash
   docker run --name territory-runner-db \
     -e POSTGRES_DB=territory_runner \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=password \
     -p 5432:5432 \
     -d postgres:16
   ```
   
   **Option B: Using Local PostgreSQL**
   ```bash
   # Create database
   createdb territory_runner
   
   # Verify connection
   psql -U postgres -d territory_runner -c "SELECT 1"
   ```

4. **Create `.env` file** (see template above)

5. **Run migrations**
   ```bash
   python migrate.py
   # Should show:
   # 2024-01-15 10:30:45  INFO     migrator   Migration 001: Initial schema
   # 2024-01-15 10:30:46  INFO     migrator   Migration 002: Social progression
   # ... (all migrations should run)
   ```

6. **Test email config** (optional but recommended)
   ```bash
   python test_email_setup.py
   ```

7. **Start backend**
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

   **Expected output:**
   ```
   INFO:     Uvicorn running on http://127.0.0.1:8000
   INFO:     Application startup complete
   ```

### Frontend Setup

#### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio / Xcode (for native builds)

#### Step-by-Step

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Create `.env.local` file** (see template above)

3. **Test build**
   ```bash
   npm run lint    # Check for errors
   npm run build   # Build for production
   ```

4. **Start dev server**
   - **Web:** `npm start` → http://localhost:19006
   - **iOS:** `npm run ios` (requires Xcode)
   - **Android:** `npm run android` (requires Android Studio)
   - **Expo Go:** `expo start` → scan QR code with Expo Go app

### Email Setup (SMTP with Gmail)

#### Get Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select: "Mail" and "Windows Computer" (or your device)
3. Google will generate 16-character password
4. Copy and paste into `SMTP_PASSWORD` in `.env`

#### Alternative Email Providers

**Sendgrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.xxxxx
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-ses-user
SMTP_PASSWORD=your-ses-password
```

### Google OAuth Setup

#### For Development

1. In Google Cloud Console → Credentials
2. Create new OAuth 2.0 Web application credential
3. Add authorized redirect URIs:
   ```
   http://localhost:3000
   http://localhost:19006
   http://localhost:8081
   ```
4. Copy Client ID → `GOOGLE_OAUTH_CLIENT_ID`
5. Copy Client Secret → `GOOGLE_OAUTH_CLIENT_SECRET`

#### For Production

Update redirect URIs to:
```
https://yourdomain.com
https://yourdomain.vercel.app
https://yourdomain.expo.dev
```

---

## 🐛 Troubleshooting

### Backend Issues

**"Cannot connect to database"**
```bash
# Check PostgreSQL is running
sudo service postgresql status    # Linux
brew services list               # macOS
docker ps                         # Docker

# Verify connection string
psql postgresql+asyncpg://postgres:password@localhost:5432/territory_runner
```

**"Email not sending"**
```bash
# Test email config
python test_email_setup.py

# Check SMTP credentials
# Make sure Gmail app password is 16 chars (no spaces)
```

**"Migrations failed"**
```bash
# Check database exists
psql -l | grep territory_runner

# Run cleanup and retry
python clean_db.py
python migrate.py
```

### Frontend Issues

**"Cannot connect to backend"**
```bash
# Check backend is running on port 8000
curl http://localhost:8000/api/

# Check EXPO_PUBLIC_API_URL in .env.local
# For Mac, may need to use machine IP instead of localhost:
# EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

**"Google OAuth not working"**
```bash
# Check EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is set
# Make sure it's the WEB client ID (not iOS/Android)
# Test in browser: click "Sign in with Google"
```

**"Module not found"**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Verification Checklist

- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:19006 (web) or via Expo
- [ ] Can access API: `curl http://localhost:8000/api/`
- [ ] Database migrations completed
- [ ] SMTP email configured and tested
- [ ] Google OAuth credentials created
- [ ] Can create account with email/password
- [ ] Can verify email with OTP
- [ ] Can login with credentials
- [ ] Can login with Google account
- [ ] Can see professional "forgot password" email

---

## 📦 Database Migration

To deploy migrations to production:

1. New migrations go in `backend/migrations/` (e.g., `007_my_feature.sql`)
2. Numeric prefix determines order (001, 002, 003, etc.)
3. Use `IF NOT EXISTS` to avoid duplicate object errors
4. On Railway, migrations run automatically during deployment

**Example migration:**
```sql
-- Migration: Add new feature
-- Purpose: Describe what this migration does
-- Date: 2026-04-05

ALTER TABLE users ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_new_field ON users(new_field);
```

---

## 🚀 Ready to Deploy?

Follow the steps in `DEPLOYMENT_FREE_GUIDE.md` to deploy:
- Backend to Railway (free)
- Frontend to Vercel (free)
- Database to Railway PostgreSQL (free)

**Production URLs will look like:**
- Frontend: `https://territory-runner.vercel.app`
- Backend: `https://territory-runner-prod.up.railway.app`
- API: `https://territory-runner-prod.up.railway.app/api`

---

## 📞 Common Commands

```bash
# Backend
cd backend
python manage.py runserver           # Run dev server
python test_email_setup.py           # Test email
python clean_db.py                   # Wipe database
python migrate.py                    # Run migrations

# Frontend
cd frontend
npm start                            # Web dev server
npm run ios                          # iOS simulator
npm run android                      # Android emulator
npm run build                        # Production build
npm run lint                         # Check for errors

# Database (Docker)
docker ps                            # List containers
docker logs territory-runner-db     # View logs
docker stop territory-runner-db     # Stop container
docker rm territory-runner-db       # Delete container

# Git
git add .
git commit -m "Your message"
git push origin main                # Deploy to production
```

---

## 🎯 What's New in This Update

✅ **Professional Email Templates** - Forgot password emails are now attractive with HTML styling  
✅ **Google OAuth Login** - Direct login with Google account, no password needed  
✅ **Free Deployment** - Deploy to Railway (backend) and Vercel (frontend)  
✅ **Fixed Network Issues** - CORS properly configured for frontend-backend communication  
✅ **Email Fixes** - Using "no-reply" sender with proper formatting  

---

**Last Updated**: April 5, 2026  
**Version**: 1.1.0
