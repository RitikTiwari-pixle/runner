# 🚨 IMMEDIATE FIX: Step-by-Step Connection Resolution

## Current Issue
- Login fails: Can't connect to backend
- Using malformed IP: `10.2.05.254.43` (invalid format)
- Want simultaneous web + phone testing
- Need free deployment

---

## ⚡ QUICK FIX (5 minutes)

### Step 1: Get Your CORRECT IP Address

**Open PowerShell and run:**
```powershell
ipconfig | Select-String "IPv4" | Select-String -NotMatch "127.0.0.1"
```

**You'll see output like:**
```
IPv4 Address. . . . . . . . . . . : 192.168.1.100
```
or
```
IPv4 Address. . . . . . . . . . . : 10.2.5.254
```

⚠️ **YOUR CURRENT IP IS WRONG**: `10.2.05.254.43`
- `.05` is invalid (leading zero)
- Should be: `10.2.5.254` or `192.168.x.x`

**COPY YOUR CORRECT IP** (example: `192.168.1.100`)

### Step 2: Fix .env File

**In VS Code:**
1. Open: `frontend/.env`
2. Delete: `EXPO_PUBLIC_API_URL=http://10.2.05.254.43:8000/api`
3. Replace with: `EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api`
   (Use YOUR IP from Step 1)

**File should look like:**
```
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
```

**Save file** (Ctrl+S)

### Step 3: Restart Everything

**In Terminal:**
```bash
# If Expo running, press Ctrl+C to stop it

# Restart backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# In NEW terminal, restart Expo
cd frontend
npm start
# Press 'a' for Android, 'i' for iOS, or 'w' for web
```

### Step 4: Test Login

On phone or Expo Go:
1. Go to Login screen
2. Enter username: `admin` (or any test account)
3. Enter password: `password123` (8+ chars)
4. Tap Login button
5. Should work! ✅

---

## 🔍 Use Diagnostic Screen (If Still Failing)

### Add Diagnostic Component

**Option 1: Add to SettingsScreen (Temporary)**

Open `frontend/src/screens/SettingsScreen.tsx`:
```typescript
import DiagnosticScreen from './DiagnosticScreen'; // Add import

// At bottom of file, add this button:
<TouchableOpacity 
  style={{backgroundColor: '#FF6B6B', padding: 16, borderRadius: 8, marginTop: 16}}
  onPress={() => {
    // Temporarily show diagnostic
    console.log('[DEBUG] Show diagnostic screen');
  }}
>
  <Text style={{color: '#FFFFFF', textAlign: 'center', fontWeight: 'bold'}}>
    🔧 Test Connection
  </Text>
</TouchableOpacity>
```

**Option 2: Add Tab to Navigation (Better)**

Open `frontend/src/navigation/MainTabNavigator.tsx`:
```typescript
import DiagnosticScreen from '../screens/DiagnosticScreen'; // Add import

// In TabNavigator, add new tab:
<Tab.Screen 
  name="Diagnostic" 
  component={DiagnosticScreen} 
  options={{
    tabBarLabel: 'Diagnostic',
    tabBarIcon: ({ color }) => <Text style={{fontSize: 20}}>🔧</Text>,
  }}
/>
```

### Check Diagnostic Output

1. Open app
2. Tap "Diagnostic" tab (or run test)
3. Look for:
   - ✅ API URL showing correct IP
   - ✅ Backend Reachability: "Backend is reachable"
4. Take screenshot and share if problems

---

## 📱 Run Web + Phone SIMULTANEOUSLY

### Setup 1: Two Expo Instances (BEST)

**Terminal 1: Backend**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2: Phone Expo (LAN Mode)**
```bash
cd frontend
set EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
npm start
# Press 'a' or 'i' for phone
# Scan QR code in Expo Go app
```

**Terminal 3: Web Expo (Localhost)**
```bash
cd frontend
set EXPO_PUBLIC_API_URL=http://localhost:8000/api
npm start -- --web
# Browser opens automatically at http://localhost:19006
```

**Result**: Both running at same time ✅

### Setup 2: Single Expo (Automatic Rewrit)

**Terminal 1: Backend**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2: Expo (Handles Both)**
```bash
cd frontend
set EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
npm start
# Press 'w' for web (auto-rewrites to localhost)
# Press 'a' or 'i' for phone
# Press 'w' again to switch back to web
```

**Result**: Share single QR code, can switch between web/phone ✅

---

## 🆓 Free Deployment (Total Cost: $0)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub (FREE - Code)                  │
│                   github.com/youruser/runner             │
└─────────────────────────────────────────────────────────┘
         ↓                                          ↓
    Frontend                                     Backend
    (React Native)                           (Python FastAPI)
         ↓                                          ↓
    ┌─────────────────┐                 ┌──────────────────────┐
    │ Vercel (FREE)   │                 │ Railway (FREE)       │
    │ yoursite.vercel │   ←API Calls→   │ api-xxx.railway.app  │
    │                 │                 │                      │
    │ • Unlimited     │                 │ • 500 hours/month    │
    │   deployments   │                 │ • Auto-deploys       │
    │ • Custom domain │                 │ • Built-in DB        │
    │ • Instant HTTPS │                 │ • Free SSL           │
    └─────────────────┘                 └──────────────────────┘
                                               ↓
                                    ┌──────────────────────┐
                                    │ Railway PostgreSQL   │
                                    │ (FREE - Included)    │
                                    │ 5GB free database    │
                                    └──────────────────────┘
