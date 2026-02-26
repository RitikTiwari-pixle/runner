# Directive: Module 2 — Territory Gamification Logic

## Objective
Detect closed-loop running routes, calculate enclosed area, award territory to runners, and handle territory stealing with dispute notifications.

## Inputs
- Completed run with GPS breadcrumbs (from Module 1)
- Existing territories stored in PostGIS

## Tools / Scripts
- `backend/services/territory_service.py` — Core game engine
- `backend/routes/territories.py` — Territory & dispute API endpoints
- `frontend/src/components/TerritoryOverlay.tsx` — Map polygon renderer

## Steps
1. Run finishes → `finish_run` endpoint auto-calls `process_run_territory()`
2. GPS coords are analyzed for closed loops:
   - **Full closure**: start ≈ end within 50m → entire route becomes polygon
   - **Self-intersection**: route crosses itself → `polygonize()` extracts sub-loops
   - **No loops**: straight-line buffer (5m width) applied as penalty
3. Each polygon's area is computed using equirectangular projection (sqm)
4. Polygons < 100 sqm are discarded (GPS noise)
5. PostGIS `ST_Intersects` checks new polygon against all active territories
6. Overlapping territory is subtracted from previous owner, assigned to new runner
7. Dispute record created with `notified=False` for push notification
8. User's `total_territory_sqm` aggregate updated

## Expected Output
- `territories` table: new polygon rows with area
- `disputes` table: records for any stolen territory
- User stats updated in `users` table
- API response includes `territories_captured`, `territory_area_sqm`, `territories_stolen`

## Edge Cases & Notes
- **Tiny GPS loops**: Filtered by MIN_AREA_SQM = 100 sqm
- **Self-stealing**: Can't steal your own territory (filtered by owner_id check)
- **Partial overlap**: Existing territory is shrunk via `polygon.difference(intersection)`
- **Full overlap**: Existing territory deactivated (`is_active = False`)
- **Processing failure**: Wrapped in try/catch — run metrics still saved even if territory fails
- **Map bounding box**: `/territories/area` endpoint caps at 200 results to prevent map overload
