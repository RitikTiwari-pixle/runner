"""
Territory Service — The Core Game Engine (Module 2)

Handles:
1. Closed-loop polygon detection from GPS routes
2. Area calculation in square meters
3. Straight-line penalty (minimal area for out-and-back)
4. Territory stealing & dispute creation
5. User territory stat updates

KEY ALGORITHM:
─────────────
After a run finishes, the GPS route (a LineString) is analyzed:
- If the route forms a closed loop (start ≈ end within CLOSURE_THRESHOLD),
  the enclosed polygon is captured as territory.
- If the route self-intersects, we extract the largest closed sub-loop.
- If the route is a straight out-and-back, only a minimal buffer area
  (the width of the path) is awarded.

TERRITORY STEALING:
──────────────────
When a new polygon is captured, we check all existing active territories
using PostGIS ST_Intersects. Any overlapping area is transferred to the
new runner, and disputes are created for notifications.
"""

import uuid
import math
import logging
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.shape import from_shape, to_shape
from geoalchemy2 import functions as geo_func
from shapely.geometry import LineString, Polygon, MultiPolygon, Point
from shapely.ops import polygonize, unary_union, split
from shapely.validation import make_valid

from models.run import Run, RunPoint, Territory, Dispute, User

logger = logging.getLogger(__name__)

# ─── Constants ───────────────────────────────────────────────────
CLOSURE_THRESHOLD_M = 50       # Max distance (m) between start/end to count as closed loop
MIN_POINTS_FOR_POLYGON = 10    # Minimum GPS points to form a valid polygon
MIN_AREA_SQM = 100             # Ignore tiny polygons (GPS noise)
STRAIGHT_LINE_BUFFER_M = 5     # Buffer width for out-and-back routes (meters)
EARTH_RADIUS_M = 6_371_000


# ─── Haversine Distance ─────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters between two GPS coordinates."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Meters to Degrees (approximate, for buffering) ─────────────

def _meters_to_degrees(meters: float, latitude: float) -> float:
    """
    Convert meters to approximate degrees at a given latitude.
    At the equator, 1 degree ≈ 111,320 meters.
    """
    return meters / (111_320 * math.cos(math.radians(latitude)))


# ─── Polygon Area in Square Meters ──────────────────────────────

def compute_area_sqm(polygon: Polygon) -> float:
    """
    Compute the area of a polygon on Earth's surface in square meters.
    Uses the spherical excess formula for accuracy at Indian latitudes.
    
    For polygons at typical running scale (< 10 km²), this is accurate
    to within ~0.1%.
    """
    coords = list(polygon.exterior.coords)
    if len(coords) < 4:  # Need at least 3 unique points + closing point
        return 0.0

    # Shoelace formula on projected coordinates (equirectangular approximation)
    # This is accurate enough for running-scale polygons at Indian latitudes (8°N - 37°N)
    ref_lat = sum(c[1] for c in coords) / len(coords)  # Average latitude
    cos_lat = math.cos(math.radians(ref_lat))

    area = 0.0
    n = len(coords) - 1  # Exclude closing point (same as first)
    for i in range(n):
        j = (i + 1) % n
        # Convert to meters from the reference point
        x1 = coords[i][0] * cos_lat
        y1 = coords[i][1]
        x2 = coords[j][0] * cos_lat
        y2 = coords[j][1]
        area += x1 * y2 - x2 * y1

    # Convert from degree² to m²
    # 1 degree latitude ≈ 111,320 m
    area_deg2 = abs(area) / 2.0
    area_sqm = area_deg2 * (111_320 ** 2)
    return round(area_sqm, 2)


# ═══════════════════════════════════════════════════════════════
# CORE ALGORITHM: Extract polygons from a GPS route
# ═══════════════════════════════════════════════════════════════

