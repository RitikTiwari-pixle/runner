# 🚀 FREE DEPLOYMENT GUIDE - TERRITORY RUNNER

Complete step-by-step guide to deploy Territory Runner for FREE using Railway (backend), Vercel (frontend), and Railway PostgreSQL.

---

## Table of Contents
1. [Google OAuth Setup](#google-oauth-setup)
2. [Database Setup (Railway PostgreSQL)](#database-setup)
3. [Backend Deployment (Railway)](#backend-deployment)
4. [Frontend Deployment (Vercel)](#frontend-deployment)
5. [Testing & Debugging](#testing--debugging)
6. [Important Notes](#important-notes)

---

## 1. Google OAuth Setup

### Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account
   - Click "Select a Project" → "NEW PROJECT"
   - Name: `Territory Runner`
   - Click "CREATE"

2. **Enable Google+ API**
   - In the left sidebar, click "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click it and press "ENABLE"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, click "Configure Consent Screen" first
   - For Consent Screen:
     - User Type: "External"
     - Click "CREATE"
     - Fill required fields (App name, User support email, Developer contact)
     - Click "SAVE AND CONTINUE"
     - Skip optional scopes → "SAVE AND CONTINUE"
     - Skip optional test users → "SAVE AND CONTINUE"
   - Back to Credentials creation:
     - Application Type: **"Web application"**
     - Name: `Territory Runner Web`
     - Under "Authorized redirect URIs", add:
       ```
       http://localhost:3000
       http://localhost:8081
       https://yourdomain.com
       https://yourdomain.vercel.app
       https://yourdomain.expo.dev
       ```
     - Click "CREATE"

4. **Copy Credentials**
   - You'll see a popup with your credentials
   - From this popup:
     - Copy: **Client ID** → save as `GOOGLE_OAUTH_CLIENT_ID`
     - Copy: **Client Secret** → save as `GOOGLE_OAUTH_CLIENT_SECRET`
   - ⚠️ **KEEP THESE SECRET** - Never commit to git

### For Mobile (iOS/Android)

If you want to add native mobile support later:
1. Create separate OAuth credentials for "iOS" and "Android" in Google Cloud Console
2. Update `app.json` in frontend with iOS/Android client IDs

---

## 2. Database Setup (Railway PostgreSQL)

### Create Railway Account & Database

1. **Go to Railway.app**
   - Visit: https://railway.app
   - Click "Start a New Project"
   - Sign up with GitHub (easiest)

2. **Create PostgreSQL Database**
   - Click "New Project" → "Provision PostgreSQL"
   - Select region closest to you
   - Railway will create a free PostgreSQL database

3. **Get Database URL**
   - Go to your PostgreSQL plugin
   - Click "Connect"
   - Copy the connection string:
     ```
     postgresql://username:password@host:port/database
     ```
   - Save this - you'll need it for backend deployment
   - Convert to async format for backend:
     ```
     postgresql+asyncpg://username:password@host:port/database
     ```

### Run Initial Migrations

We'll do this after deploying the backend.

---

## 3. Backend Deployment (Railway)

### Prepare Backend for Deployment

1. **Update Backend Config**
   - Open `backend/requirements.txt` - verify it has all dependencies
   - Check file `backend/Dockerfile` exists
   - If not, create `backend/Dockerfile`:

```dockerfile
# Use Python 3.13 slim image
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Run migrations
RUN python migrate.py

# Expose port
EXPOSE 8000

# Run with gunicorn
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "120"]
```

2. **Create .env file for Backend**
   - In `backend/.env`:
   ```env
   DATABASE_URL=postgresql+asyncpg://username:password@your-railway-host:5432/database
   JWT_SECRET_KEY=your-super-secret-key-generate-random-string
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM_EMAIL=noreply@territoryrunner.com
   SMTP_FROM_NAME=Territory Runner
   GOOGLE_OAUTH_CLIENT_ID=your-client-id
   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
   APP_NAME=Territory Runner
   ```

### Deploy to Railway

1. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/territory-runner.git
   git branch -M main
   git push -u origin main
   ```

2. **Connect Railway to GitHub**
   - In Railway: "New Project" → "Deploy from GitHub repo"
   - Select repository: `territory-runner`
   - Railway will auto-detect the setup

3. **Configure Railway Service**
   - Click "Settings"
   - Set "Root Directory": `backend`
   - Set "Start Command": 
     ```
     gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
     ```

4. **Add Environment Variables to Railway**
   - In Railway dashboard, click on your backend service
   - Go to "Variables"
   - Add all the environment variables from `.env` file above
   - ⚠️ **IMPORTANT**: Do NOT commit `.env` to git, only add to Railway dashboard

5. **Deploy**
   - Railway will auto-deploy on git push
   - Wait for build to complete (5-10 minutes)
   - You'll get a railway.app URL like: `https://territory-runner-production.up.railway.app`

6. **Verify Backend is Running**
   ```bash
   curl https://your-railway-backend-url/api/
   ```
   Should return: `{"message": "Welcome to the Territory Runner API!"}`

---

## 4. Frontend Deployment (Vercel)

### Prepare Frontend for Deployment

1. **Update Frontend Config**
   - Open `frontend/app.json`:
   ```json
   {
     "expo": {
       "name": "Territory Runner",
       "slug": "territory-runner",
       "version": "1.0.0",
       "assetBundlePatterns": ["**/*"],
       "plugins": [
         [
           "expo-build-properties",
           {
             "ios": {
               "deploymentTarget": "13.0"
             },
             "android": {
               "targetSdkVersion": 34,
               "compileSdkVersion": 34
             }
           }
         ]
       ]
     }
   }
   ```

2. **Create Next.js Export (for Vercel)**
   - Create `frontend/next.config.js`:
   ```js
   module.exports = {
     reactStrictMode: true,
     webpack: (config) => {
       return config;
     },
   };
   ```

3. **Create Vercel Config**
   - Create `vercel.json` in root:
   ```json
   {
     "buildCommand": "cd frontend && npm install && npm run build",
     "outputDirectory": "frontend/.next",
     "installCommand": "cd frontend && npm install"
   }
   ```

### Deploy to Vercel

1. **Connect GitHub to Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - Select repository: `territory-runner`

2. **Configure Vercel Build Settings**
   - Framework Preset: "React" (or "Next.js" if using next)
   - Root Directory: `./frontend`
   - Build Command: `npm run build` (or your build script)
   - Output Directory: `.next` or `build`

3. **Add Environment Variables to Vercel**
   - In Vercel dashboard, go to "Settings" → "Environment Variables"
   - Add:
   ```
   EXPO_PUBLIC_API_URL=https://your-railway-backend-url
   EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your-google-web-client-id
   EXPO_PUBLIC_APP_NAME=Territory Runner
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - You'll get a URL like: `https://territory-runner.vercel.app`

### Configure CORS for Frontend

In your backend `main.py`, the CORS is already set to `allow_origin_regex=".*"` which allows all origins. For production, update it:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://territory-runner.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 5. Testing & Debugging

### Test Email Functionality

1. **Gmail App Password Setup**
   - Go to: https://myaccount.google.com/apppasswords
   - Select: "Mail" and "Windows Computer"
   - Copy the 16-character password
   - Use as `SMTP_PASSWORD` in backend environment

2. **Send Test Email**
   ```bash
   cd backend
   python test_email_setup.py
   ```

### Test Google OAuth

1. **Test in Browser**
   - Go to your frontend URL: `https://territory-runner.vercel.app`
   - Click "Sign in with Google"
   - Verify you can see the Google login popup

2. **Test Backend**
   ```bash
   curl -X POST https://your-railway-url/api/auth/google/login \
     -H "Content-Type: application/json" \
     -d '{"id_token":"your-test-id-token"}'
   ```

### Enable Debug Logging

In backend `.env`:
```env
DEBUG=true
LOG_LEVEL=DEBUG
```

---

## 6. Important Notes

### Free Tier Limits

- **Railway**: 5GB storage, 30GB bandwidth/month (check current limits)
- **Vercel**: 100GB bandwidth/month, unlimited deployments
- **PostgreSQL**: Usually included free with Railway

### Cost Optimization

- Use Railway's shared pool (cheaper than dedicated)
- Enable auto-scaling only when needed
- Monitor bandwidth usage in both services

### Security Best Practices

1. **Never commit `.env` files** - use `.gitignore`
2. **Rotate secrets regularly** - especially OAuth credentials
3. **Use HTTPS everywhere** - both services provide free SSL
4. **Validate all inputs** - both frontend and backend
5. **Set strong passwords** - for database and OAuth

### Custom Domain Setup

1. **Add Domain to Vercel**
   - In Vercel dashboard → Settings → Domains
   - Add your custom domain
   - Follow DNS configuration steps

2. **Add Domain to Railway**
   - In Railway dashboard → Settings → Domains
   - Add your custom domain

### Troubleshooting

**Backend not connecting:**
- Check DATABASE_URL is correct
- Verify OAuth credentials are set
- Check Railway logs: `railway logs`

**Frontend not loading:**
- Check EXPO_PUBLIC_API_URL is correct
- Verify Google OAuth client ID is valid
- Check Vercel logs in dashboard

**Email not sending:**
- Verify Gmail app password is correct
- Check SMTP settings are accurate
- Review backend email service logs

---

## 📱 Mobile App Distribution

For Android/iOS apps, you'll need:
- **Google Play**: $25 one-time developer fee + App signing setup
- **Apple App Store**: $99/year developer account + provisioning profiles

See `OTP_EMAIL_SETUP.md` and `EXPO_SETUP.md` for detailed mobile setup.

---

## 🎉 You're Live!

Your app is now deployed and accessible globally!

- **Frontend**: https://territory-runner.vercel.app
- **Backend API**: https://your-backend-url/api
- **Share link**: Send `https://territory-runner.vercel.app` to users

---

**Last Updated**: April 5, 2026
**Maintained by**: Territory Runner Team
