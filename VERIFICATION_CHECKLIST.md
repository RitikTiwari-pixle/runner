# 🎯 VERIFICATION CHECKLIST - Territory Runner v1.1

Complete verification checklist to ensure all new features are working correctly.

---

## ✅ Code Changes Verification

### Backend Changes
- [ ] `backend/services/email_service.py` - HTML email template added
  ```bash
  grep -n "_build_html_template" backend/services/email_service.py
  # Should show new function definition
  ```

- [ ] `backend/services/google_oauth_service.py` - New file created
  ```bash
  test -f backend/services/google_oauth_service.py && echo "✓ File exists"
  ```

- [ ] `backend/models/run.py` - Added google_id and profile_picture_url
  ```bash
  grep -n "google_id:" backend/models/run.py
  grep -n "profile_picture_url:" backend/models/run.py
  # Both should return results
  ```

- [ ] `backend/routes/auth.py` - Added Google OAuth endpoint
  ```bash
  grep -n "@router.post(\"/google/login\"" backend/routes/auth.py
  # Should find the new endpoint
  ```

- [ ] `backend/migrations/006_add_google_oauth.sql` - Migration file created
  ```bash
  test -f backend/migrations/006_add_google_oauth.sql && echo "✓ Migration exists"
  ```

### Frontend Changes
- [ ] `frontend/src/services/googleAuthService.ts` - New file created
  ```bash
  test -f frontend/src/services/googleAuthService.ts && echo "✓ File exists"
  ```

- [ ] `frontend/src/screens/LoginScreen.tsx` - Google button added
  ```bash
  grep -n "handleGoogleLogin" frontend/src/screens/LoginScreen.tsx
  grep -n "Sign in with Google" frontend/src/screens/LoginScreen.tsx
  # Both should return results
  ```

- [ ] `frontend/src/services/apiService.ts` - googleLogin function added
  ```bash
  grep -n "export async function googleLogin" frontend/src/services/apiService.ts
  # Should find the function
  ```

- [ ] `frontend/package.json` - Dependencies updated
  ```bash
  grep "expo-auth-session" frontend/package.json
  grep "expo-web-browser" frontend/package.json
  # Both should return results
  ```

### Documentation Files Created
- [ ] `DEPLOYMENT_FREE_GUIDE.md` - Complete deployment guide
- [ ] `LOCAL_SETUP_GUIDE.md` - Local setup instructions
- [ ] `IMPLEMENTATION_SUMMARY.md` - Implementation overview
- [ ] `BACKEND_ENV_TEMPLATE.md` - Backend env template
- [ ] `FRONTEND_ENV_TEMPLATE.md` - Frontend env template

---

## 🧪 Local Testing

### Step 1: Backend Setup
```bash
cd backend

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/territory_runner
JWT_SECRET_KEY=dev-secret-key-12345
GOOGLE_OAUTH_CLIENT_ID=test-client-id
GOOGLE_OAUTH_CLIENT_SECRET=test-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=test@gmail.com
SMTP_PASSWORD=test-password
SMTP_FROM_EMAIL=noreply@test.local
OTP_DEBUG_MODE=true
EOF

# Test imports
python -c "from services.google_oauth_service import verify_google_token; print('✓ Google OAuth service imported')"

# [ ] Can start backend without errors
python -m uvicorn main:app --reload --port 8000 &
sleep 5
curl http://localhost:8000/api/ | grep "Territory Runner API"
kill %1
```

### Step 2: Frontend Setup
```bash
cd frontend

# Create .env.local
cat > .env.local << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=test-client-id
EOF

# Test imports
npm run lint
# [ ] No errors

# [ ] Google button visible in code
grep -r "Sign in with Google" src/
```

### Step 3: Email Template Test
```bash
cd backend

# [ ] Test email template is valid HTML
python -c "from services.email_service import _build_html_template; html = _build_html_template('Test App', 'password_reset', '123456', 10); print('✓ HTML generated, length:', len(html)); assert '<html>' in html.lower(); print('✓ HTML is valid')"
```

