"""
Database connection setup.
Async SQLAlchemy engine with PostGIS support via GeoAlchemy2.
"""

import os
from typing import AsyncGenerator
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

def normalize_database_url(raw_url: str) -> str:
    url = raw_url.strip()
    if url.startswith("postgres://"):
        # Railway-style URL alias
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        # Force async driver for SQLAlchemy async engine
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


DATABASE_URL = normalize_database_url(os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/territory_runner",
))

if not DATABASE_URL.startswith("postgresql+asyncpg://"):
    raise RuntimeError(
        "DATABASE_URL must resolve to postgresql+asyncpg:// for async SQLAlchemy engine."
    )

# Engine configured for async operations
engine = create_async_engine(
    DATABASE_URL, 
    echo=False, 
    pool_size=20, 
    max_overflow=10
)

# Session factory bound to the async engine
async_session = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass

# FIX: Added correct typing for a yield dependency (AsyncGenerator)
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()
