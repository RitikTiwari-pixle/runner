"""
Progression & Challenge Routes (Module 6)

XP & LEVELS:
  GET  /progression/status/{user_id}      → XP, level, streak, progress
  
CHALLENGES:
  GET  /progression/challenges             → List active challenges
  POST /progression/challenges/join        → Join a challenge
  GET  /progression/challenges/user/{uid}  → User's challenge progress
  GET  /progression/challenges/{id}/board  → Challenge leaderboard
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import progression_service, challenge_service

router = APIRouter(prefix="/progression", tags=["progression"])


class JoinChallengeRequest(BaseModel):
    user_id: str
    challenge_id: str


# ═══════════════════════════════════════════════════════════════
# XP & LEVELS
# ═══════════════════════════════════════════════════════════════

@router.get("/status/{user_id}")
async def get_progression_status(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get XP, level, streak, and level progress for a user."""
    return await progression_service.get_user_streak(db, user_id)


# ═══════════════════════════════════════════════════════════════
# CHALLENGES
# ═══════════════════════════════════════════════════════════════

@router.get("/challenges")
async def list_challenges(
    city: str | None = Query(None),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List active challenges, optionally filtered by city/state."""
    return await challenge_service.get_active_challenges(db, city, state)


@router.post("/challenges/join")
async def join_challenge(req: JoinChallengeRequest, db: AsyncSession = Depends(get_db)):
    """Join a challenge."""
    return await challenge_service.join_challenge(db, req.user_id, req.challenge_id)


@router.get("/challenges/user/{user_id}")
async def user_challenges(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get all challenges a user has joined with progress."""
    return await challenge_service.get_user_challenges(db, user_id)


@router.get("/challenges/{challenge_id}/leaderboard")
async def challenge_leaderboard(
    challenge_id: str,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard for a specific challenge."""
    return await challenge_service.get_challenge_leaderboard(db, challenge_id, limit)
