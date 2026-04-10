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

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:BvQDpEUsfJHXwqHBZOuKcWDyPyFdldum@maglev.proxy.rlwy.net:16797/railway"
)

def _normalize_async_database_url(raw_url: str) -> str:
    """
    Force PostgreSQL URLs to use asyncpg for SQLAlchemy async engine.

    Handles common provider URL variants:
    - postgres://...
    - postgresql://...
    - postgresql+psycopg2://...
    - postgresql+psycopg://...
    """
    value = (raw_url or "").strip()

    if value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql://", 1)

    if value.startswith("postgresql+psycopg2://"):
        value = value.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    elif value.startswith("postgresql+psycopg://"):
        value = value.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    elif value.startswith("postgresql://") and "+asyncpg" not in value:
        value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

    return value


DATABASE_URL = _normalize_async_database_url(DATABASE_URL)

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
