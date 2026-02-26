"""
Anti-Cheat Service (Module 3)

Detects unnatural speed patterns that indicate vehicle use
(car, motorcycle, rickshaw) during a run.

DETECTION ALGORITHM:
───────────────────
1. Speed Threshold: Running rarely exceeds 6.5 m/s (23.4 km/h, world-class sprint).
   Sustained speeds above this are flagged.
2. Speed Spike Detection: Sudden jumps from running pace (2-5 m/s)
   to vehicle pace (>8 m/s) within a short window.
3. Sustained Vehicle Speed: Multiple consecutive points at vehicle speeds.
4. Distance/Time Ratio: If overall distance/time implies a faster-than-possible
   average, flag the run.

Each violation adds cheat_score. If score exceeds threshold,
the run is auto-invalidated and the user's cheat_flags increment.
"""

import uuid
import math
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import Run, RunPoint, User

logger = logging.getLogger(__name__)

# ─── Thresholds ──────────────────────────────────────────────────
MAX_RUNNING_SPEED_MPS = 6.5        # ~23.4 km/h — world-class sprinter
VEHICLE_SPEED_MPS = 8.0            # ~28.8 km/h — clearly not running
SUSTAINED_VEHICLE_WINDOW = 5       # Consecutive points at vehicle speed
SPIKE_JUMP_MPS = 4.0               # Speed jump threshold within 2 consecutive points
MAX_AVG_PACE_S_PER_KM = 150       # 2:30/km — faster than world record marathon pace
CHEAT_SCORE_THRESHOLD = 3          # Score above this → auto-flag

# Cheat reasons
REASON_SPEED_SPIKE = "speed_spike"
REASON_SUSTAINED_VEHICLE = "sustained_vehicle_speed"
REASON_IMPOSSIBLE_PACE = "impossible_average_pace"


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def analyze_speed_pattern(points: list[dict]) -> dict:
    """
    Analyze GPS points for cheating indicators.

    Args:
        points: list of dicts with keys: lat, lng, speed_mps, timestamp

    Returns:
        {
            "is_cheating": bool,
            "cheat_score": int,
            "reasons": [str],
            "details": [str],  # Human-readable explanations
        }
    """
    if len(points) < 5:
        return {"is_cheating": False, "cheat_score": 0, "reasons": [], "details": []}

    cheat_score = 0
    reasons = set()
    details = []

    # ─── Check 1: Speed spikes (sudden acceleration to vehicle speed)
    spike_count = 0
    for i in range(1, len(points)):
        prev_speed = points[i - 1].get("speed_mps") or 0
        curr_speed = points[i].get("speed_mps") or 0

        # Sudden jump from running to vehicle speed
        if curr_speed > VEHICLE_SPEED_MPS and abs(curr_speed - prev_speed) > SPIKE_JUMP_MPS:
            spike_count += 1

    if spike_count >= 2:
        cheat_score += 2
        reasons.add(REASON_SPEED_SPIKE)
        details.append(f"Detected {spike_count} sudden speed spikes exceeding {VEHICLE_SPEED_MPS} m/s")

    # ─── Check 2: Sustained vehicle speed
    consecutive_vehicle = 0
    max_consecutive = 0
    for pt in points:
        speed = pt.get("speed_mps") or 0
        if speed > VEHICLE_SPEED_MPS:
            consecutive_vehicle += 1
            max_consecutive = max(max_consecutive, consecutive_vehicle)
        else:
            consecutive_vehicle = 0

    if max_consecutive >= SUSTAINED_VEHICLE_WINDOW:
        cheat_score += 3
        reasons.add(REASON_SUSTAINED_VEHICLE)
        details.append(
            f"Sustained vehicle speed ({VEHICLE_SPEED_MPS}+ m/s) for "
            f"{max_consecutive} consecutive GPS points"
        )

    # ─── Check 3: Impossible average pace
    # Calculate distance from GPS points (not relying on speed_mps)
    total_dist = 0.0
    for i in range(1, len(points)):
        total_dist += _haversine(
            points[i - 1]["lat"], points[i - 1]["lng"],
            points[i]["lat"], points[i]["lng"]
        )

    if total_dist > 0:
        start_ts = points[0]["timestamp"]
        end_ts = points[-1]["timestamp"]

        if isinstance(start_ts, str):
            start_ts = datetime.fromisoformat(start_ts)
        if isinstance(end_ts, str):
            end_ts = datetime.fromisoformat(end_ts)

        duration_s = (end_ts - start_ts).total_seconds()
        if duration_s > 0:
            avg_pace = duration_s / (total_dist / 1000)  # seconds per km

            if avg_pace < MAX_AVG_PACE_S_PER_KM and total_dist > 1000:
                cheat_score += 2
                reasons.add(REASON_IMPOSSIBLE_PACE)
                pace_min = int(avg_pace // 60)
                pace_sec = int(avg_pace % 60)
                details.append(
                    f"Average pace {pace_min}:{pace_sec:02d}/km over "
                    f"{total_dist / 1000:.1f}km is faster than world record"
                )

    is_cheating = cheat_score >= CHEAT_SCORE_THRESHOLD

    return {
        "is_cheating": is_cheating,
        "cheat_score": cheat_score,
        "reasons": list(reasons),
        "details": details,
    }


# ═══════════════════════════════════════════════════════════════
# Main Entry Point: Validate a completed run
# ═══════════════════════════════════════════════════════════════

async def validate_run(db: AsyncSession, run_id: str) -> dict:
    """
    Validate a completed run for cheating.
    If cheating is detected, the run is marked invalid and the user
    is flagged.

    Returns:
        {
            "is_valid": bool,
            "cheat_score": int,
            "reasons": [str],
            "details": [str],
        }
    """
    run_uuid = uuid.UUID(run_id)

    # Load GPS points
    result = await db.execute(
        select(RunPoint)
        .where(RunPoint.run_id == run_uuid)
        .order_by(RunPoint.seq)
    )
    raw_points = result.scalars().all()

    points_dicts = [
        {
            "lat": p.lat,
            "lng": p.lng,
            "speed_mps": p.speed_mps,
            "timestamp": p.timestamp,
        }
        for p in raw_points
    ]

    analysis = analyze_speed_pattern(points_dicts)

    if analysis["is_cheating"]:
        # Mark the run as invalid
        run_result = await db.execute(select(Run).where(Run.id == run_uuid))
        run = run_result.scalar_one()
        run.is_valid = False
        run.cheat_reason = ", ".join(analysis["reasons"])[:50]  # Truncate to fit column

        # Increment user's cheat flags
        user_result = await db.execute(select(User).where(User.id == run.user_id))
        user = user_result.scalar_one()
        user.cheat_flags += 1

        # Revert distance/duration from user totals (they were added in finish_run)
        if run.distance_m:
            user.total_distance_m = max(0, user.total_distance_m - run.distance_m)
        if run.duration_s:
            user.total_duration_s = max(0, user.total_duration_s - run.duration_s)

        await db.flush()

        logger.warning(
            f"[Anti-Cheat] Run {run_id} FLAGGED: score={analysis['cheat_score']}, "
            f"reasons={analysis['reasons']}, details={analysis['details']}"
        )

    return {
        "is_valid": not analysis["is_cheating"],
        "cheat_score": analysis["cheat_score"],
        "reasons": analysis["reasons"],
        "details": analysis["details"],
    }
