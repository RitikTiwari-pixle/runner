"""
Authentication Middleware

Supports both Firebase JWT and local JWT authentication.
Extracts JWT token from the Authorization header and verifies it.
Attaches the authenticated user to the request state.

Usage: Add as dependency to protected routes.

IMPORTANT: In development, if SKIP_AUTH=true is set in .env,
           all requests pass through without authentication.
"""

import os
import uuid
import logging
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import auth_service
from models.run import User
from sqlalchemy import select

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Dependency that extracts and verifies the JWT token (supports both local and Firebase).

    Priority:
    1. Try local JWT token (created by /auth/local/login or /auth/local/register)
    2. Fall back to Firebase JWT token
    3. In dev mode (SKIP_AUTH=true), skip auth entirely

    Attaches user info to request.state for use in route handlers.

    Usage in routes:
        @router.get("/protected")
        async def protected_endpoint(user = Depends(get_current_user), request: Request = ...):
            user_id = request.state.user_id
    """
    if SKIP_AUTH:
        # Dev mode: attach a placeholder user_id
        request.state.user_id = request.headers.get("X-User-Id", "dev-user")
        request.state.firebase_uid = "dev-uid"
        return {"user_id": request.state.user_id, "firebase_uid": "dev-uid"}

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = credentials.credentials

    # Try local JWT first
    local_claims = auth_service.verify_jwt_token(token)
    if local_claims:
        user_id = local_claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token format")

        # Look up user by user_id
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid token subject") from exc

        result = await db.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=403, detail="User not found")

        request.state.user_id = str(user.id)
        request.state.firebase_uid = user.firebase_uid or "local"
        return {"user_id": str(user.id), "firebase_uid": user.firebase_uid}

    # Fall back to Firebase JWT
    firebase_claims = await auth_service.verify_token(token)
    if firebase_claims:
        user = await auth_service.get_user_by_firebase_uid(db, firebase_claims["firebase_uid"])
        if not user:
            raise HTTPException(status_code=403, detail="User not registered. Call /auth/register first.")

        request.state.user_id = str(user.id)
        request.state.firebase_uid = firebase_claims["firebase_uid"]
        return {"user_id": str(user.id), "firebase_uid": firebase_claims["firebase_uid"]}

    # Neither local nor Firebase token is valid
    raise HTTPException(status_code=401, detail="Invalid or expired token")