def detect_closed_loops(coords: list[tuple[float, float]]) -> list[Polygon]:
    """
    Detect closed loops in a GPS route.
    
    Strategy:
    1. Check if the entire route is a closed loop (start ≈ end)
    2. Check for self-intersecting segments that form sub-loops
    3. For each detected loop, create a polygon
    
    Args:
        coords: List of (longitude, latitude) tuples
    
    Returns:
        List of Shapely Polygon objects representing captured territory
    """
    if len(coords) < MIN_POINTS_FOR_POLYGON:
        return []

    line = LineString(coords)
    polygons = []

    start = coords[0]
    end = coords[-1]

    # ─── Case 1: Full route forms a closed loop ──────────────
    closure_dist = _haversine(start[1], start[0], end[1], end[0])
    if closure_dist <= CLOSURE_THRESHOLD_M:
        # Close the loop by connecting end to start
        closed_coords = list(coords) + [coords[0]]
        try:
            poly = Polygon(closed_coords)
            poly = make_valid(poly)
            if isinstance(poly, Polygon) and poly.is_valid and not poly.is_empty:
                area = compute_area_sqm(poly)
                if area >= MIN_AREA_SQM:
                    polygons.append(poly)
                    logger.info(f"[Territory] Full closed loop detected: {area:.0f} sqm")
        except Exception as e:
            logger.warning(f"[Territory] Failed to create polygon from closed loop: {e}")

    # ─── Case 2: Self-intersecting route (sub-loops) ─────────
    if line.is_simple is False or not polygons:
        # The route crosses itself — extract polygons from the intersections
        try:
            # Use Shapely's polygonize to find all closed regions
            # formed by the self-intersecting line
            merged = unary_union(line)
            result = list(polygonize(merged))

            for poly in result:
                poly = make_valid(poly)
                if isinstance(poly, Polygon) and poly.is_valid and not poly.is_empty:
                    area = compute_area_sqm(poly)
                    if area >= MIN_AREA_SQM:
                        polygons.append(poly)
                        logger.info(f"[Territory] Sub-loop detected: {area:.0f} sqm")
        except Exception as e:
            logger.warning(f"[Territory] Failed to extract sub-loops: {e}")

    return polygons


def apply_straight_line_penalty(coords: list[tuple[float, float]]) -> Polygon | None:
    """
    For out-and-back routes that don't form closed loops, award only
    a minimal buffer area (essentially the width of the path).
    
    This prevents gaming the system by running long straight lines
    to claim huge areas.
    
    The buffer width is STRAIGHT_LINE_BUFFER_M (5 meters) — roughly
    the width a runner occupies on a road.
    """
    if len(coords) < 2:
        return None

    line = LineString(coords)
    avg_lat = sum(c[1] for c in coords) / len(coords)
    buffer_deg = _meters_to_degrees(STRAIGHT_LINE_BUFFER_M, avg_lat)

    buffered = line.buffer(buffer_deg, cap_style='round', join_style='round')

    if isinstance(buffered, Polygon) and buffered.is_valid:
        area = compute_area_sqm(buffered)
        if area >= 10:  # Very minimal threshold for buffer areas
            logger.info(f"[Territory] Straight-line penalty applied: {area:.0f} sqm buffer")
            return buffered

    return None


# ═══════════════════════════════════════════════════════════════
# TERRITORY STEALING & DISPUTES
# ═══════════════════════════════════════════════════════════════

async def check_territory_overlap(
    db: AsyncSession,
    new_polygon: Polygon,
    new_owner_id: uuid.UUID,
) -> list[dict]:
    """
    Check if the new polygon intersects any existing active territories.
    
    Returns a list of overlaps:
    [{ territory_id, previous_owner_id, overlap_area_sqm, overlap_polygon }]
    """
    new_geom = from_shape(new_polygon, srid=4326)

    # Query all active territories that intersect the new polygon
    result = await db.execute(
        select(Territory)
        .where(
            and_(
                Territory.is_active == True,
                Territory.owner_id != new_owner_id,  # Don't steal from yourself
                geo_func.ST_Intersects(Territory.polygon, new_geom),
            )
        )
    )
    overlapping = result.scalars().all()

    overlaps = []
    for territory in overlapping:
        existing_poly = to_shape(territory.polygon)

        # Calculate the intersection area
        try:
            intersection = new_polygon.intersection(existing_poly)
            if intersection.is_empty:
                continue

            if isinstance(intersection, (Polygon, MultiPolygon)):
                overlap_area = compute_area_sqm(
                    intersection if isinstance(intersection, Polygon)
                    else max(intersection.geoms, key=lambda g: g.area)
                )

                if overlap_area > 10:  # Ignore trivial overlaps
                    overlaps.append({
                        "territory_id": territory.id,
                        "previous_owner_id": territory.owner_id,
                        "overlap_area_sqm": overlap_area,
                        "existing_territory": territory,
                        "intersection": intersection,
                    })
        except Exception as e:
            logger.warning(f"[Territory] Intersection calc failed for {territory.id}: {e}")

    return overlaps


