# OTP + Email Auth Setup Guide

## Complete Email OTP Configuration for Territory Runner

This guide covers setting up email-based OTP authentication for user registration and password reset.

## Quick Start

### 1. Database Migration
```bash
cd backend
python migrate.py
```

This creates:
- `email_otp_codes` table for storing OTP records
- `users.email` and `users.email_verified` columns
- `users.territory_color` for user customization

### 2. Environment Variables

Create/update your `.env` file in the project root:

```env
# ── JWT & OTP Security ──
JWT_SECRET_KEY=your-very-long-random-secret-key-here
OTP_SECRET_KEY=your-very-long-random-secret-key-here
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5

# ── SMTP Configuration (Gmail Example) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=no-reply@territoryrunner.local
SMTP_FROM_NAME=Territory Runner
APP_NAME=Territory Runner

# ── Debug Modes (Development Only) ──
OTP_DEBUG_MODE=false
SKIP_AUTH=false
```

## Email Provider Setup

### Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Click Security → Enable 2-Step Verification

2. **Generate App Password**
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Windows Computer"
   - Google will generate a 16-character password
   - Copy to `SMTP_PASSWORD` in .env

3. **Add to .env**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   SMTP_USE_TLS=true
   ```

### SendGrid (Recommended for Production)

1. **Create Account** at [sendgrid.com](https://sendgrid.com)

2. **Generate API Key**
   - Go to Settings > API Keys
   - Create "Restricted Access" key with "Mail Send" permission only
   - Copy the key

3. **Add to .env**
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USERNAME=apikey
   SMTP_PASSWORD=SG.your-actual-api-key-here
   SMTP_USE_TLS=true
   ```

### AWS SES

1. **Verify Domain** in AWS Simple Email Service console
2. **Get SMTP Credentials** from Account > SMTP Settings
3. **Add to .env**
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USERNAME=<from credentials>
   SMTP_PASSWORD=<from credentials>
   ```

## Development Testing

### Mode 1: Debug OTP (Fixed Code = "000000")
```env
OTP_DEBUG_MODE=true
```
All OTP requests return code "000000" for testing without real email setup.

### Mode 2: Full Skip (No Auth at All)
```env
SKIP_AUTH=true
```
Use for frontend-only development. Skip this for testing auth flows.

## Testing the OTP Flow

### Test 1: User Registration with OTP

```bash
# Step 1: Register user (generates OTP)
curl -X POST http://localhost:8000/api/auth/local/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "username": "testuser",
    "password": "password123",
    "display_name": "Test User",
    "city": "Mumbai",
    "state": "Maharashtra"
  }'

# Step 2: Verify OTP (check email or use "000000" if OTP_DEBUG_MODE=true)
curl -X POST http://localhost:8000/api/auth/local/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "otp_code": "000000",
    "purpose": "signup"
  }'
```

### Test 2: Password Reset Flow

```bash
# Step 1: Request password reset OTP
curl -X POST http://localhost:8000/api/auth/local/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com"
  }'

# Step 2: Verify OTP and set new password
curl -X POST http://localhost:8000/api/auth/local/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "otp_code": "000000",
    "purpose": "password_reset",
    "new_password": "newpassword123"
  }'
```

### Test 3: Resend OTP with Rate Limiting

```bash
# Request another OTP (rate limited: max 3/min, 5/hour)
curl -X POST http://localhost:8000/api/auth/local/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "purpose": "signup"
  }'
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "SMTP_HOST not configured" | Missing .env variable | Add SMTP_HOST, restart backend |
| "Connection refused" | Wrong host/port | Check SMTP provider's port (587 or 465) |
| "Authentication failed" | Wrong credentials | Verify SMTP_USERNAME and SMTP_PASSWORD |
| "530 - Unauthorized" | Invalid Gmail app password | Generate new app password (not main password) |
| No emails received | SMTP not connected | Test with `telnet smtp.gmail.com 587` |
| OTP expires immediately | Clock skew | Sync server and database time (use UTC) |
| Too many resend attempts | Rate limiting | Wait 1 minute before resending |

## Rate Limiting

OTP resend requests are rate-limited:
- **Per minute**: Max 3 requests
- **Per hour**: Max 5 requests

This prevents spamming and brute-force attacks.

## Security Checklist

- [ ] `JWT_SECRET_KEY` is 32+ characters, random
- [ ] `OTP_SECRET_KEY` is 32+ characters, random  
- [ ] `OTP_DEBUG_MODE=false` in production
- [ ] `SKIP_AUTH=false` in production
- [ ] `.env` is in `.gitignore` (never commit secrets)
- [ ] SMTP credentials use app-specific passwords (not main passwords)
- [ ] SMTP_USE_TLS=true (never plain-text SMTP)
- [ ] HTTPS is enabled on all endpoints
- [ ] Test signup and password reset end-to-end

## Monitoring

Track these metrics:
- OTP delivery success rate (should be >99%)
- Failed OTP verification attempts
- Password reset completion rate

Check logs:
```bash
# View OTP sends and failures
docker logs <backend-container> | grep "\[Email\] OTP"

# View auth events
docker logs <backend-container> | grep "\[Auth\]"
```

## Next Steps

After setup:
1. Test the complete auth flow in the mobile app
2. Configure email domain branding (SMTP_FROM_NAME)
3. Set up monitoring/alerts for email delivery
4. Document support procedures for password resets

---

For more info, see [README.md](../README.md) or check [DEPLOYMENT.md](../DEPLOYMENT.md).
