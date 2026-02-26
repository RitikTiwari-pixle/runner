"""
Run service — business logic for creating, updating, and finishing runs.
Handles GPS point batching and metric computation.
"""

import uuid
import math
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.shape import from_shape
from shapely.geometry import LineString

from models.run import Run, RunPoint, User


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS points in meters."""
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (math.sin(d_phi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_metrics(points: list[dict]) -> dict:
    """
    Compute run metrics from a list of GPS point dicts.
    Returns: { distance_m, duration_s, avg_pace_s_per_km, max_speed_mps }
    """
    if len(points) < 2:
        return {"distance_m": 0, "duration_s": 0, "avg_pace_s_per_km": 0, "max_speed_mps": 0}

    total_distance = 0.0
    max_speed = 0.0

    for i in range(1, len(points)):
        d = haversine_distance(
            points[i - 1]["lat"], points[i - 1]["lng"],
            points[i]["lat"], points[i]["lng"]
        )
        total_distance += d

        speed = points[i].get("speed_mps", 0) or 0
        if speed > max_speed:
            max_speed = speed

    start_time = points[0]["timestamp"]
    end_time = points[-1]["timestamp"]

    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time)
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time)

    duration_s = (end_time - start_time).total_seconds()
    avg_pace = (duration_s / (total_distance / 1000)) if total_distance > 0 else 0

    return {
        "distance_m": round(total_distance, 2),
        "duration_s": int(duration_s),
        "avg_pace_s_per_km": round(avg_pace, 2),
        "max_speed_mps": round(max_speed, 2),
    }


async def start_run(db: AsyncSession, user_id: str) -> Run:
    """Create a new run session."""
    run = Run(
        user_id=uuid.UUID(user_id),
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()
    return run


async def add_points(db: AsyncSession, run_id: str, points: list[dict]) -> int:
    """
    Batch-insert GPS breadcrumbs into run_points.
    Returns the number of points inserted.
    """
    run_uuid = uuid.UUID(run_id)

    # Get current max seq for this run
    result = await db.execute(
        select(RunPoint.seq)
        .where(RunPoint.run_id == run_uuid)
        .order_by(RunPoint.seq.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    next_seq = (row + 1) if row is not None else 0

    db_points = []
    for i, pt in enumerate(points):
        ts = pt["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)

        db_points.append(RunPoint(
            run_id=run_uuid,
            seq=next_seq + i,
            lat=pt["lat"],
            lng=pt["lng"],
            altitude_m=pt.get("altitude_m"),
            speed_mps=pt.get("speed_mps"),
            accuracy_m=pt.get("accuracy_m"),
            timestamp=ts,
        ))

    db.add_all(db_points)
    await db.flush()
    return len(db_points)


async def finish_run(db: AsyncSession, run_id: str, difficulty: str | None = None, notes: str | None = None) -> Run:
    """
    Finalize a run: compute all metrics from stored GPS points,
    build a PostGIS LineString route, update the run record.
    """
    run_uuid = uuid.UUID(run_id)

    # Load run
    result = await db.execute(select(Run).where(Run.id == run_uuid))
    run = result.scalar_one()

    # Load all GPS points in order
    result = await db.execute(
        select(RunPoint)
        .where(RunPoint.run_id == run_uuid)
        .order_by(RunPoint.seq)
    )
    raw_points = result.scalars().all()

    if not raw_points:
        run.ended_at = datetime.now(timezone.utc)
        run.duration_s = 0
        run.distance_m = 0
        await db.flush()
        return run

    points_dicts = [
        {
            "lat": p.lat,
            "lng": p.lng,
            "speed_mps": p.speed_mps,
            "timestamp": p.timestamp,
        }
        for p in raw_points
    ]

    metrics = compute_metrics(points_dicts)

    # Build PostGIS LineString from coordinates
    coords = [(p.lng, p.lat) for p in raw_points]
    if len(coords) >= 2:
        line = LineString(coords)
        run.route = from_shape(line, srid=4326)

    run.ended_at = datetime.now(timezone.utc)
    run.duration_s = metrics["duration_s"]
    run.distance_m = metrics["distance_m"]
    run.avg_pace_s_per_km = metrics["avg_pace_s_per_km"]
    run.max_speed_mps = metrics["max_speed_mps"]
    run.difficulty = difficulty
    run.notes = notes

    # Update user aggregate stats
    user_result = await db.execute(select(User).where(User.id == run.user_id))
    user = user_result.scalar_one()
    user.total_distance_m += metrics["distance_m"]
    user.total_duration_s += metrics["duration_s"]

    await db.flush()
    return run


async def get_run(db: AsyncSession, run_id: str) -> Run | None:
    """Fetch a single run by ID."""
    result = await db.execute(select(Run).where(Run.id == uuid.UUID(run_id)))
    return result.scalar_one_or_none()


async def get_user_runs(db: AsyncSession, user_id: str, limit: int = 20, offset: int = 0) -> list[Run]:
    """Fetch a user's run history, most recent first."""
    result = await db.execute(
        select(Run)
        .where(Run.user_id == uuid.UUID(user_id))
        .order_by(Run.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
