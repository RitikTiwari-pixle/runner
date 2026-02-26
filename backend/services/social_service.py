"""
User Profile & Social Service (Module 5)

Handles:
1. User profile CRUD (view, update, search)
2. Follow/unfollow system with counts
3. Activity feed (personal + friends' runs and territory captures)
4. Leaderboards (global, city, friends)
"""

import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import User, Run, Territory
from models.social import Follow, Activity

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# USER PROFILES
# ═══════════════════════════════════════════════════════════════

async def get_profile(db: AsyncSession, user_id: str) -> dict | None:
    """Get a user's full public profile with stats."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        return None

    # Get follower/following counts
    follower_count = await db.execute(
        select(func.count()).where(Follow.following_id == user_uuid)
    )
    following_count = await db.execute(
        select(func.count()).where(Follow.follower_id == user_uuid)
    )

    # Get run count
    run_count = await db.execute(
        select(func.count()).where(Run.user_id == user_uuid, Run.is_valid == True)
    )

    # Get active territory count
    territory_count = await db.execute(
        select(func.count()).where(Territory.owner_id == user_uuid, Territory.is_active == True)
    )

    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "city": user.city,
        "state": user.state,
        "country": user.country,
        "xp": user.xp,
        "level": user.level,
        "total_distance_m": user.total_distance_m,
        "total_duration_s": user.total_duration_s,
        "total_territory_sqm": user.total_territory_sqm,
        "run_count": run_count.scalar(),
        "territory_count": territory_count.scalar(),
        "followers": follower_count.scalar(),
        "following": following_count.scalar(),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def update_profile(db: AsyncSession, user_id: str, updates: dict) -> dict:
    """Update user profile fields (display_name, avatar_url, city, state)."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one()

    allowed_fields = {"display_name", "avatar_url", "city", "state", "phone"}
    for field, value in updates.items():
        if field in allowed_fields and value is not None:
            setattr(user, field, value)

    user.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return await get_profile(db, user_id)


async def search_users(db: AsyncSession, query: str, limit: int = 20) -> list[dict]:
    """Search users by username or display name."""
    search_pattern = f"%{query}%"
    result = await db.execute(
        select(User)
        .where(
            or_(
                User.username.ilike(search_pattern),
                User.display_name.ilike(search_pattern),
            )
        )
        .limit(limit)
    )
    users = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "city": u.city,
            "level": u.level,
            "total_territory_sqm": u.total_territory_sqm,
        }
        for u in users
    ]


# ═══════════════════════════════════════════════════════════════
# FOLLOW SYSTEM
# ═══════════════════════════════════════════════════════════════

async def follow_user(db: AsyncSession, follower_id: str, following_id: str) -> dict:
    """Follow a user. Returns follow status."""
    f_uuid = uuid.UUID(follower_id)
    t_uuid = uuid.UUID(following_id)

    if f_uuid == t_uuid:
        raise ValueError("Cannot follow yourself")

    # Check if already following
    existing = await db.execute(
        select(Follow).where(Follow.follower_id == f_uuid, Follow.following_id == t_uuid)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_following"}

    follow = Follow(follower_id=f_uuid, following_id=t_uuid)
    db.add(follow)
    await db.flush()

    return {"status": "followed"}


async def unfollow_user(db: AsyncSession, follower_id: str, following_id: str) -> dict:
    """Unfollow a user."""
    f_uuid = uuid.UUID(follower_id)
    t_uuid = uuid.UUID(following_id)

    result = await db.execute(
        select(Follow).where(Follow.follower_id == f_uuid, Follow.following_id == t_uuid)
    )
    follow = result.scalar_one_or_none()
    if not follow:
        return {"status": "not_following"}

    await db.delete(follow)
    await db.flush()
    return {"status": "unfollowed"}


async def get_followers(db: AsyncSession, user_id: str, limit: int = 50) -> list[dict]:
    """Get list of users who follow this user."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == user_uuid)
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        {"id": str(u.id), "username": u.username, "display_name": u.display_name,
         "avatar_url": u.avatar_url, "level": u.level}
        for u in users
    ]


async def get_following(db: AsyncSession, user_id: str, limit: int = 50) -> list[dict]:
    """Get list of users this user follows."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(User)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == user_uuid)
        .limit(limit)
    )
    users = result.scalars().all()
    return [
        {"id": str(u.id), "username": u.username, "display_name": u.display_name,
         "avatar_url": u.avatar_url, "level": u.level}
        for u in users
    ]


