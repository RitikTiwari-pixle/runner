"""
Territory Runner — FastAPI Backend Entry Point
Run in dev:  uvicorn main:app --reload --port 8000
Run in prod: gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT
"""
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ─── FIX: Patch DATABASE_URL before any DB module is imported ────────────────
# Railway provides postgresql:// but asyncpg requires postgresql+asyncpg://
# Without this fix the app hangs on DB connect and gunicorn kills it at ~120s.
_db_url = os.environ.get("DATABASE_URL", "")
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    os.environ["DATABASE_URL"] = _db_url
elif _db_url.startswith("postgres://"):
    # Some Railway plans use the shorter alias
    _db_url = _db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    os.environ["DATABASE_URL"] = _db_url

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Routers — imported AFTER env patch so db.py picks up the fixed URL ──────
from routes.runs import router as runs_router
from routes.territories import router as territory_router
from routes.social import router as social_router
from routes.progression import router as progression_router
from routes.auth import router as auth_router


# ─── Lifespan (startup / shutdown) ───────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Territory Runner API starting up")
    logger.info("   DATABASE_URL prefix: %s", os.environ.get("DATABASE_URL", "NOT SET")[:40])

    # Test DB connectivity — clear error if unreachable
    try:
        from db import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection verified")
    except Exception as exc:
        logger.error("❌ Database connection failed at startup: %s", exc)
        logger.error("   Ensure DATABASE_URL is set and uses postgresql+asyncpg:// prefix")
        # We don't raise here — Railway will restart; DB might still be warming up

    yield
    logger.info("🛑 Territory Runner API shutting down")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Territory Runner API",
    description="Backend API for the Territory Runner gamified running app",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", "")
if _raw_origins.strip():
    _allowed_origins: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
else:
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=("*" not in _allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(territory_router, prefix="/api")
app.include_router(social_router, prefix="/api")
app.include_router(progression_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Territory Runner API! Go to /docs for the interactive API documentation."
    }
@app.get("/api")
async def api_root():
    return {
        "message": "Territory Runner API is running",
        "docs": "/docs",
        "health": "/health",
        "auth_register": "/api/auth/local/register",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway and monitoring tools."""
    import time
    from db import engine
    from sqlalchemy import text

    db_ok = False
    db_error = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        db_error = str(exc)

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else f"error: {db_error}",
        "timestamp": time.time(),
    }
