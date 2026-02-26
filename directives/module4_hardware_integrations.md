# Directive: Module 4 — Hardware & App Integrations

## Objective
Import running data from Garmin, Coros, and Strava into Territory Runner.
Import-only — we do NOT export data back to these platforms.

## Providers

### Strava
- **Auth**: OAuth 2.0 (standard flow)
- **Scopes**: `read, activity:read_all`
- **Import**: Activity list → filter runs → fetch GPS streams → create Run + RunPoints
- **Register**: https://www.strava.com/settings/api

### Garmin Connect
- **Auth**: OAuth 1.0a (requires authlib for HMAC-SHA1)
- **Import**: Pull-based + webhook push notifications
- **Data**: Activity samples with lat/lng/elevation/speed
- **Register**: https://developer.garmin.com/gc-developer-program/

### Coros
- **Auth**: OAuth 2.0
- **Import**: Sport list (filter mode 100/101/102 = running) → workout detail GPS
- **Register**: https://open.coros.com/

## Data Flow
1. User connects provider via OAuth (auth URL → callback → store tokens)
2. Tokens stored in `device_connections` table
3. On sync: fetch activities → filter runs only → check for duplicates → import
4. Each imported run gets `source='strava|garmin|coros'` and `external_id` set
5. GPS points imported into `run_points` table
6. User aggregate stats updated

## API Endpoints (14 total)
- 3 providers × (auth-url + callback + sync) = 9 endpoints
- 1 Garmin webhook handler
- 1 connection status check
- 1 disconnect endpoint
- Plus Strava callback, Coros callback

## Required Environment Variables
```
STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI
GARMIN_CONSUMER_KEY, GARMIN_CONSUMER_SECRET
COROS_CLIENT_ID, COROS_CLIENT_SECRET, COROS_REDIRECT_URI
```

## Notes
- Imported runs go through the same anti-cheat pipeline on territory processing
- All imported runs are marked with their source for provenance tracking
- Duplicate detection uses `external_id` + `source` to prevent re-imports
- Garmin requires a developer program application (may take weeks to approve)
