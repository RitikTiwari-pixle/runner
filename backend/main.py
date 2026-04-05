"""
Territory Runner — FastAPI Backend Entry Point

Run in dev:  uvicorn main:app --reload --port 8000
Run in prod: gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
"""

import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.runs import router as runs_router
from routes.territories import router as territory_router
from routes.social import router as social_router
from routes.progression import router as progression_router
from routes.auth import router as auth_router

load_dotenv()

# ─── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan (startup / shutdown) ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Territory Runner API starting up")
    yield
    logger.info("🛑 Territory Runner API shutting down")


app = FastAPI(
    title="Territory Runner API",
    description="Backend API for the Territory Runner gamified running app",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(territory_router, prefix="/api")
app.include_router(social_router, prefix="/api")
app.include_router(progression_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to the Territory Runner API! Go to /docs for the interactive API documentation."}
