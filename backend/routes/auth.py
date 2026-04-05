"""
Auth Routes

Local auth endpoints support:
- Email-based signup with OTP verification
- Username/email login with JWT
- Password reset via OTP
- Google OAuth login
"""

import os
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models.run import User
from middleware.auth import get_current_user
from services import auth_service
from services.google_oauth_service import verify_google_token, get_or_create_google_user

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"


class RegisterRequest(BaseModel):
    token: str
    username: str | None = None
    display_name: str | None = None


class AuthResponse(BaseModel):
    user_id: str
    username: str
    is_new: bool


class LocalRegisterRequest(BaseModel):
    email: str
    username: str
    password: str = Field(min_length=8)
    display_name: str | None = None
    city: str | None = None
    state: str | None = None


class LocalLoginRequest(BaseModel):
    identifier: str
    password: str


class LocalRegisterResponse(BaseModel):
    user_id: str
    username: str
    email: str
    requires_verification: bool
    message: str


class LocalAuthResponse(BaseModel):
    token: str
    user_id: str
    username: str
    email: str | None = None
    email_verified: bool | None = None
    level: int | None = None
    total_distance_m: float | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str
    purpose: Literal["signup", "password_reset"]
    new_password: str | None = None


class ResendOtpRequest(BaseModel):
    email: str
    purpose: Literal["signup", "password_reset"]


class GoogleOAuthLoginRequest(BaseModel):
    id_token: str


class GoogleOAuthLoginResponse(BaseModel):
    token: str
    user_id: str
    username: str
    email: str
    display_name: str | None = None
    profile_picture_url: str | None = None
    is_new: bool


class MessageResponse(BaseModel):
    message: str


@router.get("/me", response_model=LocalAuthResponse)
async def get_current_user_info(
    request: Request,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user's info. Returns user profile and session details."""
    user_id = request.state.user_id
    try:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            raise HTTPException(status_code=404, detail="User not found")
        return LocalAuthResponse(
            token="",  # Token not returned on /me endpoint (already authenticated)
            user_id=str(user_obj.id),
            username=user_obj.username,
            email=user_obj.email,
            email_verified=user_obj.email_verified,
            level=user_obj.level,
            total_distance_m=user_obj.total_distance_m,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    claims = await auth_service.verify_token(req.token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    try:
        result = await auth_service.register_or_login(
            db,
            firebase_uid=claims["firebase_uid"],
            username=req.username,
            display_name=req.display_name or claims.get("name"),
            phone=claims.get("phone"),
            email=claims.get("email"),
        )
        return AuthResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
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


class DevRegisterRequest(BaseModel):
    username: str
    display_name: str | None = None
    city: str | None = None
    state: str | None = None
    email: str | None = None


@router.post("/dev-register", response_model=AuthResponse)
async def dev_register(req: DevRegisterRequest, db: AsyncSession = Depends(get_db)):
    if not SKIP_AUTH:
        raise HTTPException(status_code=403, detail="Dev registration disabled in production")

    dev_uid = f"dev_{req.username}"
    try:
        result = await auth_service.register_or_login(
            db,
            firebase_uid=dev_uid,
            username=req.username,
            display_name=req.display_name or req.username,
            email=req.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if req.city or req.state:
        await db.execute(
            update(User)
            .where(User.firebase_uid == dev_uid)
            .values(city=req.city, state=req.state)
        )

    return AuthResponse(**result)


@router.post("/local/register", response_model=LocalRegisterResponse, status_code=201)
async def register_local(req: LocalRegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.register_local(
            db,
            username=req.username,
            password=req.password,
            email=req.email,
            display_name=req.display_name,
            city=req.city,
            state=req.state,
        )
        return LocalRegisterResponse(**result)
    except ValueError as exc:
        message = str(exc)
        status = 409 if "already" in message.lower() else 400
        raise HTTPException(status_code=status, detail=message)


@router.post("/local/login", response_model=LocalAuthResponse)
async def login_local(req: LocalLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.login_local(
            db,
            identifier=req.identifier,
            password=req.password,
        )
        return LocalAuthResponse(**result)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.post("/local/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.request_password_reset_otp(db, req.email)
        return MessageResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/local/verify-otp", response_model=LocalAuthResponse | MessageResponse)
async def verify_otp(req: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.verify_email_otp(
            db,
            email=req.email,
            purpose=req.purpose,
            otp_code=req.otp_code,
            new_password=req.new_password,
        )
        # Return LocalAuthResponse for signup, MessageResponse for password_reset
        if "message" in result:
            return MessageResponse(**result)
        return LocalAuthResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/local/resend-otp", response_model=MessageResponse)
async def resend_otp(req: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.resend_email_otp(
            db,
            email=req.email,
            purpose=req.purpose,
        )
        return MessageResponse(**result)
    except ValueError as exc:
        message = str(exc)
        status = 409 if "already verified" in message.lower() else 400
        raise HTTPException(status_code=status, detail=message)


@router.post("/google/login", response_model=GoogleOAuthLoginResponse)
async def google_oauth_login(req: GoogleOAuthLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login or register user with Google OAuth.
    Expects a valid Google ID token from the frontend.
    """
    try:
        # Verify Google token
        google_profile = await verify_google_token(req.id_token)
        if not google_profile:
            raise HTTPException(status_code=401, detail="Invalid or expired Google token")
        
        email = google_profile.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google account email is required")
        
        # Get or create user
        user = await get_or_create_google_user(
            db,
            email=email,
            name=google_profile.get("name"),
            picture_url=google_profile.get("picture"),
            google_id=google_profile.get("google_id"),
        )
        
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user account")
        
        # Commit changes
        await db.commit()
        
        # Generate JWT token
        token = auth_service.create_jwt_token(str(user.id))
        is_new = False  # Check if user has completed profile
        if not user.display_name or not user.city:
            is_new = True
        
        return GoogleOAuthLoginResponse(
            token=token,
            user_id=str(user.id),
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            profile_picture_url=user.profile_picture_url,
            is_new=is_new,
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Google OAuth] Login error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")