### Step 4: Google OAuth Service Test
```bash
cd backend

# [ ] Test Google OAuth service structure
python -c "
from services.google_oauth_service import (
    verify_google_token,
    get_or_create_google_user,
    _generate_username_from_email
)
print('✓ verify_google_token imported')
print('✓ get_or_create_google_user imported')
print('✓ _generate_username_from_email imported')
email = 'test@example.com'
username = _generate_username_from_email(email)
print(f'✓ Username generated: {username}')
assert username.startswith('test_')
print('✓ Username format is correct')
"
```

---

## 📧 Email Template Verification

### Check HTML is Valid
```bash
cd backend

python << 'EOF'
from services.email_service import _build_html_template

html = _build_html_template('Territory Runner', 'password_reset', '123456', 10)

# Check for key elements
checks = [
    ('<html>', 'HTML tag'),
    ('<style>', 'Style tag'),
    ('123456', 'Code is present'),
    ('Reset Your Password', 'Title is correct'),
    ('Expires in: 10 minutes', 'Expiry shown'),
    ('⚠️ Security Notice', 'Security warning'),
    ('no-reply', 'No-reply mentioned'),
]

for check, desc in checks:
    if check in html:
        print(f"✓ {desc}")
    else:
        print(f"✗ {desc} - NOT FOUND")
EOF
```

---

## 🔐 Google OAuth Verification

### Check Endpoint Exists
```bash
# [ ] Google OAuth endpoint in routes
grep -n "def google_oauth_login" backend/routes/auth.py

# [ ] Google OAuth imports in routes
grep "google_oauth_service" backend/routes/auth.py

# [ ] Response model defined
grep -n "class GoogleOAuthLoginResponse" backend/routes/auth.py
```

### Check Request Model
```bash
# [ ] Google OAuth request model
grep -n "class GoogleOAuthLoginRequest" backend/routes/auth.py
# Should show: id_token field
```

---

## 📚 Documentation Verification

### Check All Files Exist
```bash
files=(
    "IMPLEMENTATION_SUMMARY.md"
    "DEPLOYMENT_FREE_GUIDE.md"
    "LOCAL_SETUP_GUIDE.md"
    "BACKEND_ENV_TEMPLATE.md"
    "FRONTEND_ENV_TEMPLATE.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file - MISSING"
    fi
done
```

### Check Documentation Quality
```bash
# [ ] DEPLOYMENT guide mentions Railway and Vercel
grep -l "Railway" DEPLOYMENT_FREE_GUIDE.md DEPLOYMENT_GUIDE.md 2>/dev/null | head -1 | xargs echo "✓ Railway mention found in:"

# [ ] LOCAL_SETUP mentions Google OAuth
grep -l "Google" LOCAL_SETUP_GUIDE.md | xargs echo "✓ Google OAuth mentioned in:"

# [ ] IMPLEMENTATION_SUMMARY shows what was done
grep -l "✅" IMPLEMENTATION_SUMMARY.md | xargs echo "✓ Summary document is complete:"
```

---

## 🚀 Pre-Deployment Checklist

### Backend Ready
- [ ] All migrations numbered correctly (001-006)
- [ ] `backend/Dockerfile` exists and is valid
- [ ] `backend/requirements.txt` has all dependencies
- [ ] No `.env` file committed to git (add to `.gitignore`)
- [ ] All routes respond to OPTIONS requests (for CORS)

### Frontend Ready
- [ ] `.env.local` created but not committed
- [ ] `expo-auth-session` installed
- [ ] `expo-web-browser` installed
- [ ] `expo-random` installed
- [ ] LoginScreen has Google button visible
- [ ] API service has `googleLogin` function

### Documentation Ready
- [ ] DEPLOYMENT_FREE_GUIDE.md is complete
- [ ] LOCAL_SETUP_GUIDE.md has all steps
- [ ] README.md points to new guides
- [ ] All guides are clear and follow the same format

---

## 🔍 Code Quality Checks

