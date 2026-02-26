"""
Progression & XP Service (Module 6)

Handles:
1. XP rewards — earn XP for runs, territory captures, streaks
2. Level-up system — XP thresholds per level
3. Run streak tracking — consecutive days running
4. Challenge management — city-based competitions
"""

import uuid
import logging
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import User, Run, Territory
from models.social import Activity

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# XP CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# XP rewards for various actions
XP_REWARDS = {
    "run_completed": 50,           # Base XP per run
    "per_km": 20,                  # Bonus per km
    "territory_captured": 100,     # Per territory polygon
    "territory_stolen": 150,       # Per territory stolen from another user
    "streak_day": 25,              # Bonus per streak day
    "challenge_completed": 500,    # Completing a challenge
    "first_run": 200,              # First ever run bonus
}

# Level thresholds — XP needed to reach each level
# Formula: level_xp = 100 * level^1.5
def xp_for_level(level: int) -> int:
    """Calculate total XP needed to reach a given level."""
    return int(100 * math.pow(level, 1.5))


def level_from_xp(total_xp: int) -> int:
    """Calculate current level from total XP."""
    level = 1
    while xp_for_level(level + 1) <= total_xp:
        level += 1
    return level


# ═══════════════════════════════════════════════════════════════
# XP AWARD SYSTEM
# ═══════════════════════════════════════════════════════════════

async def award_run_xp(db: AsyncSession, user_id: uuid.UUID, run_id: uuid.UUID) -> dict:
    """
    Award XP for completing a run.
    Called from the finish_run pipeline.
    
    Returns: { xp_earned, new_total_xp, level, leveled_up }
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    run_result = await db.execute(select(Run).where(Run.id == run_id))
    run = run_result.scalar_one()

    if not run.is_valid:
        return {"xp_earned": 0, "new_total_xp": user.xp, "level": user.level, "leveled_up": False}

    xp_earned = 0

    # Base run XP
    xp_earned += XP_REWARDS["run_completed"]

    # Distance bonus
    if run.distance_m and run.distance_m > 0:
        km = run.distance_m / 1000.0
        xp_earned += int(km * XP_REWARDS["per_km"])

    # First run bonus
    run_count_result = await db.execute(
        select(func.count()).where(Run.user_id == user_id, Run.is_valid == True)
    )
    if run_count_result.scalar() == 1:
        xp_earned += XP_REWARDS["first_run"]

    # Streak bonus
    streak = await _calculate_streak(db, user_id)
    if streak > 1:
        xp_earned += XP_REWARDS["streak_day"] * min(streak, 30)  # Cap at 30-day streak bonus

    # Apply XP
    old_level = user.level
    user.xp += xp_earned
    user.level = level_from_xp(user.xp)
    leveled_up = user.level > old_level

    await db.flush()

    # Create level-up activity if leveled up
    if leveled_up:
        from services.social_service import create_activity
        await create_activity(
            db,
            user_id=user_id,
            activity_type="level_up",
            metadata={"new_level": user.level, "xp": user.xp},
        )

    return {
        "xp_earned": xp_earned,
        "new_total_xp": user.xp,
        "level": user.level,
        "leveled_up": leveled_up,
        "streak": streak,
    }


async def award_territory_xp(
    db: AsyncSession,
    user_id: uuid.UUID,
    territories_captured: int,
    territories_stolen: int,
) -> int:
    """Award XP for territory actions. Returns total XP earned."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    xp = (territories_captured * XP_REWARDS["territory_captured"]
          + territories_stolen * XP_REWARDS["territory_stolen"])

    user.xp += xp
    user.level = level_from_xp(user.xp)
    await db.flush()
    return xp


# ═══════════════════════════════════════════════════════════════
# STREAKS
# ═══════════════════════════════════════════════════════════════

async def _calculate_streak(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Calculate the current consecutive-day running streak."""
    today = datetime.now(timezone.utc).date()
    streak = 0

    for days_back in range(0, 365):  # Check up to a year
        check_date = today - timedelta(days=days_back)
        start_of_day = datetime.combine(check_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        result = await db.execute(
            select(func.count()).where(
                Run.user_id == user_id,
                Run.is_valid == True,
                Run.started_at >= start_of_day,
                Run.started_at < end_of_day,
            )
        )
        if result.scalar() > 0:
            streak += 1
        else:
            if days_back == 0:
                continue  # Haven't run today yet, check yesterday
            break

    return streak


async def get_user_streak(db: AsyncSession, user_id: str) -> dict:
    """Get a user's current streak and XP info."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one()

    streak = await _calculate_streak(db, user_uuid)
    next_level_xp = xp_for_level(user.level + 1)
    current_level_xp = xp_for_level(user.level)

    return {
        "streak_days": streak,
        "xp": user.xp,
        "level": user.level,
        "xp_to_next_level": next_level_xp - user.xp,
        "level_progress": (user.xp - current_level_xp) / max(next_level_xp - current_level_xp, 1),
    }
