-- Migration 005: Add performance indexes for leaderboard and sorting

-- Leaderboard query indexes
CREATE INDEX IF NOT EXISTS idx_users_total_territory_sqm_desc 
    ON users (total_territory_sqm DESC) 
    WHERE is_banned = FALSE;

CREATE INDEX IF NOT EXISTS idx_users_total_distance_m_desc 
    ON users (total_distance_m DESC) 
    WHERE is_banned = FALSE;

CREATE INDEX IF NOT EXISTS idx_users_xp_desc 
    ON users (xp DESC) 
    WHERE is_banned = FALSE;

-- City/State filtering with sorting
CREATE INDEX IF NOT EXISTS idx_users_city_territory 
    ON users (city, total_territory_sqm DESC) 
    WHERE is_banned = FALSE AND city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_state_territory 
    ON users (state, total_territory_sqm DESC) 
    WHERE is_banned = FALSE AND state IS NOT NULL;

-- Anti-cheat and query optimization
CREATE INDEX IF NOT EXISTS idx_users_is_banned 
    ON users (is_banned);

-- Territory query optimization
CREATE INDEX IF NOT EXISTS idx_territories_owner_active 
    ON territories (owner_id, is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_territories_captured_at 
    ON territories (captured_at DESC);

-- Activity feed optimization (note: table is "activities", not "activity")
CREATE INDEX IF NOT EXISTS idx_activities_user_created 
    ON activities (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_created_at 
    ON activities (created_at DESC);

-- Follow system optimization (note: table is "follows", not "follow")
CREATE INDEX IF NOT EXISTS idx_follow_follower_following 
    ON follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_follow_following_id 
    ON follows (following_id);

-- Run query optimization
CREATE INDEX IF NOT EXISTS idx_run_user_started 
    ON runs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_is_valid 
    ON runs (is_valid) 
    WHERE is_valid = TRUE;
