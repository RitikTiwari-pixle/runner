import asyncio
from sqlalchemy import text
from db import engine

async def clean():
    print("🧹 Cleaning up partial database tables...")
    
    # Put all our drop commands into a list
    statements = [
        "DROP MATERIALIZED VIEW IF EXISTS leaderboard_global CASCADE",
        "DROP TABLE IF EXISTS training_plans CASCADE",
        "DROP TABLE IF EXISTS user_challenges CASCADE",
        "DROP TABLE IF EXISTS challenges CASCADE",
        "DROP TABLE IF EXISTS activities CASCADE",
        "DROP TABLE IF EXISTS follows CASCADE",
        "DROP TABLE IF EXISTS disputes CASCADE",
        "DROP TABLE IF EXISTS territories CASCADE",
        "DROP TABLE IF EXISTS run_points CASCADE",
        "DROP TABLE IF EXISTS runs CASCADE",
        "DROP TABLE IF EXISTS users CASCADE"
    ]
    
    async with engine.begin() as conn:
        for stmt in statements:
            # Execute them one by one
            await conn.execute(text(stmt))
            
    print("✅ Database wiped clean successfully!")

if __name__ == "__main__":
    asyncio.run(clean())