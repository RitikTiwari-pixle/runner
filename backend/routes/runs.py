"""
Run routes — REST API endpoints for the run lifecycle.

POST /runs/start          → Create a new run session
POST /runs/{id}/points    → Batch-upload GPS breadcrumbs
POST /runs/{id}/finish    → Finalize the run and compute metrics
GET  /runs/{id}           → Get a single run
GET  /runs/user/{user_id} → Get a user's run history
"""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import run_service
from services import territory_service
from services import anticheat_service
from services import social_service
from services import progression_service
from services import challenge_service

router = APIRouter(prefix="/runs", tags=["runs"])


# ─── Request / Response Schemas ──────────────────────────────────

class StartRunRequest(BaseModel):
    user_id: str


class GPSPoint(BaseModel):
    lat: float
    lng: float
    altitude_m: float | None = None
    speed_mps: float | None = None
    accuracy_m: float | None = None
    timestamp: datetime


class AddPointsRequest(BaseModel):
    points: list[GPSPoint] = Field(..., min_length=1, max_length=500)


class FinishRunRequest(BaseModel):
    difficulty: str | None = None
    notes: str | None = None


class RunResponse(BaseModel):
    id: str
    user_id: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_s: int | None = None
    distance_m: float | None = None
    avg_pace_s_per_km: float | None = None
    max_speed_mps: float | None = None
    is_valid: bool = True
    source: str = "app"
    territories_captured: int | None = None
    territory_area_sqm: float | None = None
    territories_stolen: int | None = None
    cheat_score: int | None = None
    cheat_reasons: list[str] | None = None
    # Module 6: Progression
    xp_earned: int | None = None
    level: int | None = None
    leveled_up: bool | None = None

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/start", response_model=RunResponse, status_code=201)
async def start_run(req: StartRunRequest, db: AsyncSession = Depends(get_db)):
    """Start a new run session."""
    run = await run_service.start_run(db, req.user_id)
    return RunResponse(
        id=str(run.id),
        user_id=str(run.user_id),
        started_at=run.started_at,
        is_valid=run.is_valid,
        source=getattr(run, "source", "app") or "app",
    )


@router.post("/{run_id}/points", status_code=200)
async def add_points(run_id: str, req: AddPointsRequest, db: AsyncSession = Depends(get_db)):
    """Batch-upload GPS breadcrumbs (max 500 per call)."""
    points_dicts = [pt.model_dump() for pt in req.points]
    count = await run_service.add_points(db, run_id, points_dicts)
    return {"status": "ok", "points_added": count}


