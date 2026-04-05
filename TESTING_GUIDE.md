# Testing Guide - Territory Runner Updates

**Estimated Time**: 30-45 minutes  
**Requirements**: Node.js, Python, device/emulator, WiFi  
**Objective**: Validate all new features before production deployment

---

## Phase 0: Environment Setup (5 min)

### Backend Setup
```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Should see: "Uvicorn running on http://0.0.0.0:8000"
```

### Frontend Setup
```bash
# Terminal 2: Navigate to frontend
cd frontend

# Check you have .env (or create it)
ls -la .env  # or dir .env on Windows

# If no .env, create it
echo "EXPO_PUBLIC_API_URL=http://localhost:8000/api" > .env

# Install dependencies
npm install
```

### Get Your Machine IP
```bash
# Windows - PowerShell
ipconfig | Select-String "IPv4"
# Output example: IPv4 Address. . . . . . . . . . . : 192.168.1.100

# Mac/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1
# Output example: inet 192.168.1.100
```

**Save your IP** - you'll need it for device testing.

---

## Phase 1: Code Verification (5 min)

### TypeScript Compilation Check
```bash
# Terminal 3: Verify no TypeScript errors
cd frontend
npx tsc --noEmit

# Expected: No output (silence = success)
# If errors: Will show file:line:col error details
```

### Visual Inspection
Check these files were modified:
```bash
# Check MapView dark mode
grep -n "settings.darkMode ? darkMapStyle" src/components/MapView.tsx
# Should output: line with customMapStyle={settings.darkMode...

# Check GlobalSettingsContext exists
ls -la src/context/GlobalSettingsContext.tsx
# Should exist

# Check distance units exist
ls -la src/utils/distanceUnits.ts
# Should exist

# Check background service exists
ls -la src/services/backgroundLocationService.ts
# Should exist
```

---

## Phase 2: Web Testing (10 min)

### Start Expo in Web Mode
```bash
# Terminal 4: Start Expo
cd frontend
npm start

# Press 'w' for web
# Browser should open: http://localhost:19006
```

### Test Dark Mode
```
✓ 1. Go to SettingsScreen (bottom tab)
✓ 2. Look for "Dark Mode" toggle
✓ 3. Tap toggle ON
✓ 4. Go to HomeScreen (top tab)  
✓ 5. MapView should appear darker
✓ 6. Go back to Settings
✓ 7. Tap toggle OFF
✓ 8. MapView should appear lighter
✓ Check: No errors in browser console
```

### Test Distance Units
```
✓ 1. Tap Settings icon
✓ 2. Look for distance unit display (might show "km" or "mi")
✓ 3. Tap the distance unit area
✓ 4. Should cycle: km → mi → m → ft → nm → km
✓ 5. Go to ProfileScreen
✓ 6. Check "Distance" stat shows new unit
   - If was "5.2 km", should now show "3.2 mi" (or other unit)
✓ 7. Check FeedScreen
   - Activity distances should show new unit
✓ Check: Numbers change appropriately for each unit
```

### Test Activity Feed Error Handling
```
✓ 1. Go to FeedScreen (bottom tab)
✓ 2. If tab shows "No activity" → Skip to browser console test
✓ 3. If errors appear → Good! Confirm error message visible
✓ 4. Look for "Try Again" button
✓ 5. Tap "Try Again" button
✓ 6. Should attempt to reload
✓ Check: No crashes, graceful error display
```

### Stop Web Testing
```bash
# Terminal 4: Press Ctrl+C to stop Expo
```

---

## Phase 3: Physical Device Testing (20 min)

### Prepare Device Setup
```bash
# 1. Get your machine IP (from Phase 0)
YOUR_IP=192.168.1.100  # Replace with actual IP

# 2. Update .env with correct URL
cat > frontend/.env << EOF
EXPO_PUBLIC_API_URL=http://$YOUR_IP:8000/api
EOF

# 3. Verify backend still running (Terminal 1)
# Check: Output shows "Uvicorn running on http://0.0.0.0:8000"

# 4. Make sure phone on SAME WiFi as computer
# Check: Phone settings → WiFi → same network as laptop
```

### Start Expo for Mobile
```bash
# Terminal 4: Start Expo
cd frontend
npm start

# You should see:
# Expo Go: https://expo.dev/go?qr=...
# [QR code appears]

# Keep this window open!
```

