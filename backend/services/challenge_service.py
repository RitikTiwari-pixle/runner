"""
Challenge Service (Module 6)

Manages city-based and state-based competitions for Indian runners.
Supports monthly challenges like "Run 50km in Mumbai this month"
or "Capture 10,000 sqm in Delhi".
"""

import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import User
from services.progression_service import XP_REWARDS

logger = logging.getLogger(__name__)

# ─── ORM models are in the schema (challenges, user_challenges) ──
# We use raw SQL queries here since these tables don't have
# full ORM models yet. In production, add proper ORM classes.

from sqlalchemy import text


async def get_active_challenges(
    db: AsyncSession,
    city: str | None = None,
    state: str | None = None,
) -> list[dict]:
    """Get currently active challenges, optionally filtered by location."""
    now = datetime.now(timezone.utc)

    query = text("""
        SELECT id, title, description, type, target_value,
               xp_reward, city, state, starts_at, ends_at, prize_desc
        FROM challenges
        WHERE is_active = TRUE
          AND starts_at <= :now AND ends_at >= :now
          AND (:city IS NULL OR city = :city OR city IS NULL)
          AND (:state IS NULL OR state = :state OR state IS NULL)
        ORDER BY ends_at ASC
        LIMIT 50
    """)

    result = await db.execute(query, {"now": now, "city": city, "state": state})
    rows = result.fetchall()

    return [
        {
            "id": str(row[0]),
            "title": row[1],
            "description": row[2],
            "type": row[3],
            "target_value": row[4],
            "xp_reward": row[5],
            "city": row[6],
            "state": row[7],
            "starts_at": row[8].isoformat() if row[8] else None,
            "ends_at": row[9].isoformat() if row[9] else None,
            "prize_desc": row[10],
        }
        for row in rows
    ]


async def join_challenge(db: AsyncSession, user_id: str, challenge_id: str) -> dict:
    """Join a challenge."""
    query = text("""
        INSERT INTO user_challenges (user_id, challenge_id)
        VALUES (:user_id, :challenge_id)
        ON CONFLICT (user_id, challenge_id) DO NOTHING
        RETURNING user_id
    """)
    result = await db.execute(query, {
        "user_id": uuid.UUID(user_id),
        "challenge_id": uuid.UUID(challenge_id),
    })
    if result.fetchone():
        return {"status": "joined"}
    return {"status": "already_joined"}


async def get_user_challenges(db: AsyncSession, user_id: str) -> list[dict]:
    """Get all challenges a user has joined with their progress."""
    query = text("""
        SELECT c.id, c.title, c.description, c.type, c.target_value,
               c.xp_reward, c.city, c.state, c.starts_at, c.ends_at,
               uc.progress, uc.completed, uc.completed_at
        FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = :user_id
        ORDER BY c.ends_at DESC
    """)
    result = await db.execute(query, {"user_id": uuid.UUID(user_id)})
    rows = result.fetchall()

    return [
        {
            "id": str(row[0]),
            "title": row[1],
            "description": row[2],
            "type": row[3],
            "target_value": row[4],
            "xp_reward": row[5],
            "city": row[6],
            "state": row[7],
            "starts_at": row[8].isoformat() if row[8] else None,
            "ends_at": row[9].isoformat() if row[9] else None,
            "progress": row[10],
            "completed": row[11],
            "completed_at": row[12].isoformat() if row[12] else None,
            "progress_pct": min(100, (row[10] / row[4] * 100)) if row[4] > 0 else 0,
        }
        for row in rows
    ]


async def update_challenge_progress(
    db: AsyncSession,
    user_id: uuid.UUID,
    distance_m: float = 0,
    territory_sqm: float = 0,
) -> list[dict]:
    """
    Update progress on all active challenges after a run.
    Called from finish_run pipeline.

    Challenge types:
    - "distance": target is total km to run
    - "territory": target is sqm of territory to capture
    - "runs": target is number of runs to complete
    """
    now = datetime.now(timezone.utc)
    completed_challenges = []

    # Get user's active, uncompleted challenges
    query = text("""
        SELECT uc.challenge_id, c.type, c.target_value, c.xp_reward,
               uc.progress, c.title
        FROM user_challenges uc
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.user_id = :user_id
          AND uc.completed = FALSE
          AND c.is_active = TRUE
          AND c.starts_at <= :now AND c.ends_at >= :now
    """)
    result = await db.execute(query, {"user_id": user_id, "now": now})
    rows = result.fetchall()

    for row in rows:
        challenge_id = row[0]
        challenge_type = row[1]
        target = row[2]
        xp_reward = row[3]
        current_progress = row[4] or 0
        title = row[5]

        # Calculate progress increment based on challenge type
        increment = 0
        if challenge_type == "distance":
            increment = distance_m / 1000.0  # Convert to km
        elif challenge_type == "territory":
            increment = territory_sqm
        elif challenge_type == "runs":
            increment = 1

        if increment <= 0:
            continue

        new_progress = current_progress + increment
        completed = new_progress >= target

        # Update progress
        update_query = text("""
            UPDATE user_challenges
            SET progress = :progress,
                completed = :completed,
                completed_at = CASE WHEN :completed THEN :now ELSE NULL END
            WHERE user_id = :user_id AND challenge_id = :challenge_id
        """)
        await db.execute(update_query, {
            "progress": new_progress,
            "completed": completed,
            "user_id": user_id,
            "challenge_id": challenge_id,
            "now": now,
        })

        if completed:
            # Award XP for completing challenge
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one()
            user.xp += xp_reward

            completed_challenges.append({
                "challenge_id": str(challenge_id),
                "title": title,
                "xp_reward": xp_reward,
            })

            logger.info(f"[Challenge] User {user_id} completed '{title}' (+{xp_reward} XP)")

    await db.flush()
    return completed_challenges


async def get_challenge_leaderboard(
    db: AsyncSession,
    challenge_id: str,
    limit: int = 50,
) -> list[dict]:
    """Get the leaderboard for a specific challenge."""
    query = text("""
        SELECT u.id, u.username, u.display_name, u.avatar_url,
               uc.progress, uc.completed, c.target_value
        FROM user_challenges uc
        JOIN users u ON u.id = uc.user_id
        JOIN challenges c ON c.id = uc.challenge_id
        WHERE uc.challenge_id = :challenge_id
        ORDER BY uc.progress DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {
        "challenge_id": uuid.UUID(challenge_id),
        "limit": limit,
    })
    rows = result.fetchall()

    return [
        {
            "rank": i + 1,
            "id": str(row[0]),
            "username": row[1],
            "display_name": row[2],
            "avatar_url": row[3],
            "progress": row[4],
            "completed": row[5],
            "progress_pct": min(100, (row[4] / row[6] * 100)) if row[6] > 0 else 0,
        }
        for i, row in enumerate(rows)
    ]
