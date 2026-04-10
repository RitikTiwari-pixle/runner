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

# SQLAlchemy async engine requires the asyncpg dialect in the URL.
# Convert plain PostgreSQL URLs automatically to avoid startup/runtime failures.
if DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

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