```

### Step 1: Push to GitHub

```bash
# Create GitHub account at github.com
# Click '+' → New repository → 'runner'
# Don't initialize (we have code already)

# In your local runner/ folder:
git init
git add .
git commit -m "Initial commit: Territory Runner"
git branch -M main
git remote add origin https://github.com/youruser/runner.git
git push -u origin main
```

### Step 2: Deploy Frontend to Vercel

```bash
# Visit: vercel.com
# Click "Import Project"
# Connect GitHub account
# Select your 'runner' repo
# Framework: React Native Expo
# Root Directory: ./frontend
# Build Command: npm run build (or leave default)
# Click Deploy

# Wait 2-5 minutes
# Get URL: https://yoursite.vercel.app
```

### Step 3: Deploy Backend to Railway

Go to **railway.app**:

1. Click "New Project"
2. "Deploy from GitHub"
3. Select your repository
4. Select root directory: `.`
5. Add environment variables:
```
DATABASE_URL=postgresql://user:pass@localhost/runner
HOST=0.0.0.0
PORT=8000
```
6. Start command:
```
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```
7. Click Deploy
8. Wait 3-5 minutes
9. Get URL: `https://api-xxx.up.railway.app`

### Step 4: Update Frontend to Use Deployed Backend

**In `frontend/.env`:**
```
EXPO_PUBLIC_API_URL=https://api-xxx.up.railway.app/api
```

**Redeploy Frontend:**
```bash
cd frontend
# Just push to GitHub, Vercel auto-deploys
git add .env
git commit -m "Update API URL to production"
git push origin main
```

### Result

```
✅ Frontend: https://yoursite.vercel.app
✅ Backend: https://api-xxx.up.railway.app
✅ Database: PostgreSQL on Railway (included FREE)
✅ SSL/HTTPS: Automatic
✅ Custom Domain: Free with namecheap.com or freenom.com
✅ Monthly Cost: $0
```

---

## ✅ Verification Checklist

### Before Attempting Login
- [ ] Correct IP from `ipconfig` (no leading zeros: 192.168.x.x or 10.0.0.x)
- [ ] .env file updated with correct IP
- [ ] Backend running: Shows "Uvicorn running on http://0.0.0.0:8000"
- [ ] Firewall allows port 8000 (Windows Defender checked)
- [ ] Expo restarted after .env change
- [ ] Console shows correct API URL when app loads

### Login Attempt
- [ ] Type valid email/username (minimum 3 chars)
- [ ] Type valid password (minimum 8 chars)
- [ ] Wait 3-5 seconds for server response
- [ ] Don't spam click button
- [ ] Check console for error message

### If Still Failing
- [ ] Run Diagnostic Screen (see "Use Diagnostic Screen" above)
- [ ] Check backend terminal for error messages
- [ ] Check Expo terminal for error messages
- [ ] Verify phone on same WiFi as computer
- [ ] Try with test credentials first

---

## 🐛 Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED: Connection refused` | Backend not running | Run: `python -m uvicorn main:app --host 0.0.0.0 --port 8000` |
| `ENOTFOUND: getaddrinfo ENOTFOUND` | Invalid IP address | Run `ipconfig`, check for leading zeros |
| `timeout` | Firewall blocking | Allow Python through Windows Defender |
| `Network Error with 0 code` | CORS issue or network down | Check backend is up, check WiFi |
| `401 Unauthorized` | Wrong credentials | Sign up first, or use correct password |
| `Connection refused on 10.2.05.254.43` | IP format wrong | Fix to 192.168.1.100 (no .05, no .43) |

---

## 🎯 EXACT SEQUENCE TO FOLLOW NOW

**Do this exactly:**

```bash
# 1. Get correct IP
ipconfig | Select-String "IPv4"
# Copy output

# 2. Edit .env
notepad frontend\.env
# File → Save As if needed
# Replace URL with correct IP

# 3. Open 3 terminals

# Terminal 1:
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2:
cd frontend
set EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
npm start
# Press 'w' for web test first
# Then press 'a' or 'i' for phone

# Terminal 3:
cd frontend
npm start -- --web
# This is optional if you want separate web server
```

**Then test login in Expo Go app on phone or browser**

---

## 📞 If You're Still Stuck

Share these with me:

```bash
# 1. Your IP address from ipconfig:
ipconfig | Select-String "IPv4"

# 2. Your .env file:
type frontend\.env

# 3. Console output when app starts:
# (Screenshot of Terminal 2/3 output)

# 4. Error message from login attempt:
# (Screenshot of app error)

# 5. Check if backend responds:
# In PowerShell:
Invoke-WebRequest -Uri "http://192.168.1.100:8000/api" -TimeoutSec 5
```

---

## 🚀 Once Everything Works

1. **Test on Web**: `http://localhost:19006`
2. **Test on Phone**: Expo Go app
3. **Both should login successfully**
4. **Then deploy** (follow "Free Deployment" section)
5. **Update .env** to production URL
6. **Test on production**

---

**Status**: Follow the "Quick Fix" section (5 minutes). If still stuck, run through "Verification Checklist".

**Next**: Once login works, deploy using "Free Deployment" section.

Good luck! 🎉

