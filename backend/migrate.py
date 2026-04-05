"""
Database migration runner for SQL files in backend/migrations.

Key behaviors:
- Tracks applied migrations in schema_migrations.
- Handles existing databases by baselining obvious already-applied migrations.
- Executes SQL statements one-by-one so one duplicate object does not block later migrations.
"""

import asyncio
import logging
import os
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from db import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("migrator")

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")
MIGRATION_TABLE = "schema_migrations"

# PostgreSQL SQLSTATE codes for duplicate object cases.
_DUPLICATE_SQLSTATES = {
    "42P07",  # duplicate_table / relation already exists
    "42710",  # duplicate_object
    "42701",  # duplicate_column
}


def _split_sql_statements(sql_script: str) -> list[str]:
    """Split a SQL file into executable statements."""
    lines: list[str] = []
    for raw_line in sql_script.splitlines():
        if raw_line.strip().startswith("--"):
            continue
        lines.append(raw_line)
    return [stmt.strip() for stmt in "\n".join(lines).split(";") if stmt.strip()]


async def _ensure_migration_table(conn) -> None:
    await conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE} (
            migration_name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))


async def _get_applied_migrations(conn) -> set[str]:
    result = await conn.execute(text(f"SELECT migration_name FROM {MIGRATION_TABLE}"))
    return {row[0] for row in result.fetchall()}


async def _record_migration(conn, migration_name: str) -> None:
    await conn.execute(
        text(f"""
            INSERT INTO {MIGRATION_TABLE} (migration_name)
            VALUES (:migration_name)
            ON CONFLICT (migration_name) DO NOTHING
        """),
        {"migration_name": migration_name},
    )


async def _table_exists(conn, table_name: str) -> bool:
    result = await conn.execute(
        text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :table_name
            LIMIT 1
        """),
        {"table_name": table_name},
    )
    return result.first() is not None


async def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = await conn.execute(
        text("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
        """),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.first() is not None


async def _migration_baselined(conn, migration_name: str) -> bool:
    """
    Detect clearly-applied legacy migrations for databases that predate migration tracking.
    """
    if migration_name == "001_initial_schema.sql":
        required_tables = ("users", "runs", "run_points", "territories", "disputes")
        return all([await _table_exists(conn, table) for table in required_tables])

    if migration_name == "002_social_progression.sql":
        required_tables = ("follows", "activities", "challenges", "user_challenges")
        if not all([await _table_exists(conn, table) for table in required_tables]):
            return False
        # This seeded title is part of migration 002.
        result = await conn.execute(
            text("SELECT 1 FROM challenges WHERE title = 'Mumbai Marathon Month' LIMIT 1")
        )
        return result.first() is not None

    if migration_name == "003_add_password_hash.sql":
        return await _column_exists(conn, "users", "password_hash")

    if migration_name == "004_email_otp_and_profile_enhancements.sql":
        return all([
            await _column_exists(conn, "users", "email"),
            await _column_exists(conn, "users", "email_verified"),
            await _column_exists(conn, "users", "territory_color"),
            await _column_exists(conn, "runs", "source"),
            await _table_exists(conn, "email_otp_codes"),
        ])

    return False


def _is_duplicate_object_error(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    sqlstate = getattr(exc.orig, "sqlstate", None)
    return sqlstate in _DUPLICATE_SQLSTATES


async def _execute_migration_file(conn, migration_name: str, statements: Iterable[str]) -> None:
    for index, statement in enumerate(statements, start=1):
        try:
            await conn.execute(text(statement))
        except Exception as exc:
            if _is_duplicate_object_error(exc):
                logger.warning(
                    "Skipping duplicate object in %s (statement %s): %s",
                    migration_name,
                    index,
                    exc,
                )
                continue
            raise


async def run_migrations() -> None:
    logger.info("Starting database migrations")

    if not os.path.exists(MIGRATIONS_DIR):
        logger.error("Migrations directory not found at %s", MIGRATIONS_DIR)
        return

    migration_files = sorted([name for name in os.listdir(MIGRATIONS_DIR) if name.endswith(".sql")])
    if not migration_files:
        logger.info("No migration files found")
        return

    try:
        async with engine.begin() as conn:
            await _ensure_migration_table(conn)
            applied = await _get_applied_migrations(conn)

            for file_name in migration_files:
                if file_name in applied:
                    logger.info("Skipping already applied migration: %s", file_name)
                    continue

                if await _migration_baselined(conn, file_name):
                    logger.info("Baselining migration as already applied: %s", file_name)
                    await _record_migration(conn, file_name)
                    applied.add(file_name)
                    continue

                file_path = os.path.join(MIGRATIONS_DIR, file_name)
                logger.info("Applying migration: %s", file_name)

                with open(file_path, "r", encoding="utf-8") as migration_file:
                    sql_content = migration_file.read()

                statements = _split_sql_statements(sql_content)
                await _execute_migration_file(conn, file_name, statements)
                await _record_migration(conn, file_name)
                applied.add(file_name)
                logger.info("Applied migration: %s", file_name)

        logger.info("All migrations completed successfully")
    except Exception as exc:
        logger.error("Migration failed: %s", exc)
        raise
    finally:
        await engine.dispose()
        logger.info("Database connection closed")


if __name__ == "__main__":
    asyncio.run(run_migrations())
