# Directive: Module 1 — Core GPS & Mapping Foundation

## Objective
Provide real-time GPS tracking with map visualization for runners. The system must survive background app switching (Spotify, WhatsApp) and screen lock on both iOS and Android.

## Inputs
- User's device location (GPS)
- User ID (from Firebase Auth)

## Tools / Scripts
- `frontend/src/services/locationService.ts` — Foreground + background GPS engine
- `frontend/src/hooks/useRunTracker.ts` — Run lifecycle state machine
- `frontend/src/utils/geo.ts` — Haversine distance, pace/duration formatters
- `frontend/src/utils/permissions.ts` — Location permission flow
- `backend/services/run_service.py` — Run business logic & metric computation
- `backend/routes/runs.py` — REST API endpoints

## Steps
1. App requests foreground, then background location permissions
2. User taps "Start Run" → backend creates run session, GPS tracking starts
3. GPS points stream into `locationService` buffer every 2s / 5m
4. Points rendered as polyline on map (`MapView.tsx`)
5. Metrics update live: duration ticks every 1s, distance on each GPS point, pace derived
6. Buffer batch-syncs to backend every 15s via `POST /runs/{id}/points`
7. When app backgrounded: Android foreground service + iOS background location keep tracking
8. User taps "Stop" → final buffer flush → `POST /runs/{id}/finish` computes final metrics

## Expected Output
- Run session stored in PostgreSQL with full GPS breadcrumbs
- PostGIS LineString route built from coordinates
- User's `total_distance_m` and `total_duration_s` aggregates updated

## Edge Cases & Notes
- **GPS jitter filter**: Only count distance if movement > 2m AND accuracy < 25m
- **Crash recovery**: Buffer persisted to AsyncStorage; recovered on next launch
- **Android battery optimization**: Foreground service with `killServiceOnDestroy: false`
- **iOS auto-pause prevention**: `pausesUpdatesAutomatically: false` + `activityType: Fitness`
- **Network drops**: Sync failures are logged but don't interrupt tracking; `finish` re-computes from stored points
- **API endpoint**: Batch uploads capped at 500 points per call
