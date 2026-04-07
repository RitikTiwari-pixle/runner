"""
Google OAuth Service

Handles Google OAuth token verification and user profile extraction.
Uses Google's tokeninfo endpoint for server-side ID token verification.

Environment variables required in backend .env / Railway dashboard:
  GOOGLE_OAUTH_CLIENT_ID     — OAuth 2.0 Web Client ID (same as frontend)
  GOOGLE_OAUTH_CLIENT_SECRET — OAuth 2.0 Client Secret (optional for ID-token flow)
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.run import User

logger = logging.getLogger(__name__)

# Read from environment — set these in Railway dashboard (or local .env)
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()

# Google's secure token verification endpoint (v3 is preferred over v1)
_GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify a Google ID token and extract user info.

    Uses Google's tokeninfo endpoint — no local key needed.
    Returns a dict with email / name / picture / google_id on success,
    or None if the token is invalid, expired, or the audience doesn't match.
    """
    if not GOOGLE_OAUTH_CLIENT_ID:
        logger.error(
            "[Google OAuth] GOOGLE_OAUTH_CLIENT_ID is not configured. "
            "Set it in your Railway environment variables (or local .env)."
        )
        return None

    if not token or not token.strip():
        logger.warning("[Google OAuth] Empty token received")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                _GOOGLE_TOKENINFO_URL,
                params={"id_token": token},
            )

        if response.status_code != 200:
            body = response.text[:200]  # avoid logging huge payloads
            logger.warning(
                f"[Google OAuth] Token verification failed — "
                f"status={response.status_code} body={body}"
            )
            return None

        token_info: dict = response.json()

        # ── Verify the token was issued FOR our app ──────────────────────────
        audience = token_info.get("aud") or token_info.get("azp")
        if audience != GOOGLE_OAUTH_CLIENT_ID:
            logger.warning(
                f"[Google OAuth] Audience mismatch: got '{audience}', "
                f"expected '{GOOGLE_OAUTH_CLIENT_ID}'"
            )
            return None

        # ── Check expiration ─────────────────────────────────────────────────
        expires_at = int(token_info.get("exp", 0))
        now = int(datetime.now(timezone.utc).timestamp())
        if now > expires_at:
            logger.warning("[Google OAuth] Token is expired")
            return None

        # ── Require verified email ───────────────────────────────────────────
        email = token_info.get("email")
        if not email:
            logger.warning("[Google OAuth] Token contains no email")
            return None

        email_verified = token_info.get("email_verified", "false")
        if str(email_verified).lower() != "true":
            logger.warning(f"[Google OAuth] Email not verified for {email}")
            return None

        return {
            "email": email,
            "name": token_info.get("name"),
            "picture": token_info.get("picture"),
            # Google uses 'sub' as the stable unique user identifier
            "google_id": token_info.get("sub"),
        }

    except httpx.TimeoutException:
        logger.error("[Google OAuth] Token verification request timed out")
        return None
    except Exception as e:
        logger.error(f"[Google OAuth] Token verification error: {e}", exc_info=True)
        return None


async def get_or_create_google_user(
    session: AsyncSession,
    email: str,
    name: str,
    picture_url: Optional[str] = None,
    google_id: Optional[str] = None,
) -> Optional[User]:
    """
    Get existing user by email or create a new Google OAuth user.
    Returns User object or None on error.
    """
    try:
        # Check if user already exists
        stmt = select(User).where(User.email == email.lower().strip())
        result = await session.execute(stmt)
        existing_user = result.scalars().first()

        if existing_user:
            # Backfill Google-specific fields if they weren't set before
            if picture_url and not existing_user.profile_picture_url:
                existing_user.profile_picture_url = picture_url
            if google_id and not existing_user.google_id:
                existing_user.google_id = google_id
            return existing_user

        # Create a brand-new Google-authenticated user
        import uuid as _uuid

        user = User(
            id=_uuid.uuid4(),
            email=email.lower().strip(),
            username=_generate_username_from_email(email),
            display_name=name or email.split("@")[0],
            google_id=google_id,
            profile_picture_url=picture_url,
            email_verified=True,  # Google guarantees email verification
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.flush()
        logger.info(f"[Google OAuth] Created new user: {email}")
        return user

    except Exception as e:
        logger.error(f"[Google OAuth] Error creating/updating user: {e}", exc_info=True)
        return None


def _generate_username_from_email(email: str) -> str:
    """Generate a unique username from an email address."""
    import uuid

    base_username = email.split("@")[0].replace(".", "").lower()[:20]
    unique_suffix = str(uuid.uuid4())[:8]
    return f"{base_username}_{unique_suffix}"
