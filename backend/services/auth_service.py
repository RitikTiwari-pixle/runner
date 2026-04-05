"""
Authentication Service

Supports:
- Firebase token verification (legacy / optional)
- Local username/email + password login
- Email OTP verification for signup and password reset
"""

import hashlib
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.run import EmailOTPCode, User
from services.email_service import send_otp_email

logger = logging.getLogger(__name__)

try:
    import bcrypt
except ImportError:  # optional dependency
    bcrypt = None

# Use pbkdf2 for new passwords (stable across environments).
# Keep legacy bcrypt verification support in verify_password().
_pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
_firebase_initialized = False

OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    value = email.strip().lower()
    if not EMAIL_RE.fullmatch(value):
        raise ValueError("Please enter a valid email address")
    return value


def _normalize_username(username: str) -> str:
    value = username.strip().lower()
    if len(value) < 3 or len(value) > 30:
        raise ValueError("Username must be between 3 and 30 characters")
    if not re.fullmatch(r"[a-z0-9_]+", value):
        raise ValueError("Username can contain only letters, numbers, and underscore")
    return value


def _otp_debug_enabled() -> bool:
    return (
        os.getenv("OTP_DEBUG_MODE", "false").lower() == "true"
        or os.getenv("SKIP_AUTH", "false").lower() == "true"
    )


def _otp_hash(email: str, purpose: str, code: str) -> str:
    secret = os.getenv("OTP_SECRET_KEY", os.getenv("JWT_SECRET_KEY", "dev-otp-secret"))
    raw = f"{email}|{purpose}|{code}|{secret}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _create_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _prepare_bcrypt_password(plain_password: str) -> bytes:
    """
    bcrypt only supports up to 72 bytes.
    Pre-hash very long passwords to avoid backend-specific ValueError.
    """
    raw = plain_password.encode("utf-8")
    if len(raw) > 72:
        return hashlib.sha256(raw).hexdigest().encode("ascii")
    return raw


def hash_password(plain_password: str) -> str:
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$2a$") or hashed_password.startswith("$2b$") or hashed_password.startswith("$2y$"):
        if bcrypt is None:
            logger.warning("[Auth] bcrypt package is not installed; bcrypt hash verification is unavailable")
            return False
        try:
            return bcrypt.checkpw(_prepare_bcrypt_password(plain_password), hashed_password.encode("utf-8"))
        except Exception:
            return False
    try:
        return _pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_jwt_token(user_id: str, expires_in_days: int = 7) -> str:
    payload = {
        "sub": user_id,
        "iat": _now(),
        "exp": _now() + timedelta(days=expires_in_days),
        "jti": secrets.token_urlsafe(16),
    }
    secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    return jwt.encode(payload, secret_key, algorithm="HS256")


