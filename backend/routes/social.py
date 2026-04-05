"""
Social & Community Routes (Module 5)

PROFILES:
  GET  /social/profile/{user_id}         → Get user profile + stats
  PUT  /social/profile/{user_id}         → Update profile fields
  GET  /social/search                     → Search users by username

FOLLOW SYSTEM:
  POST /social/follow                     → Follow a user
  POST /social/unfollow                   → Unfollow a user
  GET  /social/followers/{user_id}        → List followers
  GET  /social/following/{user_id}        → List following
  GET  /social/is-following               → Check if following

ACTIVITY FEED:
  GET  /social/feed/personal/{user_id}    → Own activity history
  GET  /social/feed/friends/{user_id}     → Friends' activity stream

LEADERBOARDS:
  GET  /social/leaderboard                → Global/city/state leaderboard
  GET  /social/leaderboard/friends/{uid}  → Friends-only leaderboard
"""

from pydantic import BaseModel
from pydantic import Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import social_service

router = APIRouter(prefix="/social", tags=["social"])


# ─── Schemas ─────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    territory_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class FollowRequest(BaseModel):
    follower_id: str
    following_id: str


# ═══════════════════════════════════════════════════════════════
# PROFILES
# ═══════════════════════════════════════════════════════════════

@router.get("/profile/{user_id}")
async def get_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a user's public profile with stats."""
    profile = await social_service.get_profile(db, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.put("/profile/{user_id}")
async def update_profile(user_id: str, updates: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    """Update profile fields."""
    profile = await social_service.update_profile(db, user_id, updates.model_dump(exclude_none=True))
    return profile


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username or display name."""
    return await social_service.search_users(db, q, limit)


# ═══════════════════════════════════════════════════════════════
# FOLLOW SYSTEM
# ═══════════════════════════════════════════════════════════════

@router.post("/follow")
async def follow_user(req: FollowRequest, db: AsyncSession = Depends(get_db)):
    """Follow a user."""
    try:
        return await social_service.follow_user(db, req.follower_id, req.following_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unfollow")
async def unfollow_user(req: FollowRequest, db: AsyncSession = Depends(get_db)):
    """Unfollow a user."""
    return await social_service.unfollow_user(db, req.follower_id, req.following_id)


@router.get("/followers/{user_id}")
async def get_followers(
    user_id: str,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List followers of a user."""
    return await social_service.get_followers(db, user_id, limit)


@router.get("/following/{user_id}")
async def get_following(
    user_id: str,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List users this person follows."""
    return await social_service.get_following(db, user_id, limit)


@router.get("/is-following")
async def is_following(
    follower_id: str = Query(...),
    following_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Check if one user follows another."""
    result = await social_service.is_following(db, follower_id, following_id)
    return {"is_following": result}


# ═══════════════════════════════════════════════════════════════
# ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════

@router.get("/feed/personal/{user_id}")
async def personal_feed(
    user_id: str,
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get a user's own activity history."""
    return await social_service.get_personal_feed(db, user_id, limit, offset)


@router.get("/feed/friends/{user_id}")
async def friends_feed(
    user_id: str,
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Get activity feed from friends (people this user follows)."""
    return await social_service.get_friends_feed(db, user_id, limit, offset)


# ═══════════════════════════════════════════════════════════════
# LEADERBOARDS
# ═══════════════════════════════════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(
    board: str = Query("territory", pattern="^(territory|distance|xp)$"),
    city: str | None = Query(None),
    state: str | None = Query(None),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Global leaderboard, optionally filtered by city or state.
    board: "territory" (sqm), "distance" (m), or "xp"
    """
    return await social_service.get_leaderboard(db, board, city, state, limit)


@router.get("/leaderboard/friends/{user_id}")
async def friends_leaderboard(
    user_id: str,
    board: str = Query("territory", pattern="^(territory|distance|xp)$"),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Leaderboard among friends only."""
    return await social_service.get_friends_leaderboard(db, user_id, board, limit)
