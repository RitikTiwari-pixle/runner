"""
Firebase Authentication Service

Verifies Firebase ID tokens and manages user registration.
Used by the auth middleware to protect all API routes.
"""

import os
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import User

logger = logging.getLogger(__name__)

# Firebase Admin SDK initialization
_firebase_initialized = False

def _init_firebase():
    """Initialize Firebase Admin SDK (lazy, once)."""
    global _firebase_initialized
    if _firebase_initialized:
        return

    try:
        import firebase_admin
        from firebase_admin import credentials as fb_credentials

        creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "credentials.json")
        if os.path.exists(creds_path):
            cred = fb_credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
            logger.info("[Auth] Firebase Admin SDK initialized")
        else:
            # Initialize without credentials (for dev/testing)
            firebase_admin.initialize_app()
            logger.warning("[Auth] Firebase initialized without credentials (dev mode)")

        _firebase_initialized = True
    except Exception as e:
        logger.error(f"[Auth] Firebase initialization failed: {e}")


async def verify_token(token: str) -> dict | None:
    """
    Verify a Firebase ID token.
    Returns the decoded token claims or None if invalid.
    """
    _init_firebase()

    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(token)
        return {
            "firebase_uid": decoded["uid"],
            "email": decoded.get("email"),
            "phone": decoded.get("phone_number"),
            "name": decoded.get("name"),
        }
    except Exception as e:
        logger.warning(f"[Auth] Token verification failed: {e}")
        return None


async def register_or_login(db: AsyncSession, firebase_uid: str, username: str | None = None,
                             display_name: str | None = None, phone: str | None = None) -> dict:
    """
    Register a new user or return existing user.
    Called after successful Firebase authentication.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user:
        return {
            "user_id": str(user.id),
            "username": user.username,
            "is_new": False,
        }

    # Create new user
    if not username:
        username = f"runner_{uuid.uuid4().hex[:8]}"

    user = User(
        firebase_uid=firebase_uid,
        username=username,
        display_name=display_name or username,
        phone=phone,
    )
    db.add(user)
    await db.flush()

    return {
        "user_id": str(user.id),
        "username": user.username,
        "is_new": True,
    }


async def get_user_by_firebase_uid(db: AsyncSession, firebase_uid: str) -> User | None:
    """Look up our internal user from their Firebase UID."""
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    return result.scalar_one_or_none()