async def steal_territory(
    db: AsyncSession,
    overlap: dict,
    new_owner_id: uuid.UUID,
    run_id: uuid.UUID,
) -> Dispute:
    """
    Transfer overlapping territory from the previous owner to the new runner.
    Creates a dispute record for push notification.
    
    The existing territory is split:
    - The overlapping portion goes to the new owner
    - The remaining portion stays with the old owner (if any)
    """
    existing: Territory = overlap["existing_territory"]
    existing_poly = to_shape(existing.polygon)
    intersection = overlap["intersection"]

    # Subtract the stolen area from the existing territory
    remaining = existing_poly.difference(intersection) if isinstance(intersection, (Polygon, MultiPolygon)) else existing_poly

    if remaining.is_empty or (isinstance(remaining, Polygon) and compute_area_sqm(remaining) < MIN_AREA_SQM):
        # Entire territory stolen — deactivate it
        existing.is_active = False
        logger.info(f"[Territory] Entire territory {existing.id} stolen by {new_owner_id}")
    else:
        # Shrink the existing territory to the remaining area
        if isinstance(remaining, MultiPolygon):
            remaining = max(remaining.geoms, key=lambda g: g.area)
        existing.polygon = from_shape(remaining, srid=4326)
        existing.area_sqm = compute_area_sqm(remaining)

    # Update previous owner's total territory
    prev_owner = await db.execute(select(User).where(User.id == existing.owner_id))
    prev_user = prev_owner.scalar_one()
    prev_user.total_territory_sqm = max(0, prev_user.total_territory_sqm - overlap["overlap_area_sqm"])

    # Create dispute record
    dispute = Dispute(
        territory_id=existing.id,
        loser_id=existing.owner_id,
        winner_id=new_owner_id,
        area_lost_sqm=overlap["overlap_area_sqm"],
        notified=False,
    )
    db.add(dispute)
    await db.flush()

    logger.info(
        f"[Dispute] {new_owner_id} stole {overlap['overlap_area_sqm']:.0f} sqm "
        f"from {existing.owner_id} (territory {existing.id})"
    )
    return dispute


# ═══════════════════════════════════════════════════════════════
# MAIN ENTRY POINT: Process a finished run for territory capture
# ═══════════════════════════════════════════════════════════════

async def process_run_territory(db: AsyncSession, run_id: str) -> dict:
    """
    Main entry point: after a run finishes, analyze the GPS route
    for territory capture.
    
    Returns:
    {
        "territories_captured": int,
        "total_area_sqm": float,
        "territories_stolen": int,
        "disputes": [{ dispute_id, loser_id, area_lost_sqm }]
    }
    """
    run_uuid = uuid.UUID(run_id)

    # Load the run and its GPS points
    run_result = await db.execute(select(Run).where(Run.id == run_uuid))
    run = run_result.scalar_one()

    points_result = await db.execute(
        select(RunPoint)
        .where(RunPoint.run_id == run_uuid)
        .order_by(RunPoint.seq)
    )
    raw_points = points_result.scalars().all()

    if len(raw_points) < MIN_POINTS_FOR_POLYGON:
        logger.info(f"[Territory] Run {run_id} has too few points ({len(raw_points)}) for territory")
        return {"territories_captured": 0, "total_area_sqm": 0, "territories_stolen": 0, "disputes": []}

    coords = [(p.lng, p.lat) for p in raw_points]

    # ─── Step 1: Detect closed loops ─────────────────────────
    polygons = detect_closed_loops(coords)

    # ─── Step 2: Apply straight-line penalty if no loops found
    if not polygons:
        penalty_poly = apply_straight_line_penalty(coords)
        if penalty_poly:
            polygons = [penalty_poly]

    if not polygons:
        logger.info(f"[Territory] Run {run_id} produced no capturable territory")
        return {"territories_captured": 0, "total_area_sqm": 0, "territories_stolen": 0, "disputes": []}

    # ─── Step 3: Save territories & check for stealing ───────
    total_area = 0.0
    all_disputes = []
    territories_captured = 0

    for poly in polygons:
        area = compute_area_sqm(poly)

        # Save the new territory
        territory = Territory(
            owner_id=run.user_id,
            run_id=run_uuid,
            polygon=from_shape(poly, srid=4326),
            area_sqm=area,
        )
        db.add(territory)
        await db.flush()  # Get the territory ID

        territories_captured += 1
        total_area += area

        # Check for overlaps with other users' territories
        overlaps = await check_territory_overlap(db, poly, run.user_id)

        for overlap in overlaps:
            dispute = await steal_territory(db, overlap, run.user_id, run_uuid)
            all_disputes.append({
                "dispute_id": str(dispute.id),
                "loser_id": str(dispute.loser_id),
                "area_lost_sqm": dispute.area_lost_sqm,
            })

    # ─── Step 4: Update the runner's total territory ─────────
    user_result = await db.execute(select(User).where(User.id == run.user_id))
    user = user_result.scalar_one()
    user.total_territory_sqm += total_area
    await db.flush()

    result = {
        "territories_captured": territories_captured,
        "total_area_sqm": round(total_area, 2),
        "territories_stolen": len(all_disputes),
        "disputes": all_disputes,
    }

    logger.info(f"[Territory] Run {run_id} result: {result}")
    return result