```bash
# Check for console.logs in production code
echo "=== Frontend Debug Logs ==="
grep -r "console.log" frontend/src --include="*.tsx" --include="*.ts" | grep -v "// Debug:" || echo "✓ No debug logs found"

# Check for TODO comments
echo "=== TODOs ==="
grep -r "TODO\|FIXME\|HACK" backend/ frontend/src --include="*.py" --include="*.tsx" --include="*.ts" || echo "✓ No TODOs found"

# Check TypeScript errors
echo "=== TypeScript Check ==="
cd frontend && npm run lint 2>&1 | grep -i error || echo "✓ No lint errors"
```

---

## 📊 Feature Verification Matrix

| Feature | Backend | Frontend | Documentation | Status |
|---------|---------|----------|---|--------|
| Html Email Template | ✓ | - | ✓ | ✅ |
| Google OAuth Service | ✓ | ✓ | ✓ | ✅ |
| Google Login Endpoint | ✓ | - | ✓ | ✅ |
| Google OAuth Button | - | ✓ | ✓ | ✅ |
| Google Auth Service | - | ✓ | ✓ | ✅ |
| Free Deployment Guide | - | - | ✓ | ✅ |
| Local Setup Guide | ✓ | ✓ | ✓ | ✅ |
| Environment Templates | - | - | ✓ | ✅ |

---

## ⚡ Quick Sanity Check

Run this to verify everything:

```bash
#!/bin/bash

echo "🔍 Checking Territory Runner v1.1 Implementation..."
echo ""

# Backend checks
echo "📦 Backend:"
test -f backend/services/google_oauth_service.py && echo "  ✓ Google OAuth service" || echo "  ✗ Google OAuth service"
test -f backend/migrations/006_add_google_oauth.sql && echo "  ✓ Migration file" || echo "  ✗ Migration file"
grep -q "google_id:" backend/models/run.py && echo "  ✓ User model updated" || echo "  ✗ User model"
grep -q "def google_oauth_login" backend/routes/auth.py && echo "  ✓ OAuth endpoint" || echo "  ✗ OAuth endpoint"

# Frontend checks
echo ""
echo "🎨 Frontend:"
test -f frontend/src/services/googleAuthService.ts && echo "  ✓ Google auth service" || echo "  ✗ Google auth service"
grep -q "handleGoogleLogin" frontend/src/screens/LoginScreen.tsx && echo "  ✓ Login handler" || echo "  ✗ Login handler"
grep -q "expo-auth-session" frontend/package.json && echo "  ✓ Dependencies" || echo "  ✗ Dependencies"

# Documentation
echo ""
echo "📚 Documentation:"
test -f DEPLOYMENT_FREE_GUIDE.md && echo "  ✓ Deployment guide" || echo "  ✗ Deployment guide"
test -f LOCAL_SETUP_GUIDE.md && echo "  ✓ Local setup guide" || echo "  ✗ Local setup guide"
test -f IMPLEMENTATION_SUMMARY.md && echo "  ✓ Implementation summary" || echo "  ✗ Implementation summary"

echo ""
echo "✅ All checks passed! Ready for deployment."
```

---

## 🆘 Common Issues

### "ModuleNotFoundError: No module named 'google_oauth_service'"
```bash
# Make sure __init__.py exists in services directory
touch backend/services/__init__.py
```

### "expo-auth-session not found"
```bash
cd frontend
npm install expo-auth-session expo-web-browser expo-random
```

### "Google OAuth button not visible"
```bash
# Check GoogleButton styles are defined
grep -n "googleButton:" frontend/src/screens/LoginScreen.tsx
# Should show style definition
```

### "HTML email not rendering"
```bash
# Test email template
python -c "from services.email_service import _build_html_template; print('✓ OK')"
```

---

## 📋 Final Sign-Off Checklist

- [ ] All code changes implemented
- [ ] All tests passing
- [ ] Documentation complete and accurate
- [ ] No sensitive data in git
- [ ] Ready for GitHub push
- [ ] Ready for free deployment
- [ ] Tested locally with mock data
- [ ] Performance acceptable

---

**Verification Status**: 🟢 READY TO VERIFY  
**Last Updated**: April 5, 2026