async def is_following(db: AsyncSession, follower_id: str, following_id: str) -> bool:
    """Check if one user follows another."""
    result = await db.execute(
        select(Follow).where(
            Follow.follower_id == uuid.UUID(follower_id),
            Follow.following_id == uuid.UUID(following_id),
        )
    )
    return result.scalar_one_or_none() is not None


# ═══════════════════════════════════════════════════════════════
# ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════

async def create_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    activity_type: str,
    run_id: uuid.UUID | None = None,
    territory_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> Activity:
    """Create an activity feed entry."""
    activity = Activity(
        user_id=user_id,
        type=activity_type,
        run_id=run_id,
        territory_id=territory_id,
        meta=metadata,
    )
    db.add(activity)
    await db.flush()
    return activity


async def get_personal_feed(db: AsyncSession, user_id: str, limit: int = 30, offset: int = 0) -> list[dict]:
    """Get a user's own activity history."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user_uuid)
        .order_by(Activity.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    activities = result.scalars().all()
    return [_activity_to_dict(a) for a in activities]


async def get_friends_feed(db: AsyncSession, user_id: str, limit: int = 30, offset: int = 0) -> list[dict]:
    """
    Get activity feed from users this person follows.
    Shows runs, territory captures, and achievements from friends.
    """
    user_uuid = uuid.UUID(user_id)

    # Get IDs of users we follow
    following_result = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == user_uuid)
    )
    following_ids = [row[0] for row in following_result.all()]

    if not following_ids:
        return []

    # Include own activities too
    following_ids.append(user_uuid)

    result = await db.execute(
        select(Activity, User.username, User.display_name, User.avatar_url)
        .join(User, Activity.user_id == User.id)
        .where(Activity.user_id.in_(following_ids))
        .order_by(Activity.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()

    return [
        {
            **_activity_to_dict(row[0]),
            "username": row[1],
            "display_name": row[2],
            "avatar_url": row[3],
        }
        for row in rows
    ]


def _activity_to_dict(activity: Activity) -> dict:
    """Convert Activity model to dict."""
    return {
        "id": str(activity.id),
        "user_id": str(activity.user_id),
        "type": activity.type,
        "run_id": str(activity.run_id) if activity.run_id else None,
        "territory_id": str(activity.territory_id) if activity.territory_id else None,
        "metadata": activity.meta,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
    }


# ═══════════════════════════════════════════════════════════════
# LEADERBOARDS
# ═══════════════════════════════════════════════════════════════

async def get_leaderboard(
    db: AsyncSession,
    board_type: str = "territory",  # "territory", "distance", "xp"
    city: str | None = None,
    state: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Get leaderboard rankings.
    
    board_type: "territory" (sqm), "distance" (m), "xp"
    Optionally filter by city or state for local leaderboards.
    """
    query = select(User).where(User.is_banned == False)

    if city:
        query = query.where(User.city == city)
    elif state:
        query = query.where(User.state == state)

    # Sort by the chosen metric
    if board_type == "territory":
        query = query.order_by(User.total_territory_sqm.desc())
    elif board_type == "distance":
        query = query.order_by(User.total_distance_m.desc())
    elif board_type == "xp":
        query = query.order_by(User.xp.desc())
    else:
        query = query.order_by(User.total_territory_sqm.desc())

    query = query.limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "rank": i + 1,
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "city": u.city,
            "state": u.state,
            "level": u.level,
            "total_territory_sqm": u.total_territory_sqm,
            "total_distance_m": u.total_distance_m,
            "xp": u.xp,
        }
        for i, u in enumerate(users)
    ]


async def get_friends_leaderboard(
    db: AsyncSession,
    user_id: str,
    board_type: str = "territory",
    limit: int = 50,
) -> list[dict]:
    """Leaderboard among friends (people you follow + yourself)."""
    user_uuid = uuid.UUID(user_id)

    following_result = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == user_uuid)
    )
    friend_ids = [row[0] for row in following_result.all()]
    friend_ids.append(user_uuid)  # Include self

    query = select(User).where(User.id.in_(friend_ids), User.is_banned == False)

    if board_type == "territory":
        query = query.order_by(User.total_territory_sqm.desc())
    elif board_type == "distance":
        query = query.order_by(User.total_distance_m.desc())
    elif board_type == "xp":
        query = query.order_by(User.xp.desc())

    query = query.limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "rank": i + 1,
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "level": u.level,
            "total_territory_sqm": u.total_territory_sqm,
            "total_distance_m": u.total_distance_m,
            "xp": u.xp,
        }
        for i, u in enumerate(users)
    ]
