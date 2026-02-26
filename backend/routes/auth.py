"""
Auth Routes — Registration and token-based login.

POST /auth/register  → Register new user after Firebase authentication
POST /auth/login     → Verify token and return user info
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

security = HTTPBearer()


class RegisterRequest(BaseModel):
    token: str  # Firebase ID token
    username: str | None = None
    display_name: str | None = None


class AuthResponse(BaseModel):
    user_id: str
    username: str
    is_new: bool


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register or login. First, verifies the Firebase token.
    If the user doesn't exist, creates a new account.
    If they do, returns their existing info.
    """
    claims = await auth_service.verify_token(req.token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    result = await auth_service.register_or_login(
        db,
        firebase_uid=claims["firebase_uid"],
        username=req.username,
        display_name=req.display_name or claims.get("name"),
        phone=claims.get("phone"),
    )
    return AuthResponse(**result)


@router.post("/login", response_model=AuthResponse)
async def login(credentials: HTTPAuthorizationCredentials = Depends(security),
                db: AsyncSession = Depends(get_db)):
    """
    Verify Firebase token and return user info.
    The mobile app calls this on startup with the stored token.
    """
    claims = await auth_service.verify_token(credentials.credentials)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await auth_service.get_user_by_firebase_uid(db, claims["firebase_uid"])
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")

    return AuthResponse(
        user_id=str(user.id),
        username=user.username,
        is_new=False,
    )


# ─── Dev-mode registration (no Firebase required) ───────────
import os
SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"


class DevRegisterRequest(BaseModel):
    username: str
    display_name: str | None = None
    city: str | None = None
    state: str | None = None


@router.post("/dev-register", response_model=AuthResponse)
async def dev_register(req: DevRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Dev-mode registration — creates a real user without Firebase.
    Only available when SKIP_AUTH=true.
    """
    if not SKIP_AUTH:
        raise HTTPException(status_code=403, detail="Dev registration disabled in production")

    # Use username as a unique firebase_uid stand-in
    dev_uid = f"dev_{req.username}"

    result = await auth_service.register_or_login(
        db,
        firebase_uid=dev_uid,
        username=req.username,
        display_name=req.display_name or req.username,
    )

    # Update city/state if provided
    if req.city or req.state:
        from sqlalchemy import select, update
        from models.run import User
        stmt = update(User).where(User.firebase_uid == dev_uid).values(
            city=req.city, state=req.state
        )
        await db.execute(stmt)

    await db.commit()
    return AuthResponse(**result)