@router.post("/{run_id}/finish", response_model=RunResponse)
async def finish_run(run_id: str, req: FinishRunRequest, db: AsyncSession = Depends(get_db)):
    """
    Full run-finish pipeline:
    1. Compute metrics → 2. Anti-cheat → 3. Territory
    4. Activity feed → 5. XP award → 6. Challenge progress
    """
    import logging
    log = logging.getLogger(__name__)

    run = await run_service.finish_run(db, run_id, req.difficulty, req.notes)

    # ─── Module 3: Anti-cheat ────────────────────────────────
    cheat_result = {"is_valid": True, "cheat_score": 0, "reasons": [], "details": []}
    try:
        cheat_result = await anticheat_service.validate_run(db, run_id)
        if not cheat_result["is_valid"]:
            run = await run_service.get_run(db, run_id)
            raise HTTPException(
                status_code=400,
                detail="Speed too high. Vehicles are not allowed!"
            )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Anti-cheat failed: {e}")

    # ─── Module 2: Territory capture ─────────────────────────
    territory_result = {"territories_captured": 0, "total_area_sqm": 0, "territories_stolen": 0}
    if cheat_result["is_valid"]:
        try:
            territory_result = await territory_service.process_run_territory(db, run_id)
        except Exception as e:
            log.error(f"Territory processing failed: {e}")

    # ─── Module 5: Activity feed ─────────────────────────────
    try:
        await social_service.create_activity(
            db, user_id=run.user_id, activity_type="run_completed",
            run_id=run.id,
            metadata={"distance_m": run.distance_m, "duration_s": run.duration_s,
                       "avg_pace": run.avg_pace_s_per_km, "is_valid": run.is_valid},
        )
        if territory_result.get("territories_captured", 0) > 0:
            await social_service.create_activity(
                db, user_id=run.user_id, activity_type="territory_captured",
                run_id=run.id,
                metadata={"count": territory_result["territories_captured"],
                           "area_sqm": territory_result["total_area_sqm"]},
            )
        if territory_result.get("territories_stolen", 0) > 0:
            await social_service.create_activity(
                db, user_id=run.user_id, activity_type="territory_stolen",
                run_id=run.id, metadata={"count": territory_result["territories_stolen"]},
            )
    except Exception as e:
        log.error(f"Activity feed failed: {e}")

    # ─── Module 6: XP award ──────────────────────────────────
    xp_result = {"xp_earned": 0, "level": 1, "leveled_up": False}
    if cheat_result["is_valid"]:
        try:
            xp_result = await progression_service.award_run_xp(db, run.user_id, run.id)
            # Territory XP
            tc = territory_result.get("territories_captured", 0)
            ts = territory_result.get("territories_stolen", 0)
            if tc > 0 or ts > 0:
                extra_xp = await progression_service.award_territory_xp(db, run.user_id, tc, ts)
                xp_result["xp_earned"] += extra_xp
        except Exception as e:
            log.error(f"XP award failed: {e}")

    # ─── Module 6: Challenge progress ────────────────────────
    if cheat_result["is_valid"]:
        try:
            await challenge_service.update_challenge_progress(
                db, run.user_id,
                distance_m=run.distance_m or 0,
                territory_sqm=territory_result.get("total_area_sqm", 0),
            )
        except Exception as e:
            log.error(f"Challenge progress failed: {e}")

    return RunResponse(
        id=str(run.id),
        user_id=str(run.user_id),
        started_at=run.started_at,
        ended_at=run.ended_at,
        duration_s=run.duration_s,
        distance_m=run.distance_m,
        avg_pace_s_per_km=run.avg_pace_s_per_km,
        max_speed_mps=run.max_speed_mps,
        is_valid=run.is_valid,
        source=getattr(run, "source", "app") or "app",
        territories_captured=territory_result.get("territories_captured", 0),
        territory_area_sqm=territory_result.get("total_area_sqm", 0),
        territories_stolen=territory_result.get("territories_stolen", 0),
        cheat_score=cheat_result.get("cheat_score", 0),
        cheat_reasons=cheat_result.get("reasons", []),
        xp_earned=xp_result.get("xp_earned", 0),
        level=xp_result.get("level", 1),
        leveled_up=xp_result.get("leveled_up", False),
    )


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single run by ID."""
    run = await run_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunResponse(
        id=str(run.id),
        user_id=str(run.user_id),
        started_at=run.started_at,
        ended_at=run.ended_at,
        duration_s=run.duration_s,
        distance_m=run.distance_m,
        avg_pace_s_per_km=run.avg_pace_s_per_km,
        max_speed_mps=run.max_speed_mps,
        is_valid=run.is_valid,
        source=run.source,
    )


class ReportRunRequest(BaseModel):
    reason: str = "suspicious_activity"


@router.post("/{run_id}/report", status_code=200)
async def report_run(run_id: str, req: ReportRunRequest = ReportRunRequest(), db: AsyncSession = Depends(get_db)):
    """Community report a suspicious run for admin review."""
    from sqlalchemy import text
    await db.execute(
        text("UPDATE runs SET cheat_flags = COALESCE(cheat_flags, 0) + 1 WHERE id = :run_id"),
        {"run_id": run_id}
    )
    return {"status": "reported", "run_id": run_id}


@router.get("/user/{user_id}", response_model=list[RunResponse])
async def get_user_runs(user_id: str, limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """Get a user's run history, most recent first."""
    runs = await run_service.get_user_runs(db, user_id, limit, offset)
    return [
        RunResponse(
            id=str(r.id),
            user_id=str(r.user_id),
            started_at=r.started_at,
            ended_at=r.ended_at,
            duration_s=r.duration_s,
            distance_m=r.distance_m,
            avg_pace_s_per_km=r.avg_pace_s_per_km,
            max_speed_mps=r.max_speed_mps,
            is_valid=r.is_valid,
            source=getattr(r, "source", "app") or "app",
        )
        for r in runs
    ]