### Install Expo Go App
```
On your phone:
1. iOS: Open App Store → Search "Expo Go" → Install
2. Android: Open Play Store → Search "Expo Go" → Install
3. If already installed → Make sure it's latest version
```

### Connect Device to Dev Server
```
1. Unlock phone
2. Open Expo Go app
3. App shows scanner icon (bottom right)
4. Tap scanner icon
5. Point camera at QR code in Terminal 4
6. App loads your project
7. Wait 30-60 seconds for load
8. See HomeScreen with map
```

### Test Dark Mode on Device
```
✓ 1. Tap settings (gear icon, bottom right)
✓ 2. Scroll to find "Dark Mode" toggle
✓ 3. Toggle ON
✓ 4. Go back to home
✓ 5. Check: Map should be darker
✓ 6. Go back to settings
✓ 7. Toggle OFF
✓ 8. Check: Map should be lighter
✓ 9. Close and reopen app (kill and relaunch Expo Go)
✓ 10. Check: Dark mode setting persisted
```

### Test Distance Units on Device
```
✓ 1. Go to Settings
✓ 2. Find distance unit display (might show km)
✓ 3. Tap distance unit area repeatedly
✓ 4. Should cycle through: km → mi → m → ft → nm
✓ 5. Open ProfileScreen (if you have data)
✓ 6. Check distance stat:
     - Should match selected unit
     - Example: "5.2 km" → "3.2 mi" after changing
✓ 7. Check FeedScreen
✓ 8. Scroll to see any run entries
✓ 9. Distance should match selected unit
```

### Test Background GPS (if you have GPS enabled)
```
✓ 1. Go to Settings
✓ 2. Find "Background GPS" toggle
✓ 3. Tap toggle ON
✓ 4. Go to RunScreen (map)
✓ 5. Tap START RUN button
✓ 6. Check Terminal 4 (Expo log):
     - Should see: "[RunScreen] Background location tracking started"
✓ 7. Go to another app (leave Territory Runner)
✓ 8. GPS should continue tracking in background
✓ 9. Return to app
✓ 10. Tap STOP RUN
✓ 11. Check Terminal 4:
      - Should see: "[RunScreen] Background location tracking stopped"
```

### Test Connection (Critical for Physical Device)
```
✓ 1. Device is on app
✓ 2. Go to ProfileScreen or FeedScreen (needs API call)
✓ 3. Should load data successfully
✓ 4. If shows "Cannot connect to localhost":
     ✗ Problem: Check your .env has correct IP
     ✗ Fix: Kill Expo (Ctrl+C), update .env, restart npm start
✓ 5. If loads data:
     ✓ Success: Device can reach backend API
```

### Check Expo Console for Errors
```bash
# In Terminal 4 (where Expo is running):
- Look for any [red] errors
- Expected: Might see network requests, no errors
- If error found: Screenshot and report
- Common error: "Cannot reach $YOUR_IP:8000"
  → Fix: Check IP is correct in .env
```

---

## Phase 4: Validation Checklist

### Must-Pass Tests
- [ ] TypeScript compilation has no errors
- [ ] Dark mode toggle works on web
- [ ] Distance units cycle through 5 options on web
- [ ] Distance displays update when unit changes on web
- [ ] Device connects without "localhost" errors
- [ ] Dark mode persists after app restart
- [ ] Distance unit persists after app restart
- [ ] No crashes when toggling features

### Should-Pass Tests
- [ ] Activity feed shows error gracefully
- [ ] Retry button works in error state
- [ ] Background GPS lifecycle works (start/stop logs appear)
- [ ] Light mode colors visible in web version
- [ ] Settings changes update all screens

### Edge Cases (Test if Time Allows)
- [ ] Toggle dark mode rapidly (should not crash)
- [ ] Cycle through all 5 distance units rapidly
- [ ] Start/stop GPS multiple times
- [ ] Refresh feed repeatedly
- [ ] Change settings during active run

---

## Phase 5: Common Issues & Quick Fixes

### Issue: "Cannot connect to localhost:8000"
**Cause**: Phone trying to reach your computer's localhost  
**Fix**:
```bash
# 1. Get correct IP: ipconfig
# 2. Update .env:
echo "EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api" > frontend/.env

# 3. Restart Expo:
npm start

# 4. Rescan QR code in Expo Go
```

