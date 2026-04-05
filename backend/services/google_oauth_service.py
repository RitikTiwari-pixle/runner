"""
Google OAuth Service

Handles Google OAuth token verification and user profile extraction.
Uses authlib for OAuth token validation.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.run import User

logger = logging.getLogger(__name__)

GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")


async def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify Google ID token and extract user info.
    Returns user profile data if token is valid, None otherwise.
    """
    if not GOOGLE_OAUTH_CLIENT_ID:
        logger.error("[Google OAuth] GOOGLE_OAUTH_CLIENT_ID not configured")
        return None
    
    try:
        # Use Google's tokeninfo endpoint to verify token
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/oauth2/v1/tokeninfo?id_token={token}",
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.warning(f"[Google OAuth] Token verification failed: {response.status_code}")
                return None
            
            token_info = response.json()
            
            # Verify audience (client_id)
            if token_info.get("aud") != GOOGLE_OAUTH_CLIENT_ID:
                logger.warning("[Google OAuth] Token audience mismatch")
                return None
            
            # Check expiration
            expires_at = int(token_info.get("exp", 0))
            now = int(datetime.now(timezone.utc).timestamp())
            if now > expires_at:
                logger.warning("[Google OAuth] Token is expired")
                return None
            
            return {
                "email": token_info.get("email"),
                "name": token_info.get("name"),
                "picture": token_info.get("picture"),
                "google_id": token_info.get("sub"),
            }
    except Exception as e:
        logger.error(f"[Google OAuth] Token verification error: {e}")
        return None


async def get_or_create_google_user(
    session: AsyncSession,
    email: str,
    name: str,
    picture_url: Optional[str] = None,
    google_id: Optional[str] = None,
) -> Optional[User]:
    """
    Get existing user by email or create new Google OAuth user.
    Returns User object or None on error.
    """
    try:
        # Check if user exists
        stmt = select(User).where(User.email == email.lower().strip())
        result = await session.execute(stmt)
        existing_user = result.scalars().first()
        
        if existing_user:
            # Update profile if coming from Google OAuth
            if picture_url and not existing_user.profile_picture_url:
                existing_user.profile_picture_url = picture_url
            if google_id and not existing_user.google_id:
                existing_user.google_id = google_id
            return existing_user
        
        # Create new user from Google profile
        import uuid as _uuid
        user = User(
            id=_uuid.uuid4(),
            email=email.lower().strip(),
            username=_generate_username_from_email(email),
            display_name=name or email.split("@")[0],
            google_id=google_id,
            profile_picture_url=picture_url,
            email_verified=True,  # Google email is already verified
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.flush()
        return user
        
    except Exception as e:
        logger.error(f"[Google OAuth] Error creating/updating user: {e}")
        return None


def _generate_username_from_email(email: str) -> str:
    """Generate a unique username from email address"""
    import uuid
    base_username = email.split("@")[0].replace(".", "").lower()[:20]
    unique_suffix = str(uuid.uuid4())[:8]
    return f"{base_username}_{unique_suffix}"
