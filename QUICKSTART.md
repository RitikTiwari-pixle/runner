# Territory Runner - Quick Start Guide

Get the app running in 5 minutes!

## Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+ with PostGIS
- Expo Go app (on phone) OR Emulator

## Step 1: Clone & Setup Backend (Terminal 1)
```bash
# Start PostgreSQL (if using Docker)
docker run --name territory-runner-db \
  -e POSTGRES_DB=territory_runner \
  -e POSTGRES_PASSWORD=126542 \
  -p 5432:5432 \
  -d postgis/postgis:15-3.3

# Setup Python
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure .env (in root directory)
# DATABASE_URL=postgresql+asyncpg://postgres:126542@localhost:5432/territory_runner
# SKIP_AUTH=true  # For local testing
# OTP_DEBUG_MODE=true

# Run migrations
python migrate.py

# Start API server
uvicorn main:app --reload --port 8000
```

Backend is ready at: **http://localhost:8000**

## Step 2: Setup Frontend (Terminal 2)
```bash
cd frontend
npm install

# If using Android emulator:
# export EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api

# If using physical phone on same WiFi:
# Get your laptop IP: ipconfig (Windows) or ifconfig (Mac)
# export EXPO_PUBLIC_API_URL=http://192.168.X.X:8000/api

npm start
```

## Step 3: Run on Device
- **Expo Go (Easiest)**:
  - Install "Expo Go" app from your device's app store
  - Scan QR code from `npm start` output
  - App appears instantly!

- **Android Emulator**:
  ```bash
  npx expo run:android
  ```

- **iOS Simulator** (Mac only):
  ```bash
  npx expo run:ios
  ```

## Step 4: Test the App 🎉
1. Sign up: Use any email (e.g., `test@example.com`)
2. Set password: > 8 characters
3. Verify email: Check console or use OTP debug code
4. Grant location permissions
5. View home screen with profile stats
6. Try the map to start a run!

## Available Test Accounts
If `SKIP_AUTH=true`, you can use dev registration:
```bash
curl -X POST http://localhost:8000/api/auth/dev-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testrunner",
    "display_name": "Test Runner",
    "email": "test@example.com"
  }'
```

## Common Quick Fixes 🔧

**"Network Error" in app?**
- Check backend is running: http://localhost:8000
- Update `EXPO_PUBLIC_API_URL` with your laptop IP
- Restart Expo: Press `r` in terminal, then rescan QR

**Homepage won't load?**
- Tap the "Profile" (👤) tab at bottom
- Check Firebase/auth setup
- Look at console errors

**Database error?**
- Run migrations: `python backend/migrate.py`
- Check PostgreSQL: `psql -U postgres -d territory_runner`

**Can't send emails?**
- Set `OTP_DEBUG_MODE=true` in .env to see OTP in backend logs
- Verify SMTP settings for your email provider

## What's Running?
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Frontend: Expo Go on your device/emulator

## Next Steps
- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Check [/directives](/directives) for feature documentation
- Explore API at `http://localhost:8000/docs`

## Useful Commands

```bash
# Stop everything
Ctrl+C  # Backend terminal
Ctrl+C  # Frontend terminal

# Restart only frontend
# In terminal 2: npm start
# Press 'r' to reload

# Check database
psql -U postgres -d territory_runner
# \dt ← shows all tables
# SELECT COUNT(*) FROM users; ← check users

# Backend logs
# Terminal 1 shows all API calls in real-time

# Frontend logs
# Terminal 2 shows app console output
# Device/Emulator: shake phone to open menu → "View console logs"
```

## Database Seed (Optional)
Create test data:
```python
# In backend/clean_db.py, uncomment seed functions and run:
python clean_db.py
```

---

**Happy Running! 🏃💨**