def verify_jwt_token(token: str) -> dict | None:
    try:
        secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        return jwt.decode(token, secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        logger.warning("[Auth] JWT token has expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.warning("[Auth] Invalid JWT token: %s", exc)
        return None


def _init_firebase() -> None:
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
            firebase_admin.initialize_app()
            logger.warning("[Auth] Firebase initialized without credentials (dev mode)")

        _firebase_initialized = True
    except Exception as exc:
        logger.error("[Auth] Firebase initialization failed: %s", exc)


async def verify_token(token: str) -> dict | None:
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
    except Exception as exc:
        logger.warning("[Auth] Token verification failed: %s", exc)
        return None


async def get_user_by_firebase_uid(db: AsyncSession, firebase_uid: str) -> User | None:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    return result.scalar_one_or_none()


async def register_or_login(
    db: AsyncSession,
    firebase_uid: str,
    username: str | None = None,
    display_name: str | None = None,
    phone: str | None = None,
    email: str | None = None,
) -> dict:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user:
        return {
            "user_id": str(user.id),
            "username": user.username,
            "is_new": False,
        }

    if not username:
        username = f"runner_{uuid.uuid4().hex[:8]}"

    normalized_username = _normalize_username(username)
    normalized_email = _normalize_email(email) if email else None

    user = User(
        firebase_uid=firebase_uid,
        username=normalized_username,
        display_name=display_name or normalized_username,
        phone=phone,
        email=normalized_email,
        email_verified=bool(normalized_email),
    )
    db.add(user)
    await db.flush()

    return {
        "user_id": str(user.id),
        "username": user.username,
        "is_new": True,
    }


async def _get_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    normalized = identifier.strip().lower()
    if "@" in normalized:
        result = await db.execute(select(User).where(func.lower(User.email) == normalized))
    else:
        result = await db.execute(select(User).where(func.lower(User.username) == normalized))
    return result.scalar_one_or_none()


async def _issue_otp(
    db: AsyncSession,
    *,
    email: str,
    purpose: str,
    user_id: uuid.UUID | None = None,
) -> dict:
    code = _create_otp_code()
    otp = EmailOTPCode(
        user_id=user_id,
        email=email,
        purpose=purpose,
        code_hash=_otp_hash(email, purpose, code),
        attempts=0,
        expires_at=_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp)
    await db.flush()

    delivered = await send_otp_email(email, code, purpose, OTP_EXPIRY_MINUTES)

    if not delivered:
        logger.warning("[Auth] OTP delivery not confirmed for %s (%s)", email, purpose)

    return {
        "delivered": delivered,
    }


async def register_local(
    db: AsyncSession,
    username: str,
    password: str,
    email: str,
    display_name: str | None = None,
    city: str | None = None,
    state: str | None = None,
) -> dict:
    normalized_username = _normalize_username(username)
    normalized_email = _normalize_email(email)

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    username_result = await db.execute(select(User).where(func.lower(User.username) == normalized_username))
    username_user = username_result.scalar_one_or_none()

    email_result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    email_user = email_result.scalar_one_or_none()

    if username_user and username_user.email_verified and username_user.email != normalized_email:
        raise ValueError("Username already exists")
    if email_user and email_user.email_verified and email_user.username != normalized_username:
        raise ValueError("Email is already registered")
    if username_user and email_user and username_user.id != email_user.id:
        raise ValueError("Username and email are already used by different accounts")

    user = email_user or username_user
    if user:
        if user.email_verified:
            raise ValueError("Account already verified. Please log in.")
        user.username = normalized_username
        user.email = normalized_email
        user.password_hash = hash_password(password)
        user.display_name = display_name or normalized_username
        user.city = city
        user.state = state
        user.email_verified = False
    else:
        user = User(
            firebase_uid=f"local_{uuid.uuid4().hex[:16]}",
            username=normalized_username,
            email=normalized_email,
            email_verified=False,
            password_hash=hash_password(password),
            display_name=display_name or normalized_username,
            city=city,
            state=state,
        )
        db.add(user)
        await db.flush()

    otp_result = await _issue_otp(db, email=normalized_email, purpose="signup", user_id=user.id)

    return {
        "user_id": str(user.id),
        "username": user.username,
        "email": normalized_email,
        "requires_verification": True,
        "message": "Verification code sent to your email.",
    }


async def login_local(db: AsyncSession, identifier: str, password: str) -> dict:
    if not identifier.strip():
        raise ValueError("Username or email is required")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    user = await _get_user_by_identifier(db, identifier)
    if not user or not user.password_hash:
        raise ValueError("Invalid credentials")

    if user.email and not user.email_verified:
        raise PermissionError("Email not verified. Please verify your email first.")

    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid credentials")

    token = create_jwt_token(str(user.id))
    return {
        "token": token,
        "user_id": str(user.id),
        "username": user.username,
        "email": user.email,
        "email_verified": user.email_verified,
        "level": user.level,
        "total_distance_m": user.total_distance_m,
    }


async def request_password_reset_otp(db: AsyncSession, email: str) -> dict:
    normalized_email = _normalize_email(email)
    message = "If an account exists for this email, a reset code has been sent."

    user_result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = user_result.scalar_one_or_none()
    if not user or not user.password_hash:
        return {"message": message}

    otp_result = await _issue_otp(
        db,
        email=normalized_email,
        purpose="password_reset",
        user_id=user.id,
    )
    return {
        "message": message,
    }


async def resend_email_otp(db: AsyncSession, email: str, purpose: str) -> dict:
    normalized_email = _normalize_email(email)
    if purpose not in {"signup", "password_reset"}:
        raise ValueError("Invalid OTP purpose")

    user_result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = user_result.scalar_one_or_none()

    # ─── Rate limiting: Max 3 resends per minute, 5 per hour ───
    recent_minute = await db.execute(
        select(func.count())
        .select_from(EmailOTPCode)
        .where(
            EmailOTPCode.email == normalized_email,
            EmailOTPCode.purpose == purpose,
            EmailOTPCode.created_at > _now() - timedelta(minutes=1),
        )
    )
    if recent_minute.scalar() >= 3:
        raise ValueError("Too many resend attempts. Please wait 1 minute and try again.")

    recent_hour = await db.execute(
        select(func.count())
        .select_from(EmailOTPCode)
        .where(
            EmailOTPCode.email == normalized_email,
            EmailOTPCode.purpose == purpose,
            EmailOTPCode.created_at > _now() - timedelta(hours=1),
        )
    )
    if recent_hour.scalar() >= 5:
        raise ValueError("Too many resend attempts today. Please try again in 1 hour.")

    if purpose == "signup":
        if not user:
            raise ValueError("No account found for this email")
        if user.email_verified:
            raise ValueError("Email is already verified. Please log in.")
        otp_result = await _issue_otp(db, email=normalized_email, purpose="signup", user_id=user.id)
    else:
        message = "If an account exists for this email, a reset code has been sent."
        if not user or not user.password_hash:
            return {"message": message}
        otp_result = await _issue_otp(
            db,
            email=normalized_email,
            purpose="password_reset",
            user_id=user.id,
        )

    return {
        "message": "Verification code resent successfully.",
    }


async def verify_email_otp(
    db: AsyncSession,
    *,
    email: str,
    purpose: str,
    otp_code: str,
    new_password: str | None = None,
) -> dict:
    normalized_email = _normalize_email(email)
    if purpose not in {"signup", "password_reset"}:
        raise ValueError("Invalid OTP purpose")
    if not re.fullmatch(r"\d{6}", otp_code):
        raise ValueError("OTP must be a 6-digit code")

    otp_result = await db.execute(
        select(EmailOTPCode)
        .where(
            EmailOTPCode.email == normalized_email,
            EmailOTPCode.purpose == purpose,
            EmailOTPCode.consumed_at.is_(None),
        )
        .order_by(EmailOTPCode.created_at.desc())
        .limit(1)
    )
    otp = otp_result.scalar_one_or_none()
    if not otp:
        raise ValueError("No active OTP found. Request a new code.")

    if otp.expires_at < _now():
        otp.consumed_at = _now()
        raise ValueError("OTP has expired. Request a new code.")

    if otp.attempts >= OTP_MAX_ATTEMPTS:
        otp.consumed_at = _now()
        raise ValueError("Too many invalid attempts. Request a new code.")

    expected_hash = _otp_hash(normalized_email, purpose, otp_code)
    if otp.code_hash != expected_hash:
        otp.attempts += 1
        if otp.attempts >= OTP_MAX_ATTEMPTS:
            otp.consumed_at = _now()
        raise ValueError("Invalid verification code")

    otp.consumed_at = _now()

    user_result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise ValueError("No account found for this email")

    if purpose == "signup":
        user.email_verified = True
        token = create_jwt_token(str(user.id))
        await db.flush()
        return {
            "token": token,
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "email_verified": True,
            "level": user.level,
            "total_distance_m": user.total_distance_m,
        }
    elif purpose == "password_reset":
        if not new_password:
            raise ValueError("New password is required for password reset")
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters")
        user.password_hash = hash_password(new_password)
        await db.flush()
        return {
            "message": "Password reset successfully. Please log in with your new password."
        }
    
    raise ValueError("Invalid OTP purpose")