### Issue: "Dark mode toggle doesn't work"
**Cause**: MapView not reading settings  
**Fix**:
```bash
# 1. Check MapView imports GlobalSettingsContext
grep -A2 "import.*GlobalSettingsContext" src/components/MapView.tsx

# 2. If missing, file was not updated correctly
# 3. Restart Expo
```

### Issue: "Dark mode works but map always stays dark"
**Cause**: darkMapStyle always applied  
**Fix**:
```bash
# 1. Check MapView line has: customMapStyle={settings.darkMode ? ...
grep "customMapStyle" src/components/MapView.tsx

# 2. Should show conditional, not always darkMapStyle
# 3. If wrong, file needs update
```

### Issue: "Distance still shows km"
**Cause**: convertDistance not used in that screen  
**Fix**:
```bash
# 1. Find hardcoded "km" strings:
grep -rn "km" src/screens/SettingsScreen.tsx
grep -rn "km" src/screens/ProfileScreen.tsx

# 2. Replace with convertDistance
# 3. Add import: import { convertDistance } from '../utils/distanceUnits'
```

### Issue: "GPS toggles but doesn't log anything"
**Cause**: Background service not integrated or logs not visible  
**Fix**:
```bash
# 1. Check RunScreen has useEffect for background tracking
grep -A5 "useEffect.*backgroundGps" src/screens/RunScreen.tsx

# 2. Check Expo log is visible (Terminal 4 output)
# 3. Start run, look for "[RunScreen]" messages
# 4. If no messages, service may not be starting
```

### Issue: "App crashes on startup"
**Cause**: Error in GlobalSettingsProvider or imports  
**Fix**:
```bash
# 1. Check App.tsx wraps GlobalSettingsProvider correctly
grep -A5 "GlobalSettingsProvider" App.tsx

# 2. Run TypeScript check:
npx tsc --noEmit

# 3. Look for import errors
# 4. Check GlobalSettingsContext file exists:
ls -la src/context/GlobalSettingsContext.tsx
```

---

## Quick Sanity Checks (2 min)

Run these before declaring "ready to ship":

```bash
# 1. No TypeScript errors
npm run tsc --noEmit 2>&1 | head -20
# Expected: No output, or only warnings

# 2. All new files exist
ls -la src/context/GlobalSettingsContext.tsx
ls -la src/utils/distanceUnits.ts
ls -la src/services/backgroundLocationService.ts

# 3. No hardcoded "km" in modified files
grep -c " km" src/components/RunMetrics.tsx
# Expected: 0 or grep shows it in comments only

# 4. GlobalSettingsProvider in App.tsx
grep "GlobalSettingsProvider" App.tsx
# Expected: Should appear in output

# 5. Version check - make sure you're on branch
git status
# Expected: Should show modified files we updated
```

---

## Success Criteria

✅ **READY FOR PRODUCTION** if:
- All Phase 1-4 tests pass
- No TypeScript errors
- Device connects without errors
- Dark mode works and persists
- Distance units work and persist
- Activity feed handles errors gracefully
- No console errors in Expo log

⚠️ **NEEDS WORK** if:
- Device cannot connect
- Settings don't persist
- Any TypeScript errors
- Crashes on feature toggle
- Wrong values showing in UI

---

## Reporting Issues

If you find problems, include:
1. **Screenshot** of what you see
2. **Console error** (exact error message)
3. **Steps to reproduce** (what you did)
4. **Expected vs Actual** (what should happen vs what did)
5. **Device info** (iOS/Android, Expo Go version)

**Example issue report:**
```
Title: Dark mode toggle crashes app

Steps:
1. Go to Settings
2. Toggle dark mode ON
3. App crashes

Expected: Map changes to dark theme
Actual: App force closes

Error: TypeError: Cannot read properties of undefined (reading 'darkMode')

Device: Android 13, Expo Go v52.0.1
```

---

## After Testing

### If All Tests Pass ✅
```bash
# 1. Merge branch to main
git add .
git commit -m "feat: dark mode, distance units, background GPS"
git push origin main

# 2. Tag release
git tag -a v1.2.0 -m "Dark mode, distance units, background GPS integration"
git push origin v1.2.0

# 3. Build production
eas build --platform all
```

### If Issues Found ⚠️
```bash
# 1. Create bug report issue
# 2. Document exact steps to reproduce
# 3. Assign to developer
# 4. Wait for fix
# 5. Re-test fixed version
# 6. Only then push to main
```

---

**Document Version**: v1.0  
**Last Updated**: Current Session  
**Status**: Ready for QA Testing

