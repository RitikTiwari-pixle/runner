"""
Territory routes — REST API endpoints for the territory gamification system.

POST /territories/process/{run_id}  → Analyze a run for territory capture
GET  /territories/user/{user_id}    → Get all territories owned by a user
GET  /territories/area               → Get all territories within a bounding box
GET  /disputes/user/{user_id}       → Get disputes for a user (territory stolen from them)
"""

import uuid
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import functions as geo_func
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import box

from db import get_db
from models.run import Territory, Dispute, User
from services import territory_service

router = APIRouter(tags=["territories"])


# ─── Response Schemas ────────────────────────────────────────────

class TerritoryResponse(BaseModel):
    id: str
    owner_id: str
    run_id: str
    area_sqm: float
    captured_at: datetime
    stolen_from_id: str | None = None
    is_active: bool
    # GeoJSON-compatible polygon coordinates
    coordinates: list[list[float]] | None = None


class DisputeResponse(BaseModel):
    id: str
    territory_id: str
    loser_id: str
    winner_id: str
    area_lost_sqm: float
    notified: bool
    created_at: datetime


class ProcessRunResult(BaseModel):
    territories_captured: int
    total_area_sqm: float
    territories_stolen: int
    disputes: list[dict]


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/territories/process/{run_id}", response_model=ProcessRunResult)
async def process_run_territory(run_id: str, db: AsyncSession = Depends(get_db)):
    """
    Analyze a completed run for territory capture.
    Detects closed loops, calculates area, checks for territory stealing.
    Should be called after /runs/{id}/finish.
    """
    try:
        result = await territory_service.process_run_territory(db, run_id)
        return ProcessRunResult(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Territory processing failed: {str(e)}")


@router.get("/territories/user/{user_id}", response_model=list[TerritoryResponse])
async def get_user_territories(
    user_id: str,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Get all territories owned by a user."""
    query = select(Territory).where(Territory.owner_id == uuid.UUID(user_id))
    if active_only:
        query = query.where(Territory.is_active == True)
    query = query.order_by(Territory.captured_at.desc())

    result = await db.execute(query)
    territories = result.scalars().all()

    responses = []
    for t in territories:
        coords = None
        try:
            shape = to_shape(t.polygon)
            coords = [list(c) for c in shape.exterior.coords]
        except Exception:
            pass

        responses.append(TerritoryResponse(
            id=str(t.id),
            owner_id=str(t.owner_id),
            run_id=str(t.run_id),
            area_sqm=t.area_sqm,
            captured_at=t.captured_at,
            stolen_from_id=str(t.stolen_from_id) if t.stolen_from_id else None,
            is_active=t.is_active,
            coordinates=coords,
        ))

    return responses


@router.get("/territories/area", response_model=list[TerritoryResponse])
async def get_territories_in_area(
    min_lat: float = Query(..., description="Bounding box minimum latitude"),
    min_lng: float = Query(..., description="Bounding box minimum longitude"),
    max_lat: float = Query(..., description="Bounding box maximum latitude"),
    max_lng: float = Query(..., description="Bounding box maximum longitude"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all active territories within a geographic bounding box.
    Used by the map view to render nearby territories.
    """
    bbox = box(min_lng, min_lat, max_lng, max_lat)
    bbox_geom = from_shape(bbox, srid=4326)

    result = await db.execute(
        select(Territory)
        .where(
            and_(
                Territory.is_active == True,
                geo_func.ST_Intersects(Territory.polygon, bbox_geom),
            )
        )
        .limit(200)  # Cap to prevent overloading the map
    )
    territories = result.scalars().all()

    responses = []
    for t in territories:
        coords = None
        try:
            shape = to_shape(t.polygon)
            coords = [list(c) for c in shape.exterior.coords]
        except Exception:
            pass

        responses.append(TerritoryResponse(
            id=str(t.id),
            owner_id=str(t.owner_id),
            run_id=str(t.run_id),
            area_sqm=t.area_sqm,
            captured_at=t.captured_at,
            stolen_from_id=str(t.stolen_from_id) if t.stolen_from_id else None,
            is_active=t.is_active,
            coordinates=coords,
        ))

    return responses


@router.get("/disputes/user/{user_id}", response_model=list[DisputeResponse])
async def get_user_disputes(
    user_id: str,
    unread_only: bool = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    Get disputes where the user lost territory.
    Used for the notification feed.
    """
    query = select(Dispute).where(Dispute.loser_id == uuid.UUID(user_id))
    if unread_only:
        query = query.where(Dispute.notified == False)
    query = query.order_by(Dispute.created_at.desc()).limit(limit)

    result = await db.execute(query)
    disputes = result.scalars().all()

    return [
        DisputeResponse(
            id=str(d.id),
            territory_id=str(d.territory_id),
            loser_id=str(d.loser_id),
            winner_id=str(d.winner_id),
            area_lost_sqm=d.area_lost_sqm,
            notified=d.notified,
            created_at=d.created_at,
        )
        for d in disputes
    ]


@router.post("/disputes/{dispute_id}/mark-read", status_code=200)
async def mark_dispute_read(dispute_id: str, db: AsyncSession = Depends(get_db)):
    """Mark a dispute notification as read."""
    result = await db.execute(select(Dispute).where(Dispute.id == uuid.UUID(dispute_id)))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute.notified = True
    await db.flush()
    return {"status": "ok"}
