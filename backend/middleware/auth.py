"""
Authentication Middleware

Extracts Firebase JWT from the Authorization header and verifies it.
Attaches the authenticated user to the request state.

Usage: Add as dependency to protected routes.

IMPORTANT: In development, if SKIP_AUTH=true is set in .env,
           all requests pass through without authentication.
"""

import os
import logging
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import auth_service

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Dependency that extracts and verifies the Firebase JWT token.

    In dev mode (SKIP_AUTH=true), returns a mock user or skips auth entirely.

    Usage in routes:
        @router.get("/protected")
        async def protected_endpoint(user = Depends(get_current_user)):
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
    claims = await auth_service.verify_token(token)

    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Look up our internal user
    user = await auth_service.get_user_by_firebase_uid(db, claims["firebase_uid"])
    if not user:
        raise HTTPException(status_code=403, detail="User not registered. Call /auth/register first.")

    request.state.user_id = str(user.id)
    request.state.firebase_uid = claims["firebase_uid"]

    return {"user_id": str(user.id), "firebase_uid": claims["firebase_uid"]}
