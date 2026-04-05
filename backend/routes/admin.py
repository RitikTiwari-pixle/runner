"""
Admin Routes — Developer Data Viewer

Simple password-protected endpoints to view user data, runs, and stats
without needing a database GUI tool like pgAdmin.

Access at: http://localhost:8000/docs  →  /api/admin/ endpoints.

IMPORTANT: These endpoints require ADMIN_SECRET in .env. They will
refuse all requests if ADMIN_SECRET is not set (fails securely).
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models.run import User, Run

router = APIRouter(prefix="/admin", tags=["admin (dev)"])


def _require_admin_key(x_admin_secret: str = Header(..., alias="x-admin-secret")) -> None:
    """Validates the admin secret header. Raises 403 if wrong or not set."""
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints are disabled. Set ADMIN_SECRET in .env to enable.",
        )
    if x_admin_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")


@router.get("/users", summary="List all registered users")
async def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Filter by username or email"),
    _: None = Depends(_require_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a paginated list of all users with their key stats.

    **How to use:** Open http://localhost:8000/docs, click this endpoint,
    click 'Try it out', and enter your ADMIN_SECRET in the header field.
    """
    query = select(User).order_by(desc(User.created_at))

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(User.username).like(term) | func.lower(User.email).like(term)
        )

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Count total
    count_q = select(func.count()).select_from(User)
    total = (await db.execute(count_q)).scalar_one()

    return {
        "total": total,
        "returned": len(users),
        "offset": offset,
        "users": [
            {
                "id": str(u.id),
                "username": u.username,
                "display_name": u.display_name,
                "email": u.email,
                "email_verified": u.email_verified,
                "city": u.city,
                "state": u.state,
                "level": u.level,
                "xp": u.xp,
                "total_distance_km": round((u.total_distance_m or 0) / 1000, 2),
                "total_territory_sqm": round(u.total_territory_sqm or 0, 1),
                "is_banned": u.is_banned,
                "cheat_flags": u.cheat_flags,
                "joined": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}", summary="Get a single user's full profile")
async def get_user_detail(
    user_id: str,
    _: None = Depends(_require_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """Returns complete details for one user including recent runs."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get their last 10 runs
    runs_result = await db.execute(
        select(Run)
        .where(Run.user_id == user.id)
        .order_by(desc(Run.started_at))
        .limit(10)
    )
    runs = runs_result.scalars().all()

    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": u.display_name if False else user.display_name,
        "email": user.email,
        "email_verified": user.email_verified,
        "city": user.city,
        "state": user.state,
        "country": user.country,
        "level": user.level,
        "xp": user.xp,
        "total_distance_km": round((user.total_distance_m or 0) / 1000, 2),
        "total_duration_mins": round((user.total_duration_s or 0) / 60, 1),
        "total_territory_sqm": round(user.total_territory_sqm or 0, 1),
        "is_banned": user.is_banned,
        "cheat_flags": user.cheat_flags,
        "firebase_uid": user.firebase_uid,
        "joined": user.created_at.isoformat() if user.created_at else None,
        "recent_runs": [
            {
                "id": str(r.id),
                "started_at": r.started_at.isoformat(),
                "distance_km": round((r.distance_m or 0) / 1000, 2),
                "duration_mins": round((r.duration_s or 0) / 60, 1),
                "is_valid": r.is_valid,
                "cheat_reason": r.cheat_reason,
            }
            for r in runs
        ],
    }


@router.get("/stats", summary="Overall app statistics")
async def app_stats(
    _: None = Depends(_require_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """Returns high-level stats: total users, total runs, total distance, etc."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_runs = (await db.execute(select(func.count()).select_from(Run))).scalar_one()
    total_verified = (
        await db.execute(select(func.count()).select_from(User).where(User.email_verified == True))
    ).scalar_one()
    total_dist = (
        await db.execute(select(func.sum(User.total_distance_m)).select_from(User))
    ).scalar_one() or 0

    return {
        "total_users": total_users,
        "verified_users": total_verified,
        "unverified_users": total_users - total_verified,
        "total_runs": total_runs,
        "total_distance_km": round(total_dist / 1000, 1),
    }
