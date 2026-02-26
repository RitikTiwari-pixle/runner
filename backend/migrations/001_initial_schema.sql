-- Territory Runner — Initial Database Schema
-- Requires: PostgreSQL 16+ with PostGIS extension

-- ─── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Users ──────────────────────────────────────────────────────
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid        VARCHAR(128) UNIQUE NOT NULL,
    username            VARCHAR(30) UNIQUE NOT NULL,
    display_name        VARCHAR(100),
    phone               VARCHAR(15),
    avatar_url          TEXT,
    city                VARCHAR(100),
    state               VARCHAR(50),
    country             VARCHAR(3) DEFAULT 'IND',
    xp                  INTEGER DEFAULT 0,
    level               INTEGER DEFAULT 1,
    total_distance_m    DOUBLE PRECISION DEFAULT 0,
    total_duration_s    INTEGER DEFAULT 0,
    total_territory_sqm DOUBLE PRECISION DEFAULT 0,
    is_banned           BOOLEAN DEFAULT FALSE,
    cheat_flags         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Runs ───────────────────────────────────────────────────────
CREATE TABLE runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ,
    duration_s          INTEGER,
    distance_m          DOUBLE PRECISION,
    avg_pace_s_per_km   DOUBLE PRECISION,
    max_speed_mps       DOUBLE PRECISION,
    calories            INTEGER,
    difficulty          VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    photo_urls          TEXT[],
    notes               TEXT,
    is_valid            BOOLEAN DEFAULT TRUE,
    cheat_reason        VARCHAR(50),
    route               GEOMETRY(LINESTRING, 4326),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_runs_user ON runs(user_id);
CREATE INDEX idx_runs_started ON runs(started_at DESC);
CREATE INDEX idx_runs_route ON runs USING GIST(route);

-- ─── GPS Breadcrumbs ────────────────────────────────────────────
CREATE TABLE run_points (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    seq                 INTEGER NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    altitude_m          DOUBLE PRECISION,
    speed_mps           DOUBLE PRECISION,
    accuracy_m          DOUBLE PRECISION,
    timestamp           TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_run_points_run ON run_points(run_id, seq);

-- ─── Territories (captured polygons) ────────────────────────────
CREATE TABLE territories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id),
    run_id              UUID NOT NULL REFERENCES runs(id),
    polygon             GEOMETRY(POLYGON, 4326) NOT NULL,
    area_sqm            DOUBLE PRECISION NOT NULL,
    captured_at         TIMESTAMPTZ DEFAULT NOW(),
    stolen_from_id      UUID REFERENCES users(id),
    is_active           BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_territories_polygon ON territories USING GIST(polygon);
CREATE INDEX idx_territories_owner ON territories(owner_id);

-- ─── Disputes ───────────────────────────────────────────────────
CREATE TABLE disputes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id        UUID NOT NULL REFERENCES territories(id),
    loser_id            UUID NOT NULL REFERENCES users(id),
    winner_id           UUID NOT NULL REFERENCES users(id),
    area_lost_sqm       DOUBLE PRECISION NOT NULL,
    notified            BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Social: Follows ────────────────────────────────────────────
CREATE TABLE follows (
    follower_id         UUID NOT NULL REFERENCES users(id),
    following_id        UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- ─── Activity Feed ──────────────────────────────────────────────
CREATE TABLE activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    type                VARCHAR(30) NOT NULL,
    run_id              UUID REFERENCES runs(id),
    territory_id        UUID REFERENCES territories(id),
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activities_user ON activities(user_id, created_at DESC);

-- ─── Challenges ─────────────────────────────────────────────────
CREATE TABLE challenges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(100) NOT NULL,
    description         TEXT,
    type                VARCHAR(20) NOT NULL,
    target_value        DOUBLE PRECISION NOT NULL,
    xp_reward           INTEGER NOT NULL,
    city                VARCHAR(100),
    state               VARCHAR(50),
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    prize_desc          TEXT,
    is_active           BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_challenges (
    user_id             UUID NOT NULL REFERENCES users(id),
    challenge_id        UUID NOT NULL REFERENCES challenges(id),
    progress            DOUBLE PRECISION DEFAULT 0,
    completed           BOOLEAN DEFAULT FALSE,
    completed_at        TIMESTAMPTZ,
    PRIMARY KEY (user_id, challenge_id)
);

-- ─── Training Plans ─────────────────────────────────────────────
CREATE TABLE training_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    plan_type           VARCHAR(20) NOT NULL,
    current_week        INTEGER DEFAULT 1,
    total_weeks         INTEGER NOT NULL,
    schedule            JSONB NOT NULL,
    fitness_level       VARCHAR(20) DEFAULT 'beginner',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Leaderboard (materialized view) ────────────────────────────
CREATE MATERIALIZED VIEW leaderboard_global AS
    SELECT id, username, display_name, avatar_url, city, state,
           total_territory_sqm, total_distance_m, xp, level
    FROM users
    WHERE is_banned = FALSE
    ORDER BY total_territory_sqm DESC;

CREATE UNIQUE INDEX idx_leaderboard_global_id ON leaderboard_global(id);
