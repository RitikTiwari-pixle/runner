-- ═══════════════════════════════════════════════════════════════
-- Migration 002: Module 5 (Social) + Module 6 (Progression)
-- Run AFTER 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── Follows (social graph) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
    follower_id  UUID NOT NULL REFERENCES users(id),
    following_id UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ─── Activities (social feed) ────────────────────────────────

CREATE TABLE IF NOT EXISTS activities (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    type         VARCHAR(30) NOT NULL,
    run_id       UUID REFERENCES runs(id),
    territory_id UUID REFERENCES territories(id),
    metadata     JSONB,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_time ON activities(user_id, created_at DESC);

-- ─── Challenges (city competitions) ──────────────────────────

CREATE TABLE IF NOT EXISTS challenges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    type         VARCHAR(20) NOT NULL,     -- 'distance', 'territory', 'runs'
    target_value FLOAT NOT NULL,           -- km, sqm, or count
    xp_reward    INT DEFAULT 500,
    city         VARCHAR(100),
    state        VARCHAR(100),
    prize_desc   TEXT,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON challenges(is_active, starts_at, ends_at);

-- ─── User Challenges (join + progress tracking) ─────────────

CREATE TABLE IF NOT EXISTS user_challenges (
    user_id      UUID NOT NULL REFERENCES users(id),
    challenge_id UUID NOT NULL REFERENCES challenges(id),
    progress     FLOAT DEFAULT 0,
    completed    BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    joined_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, challenge_id)
);

-- ─── Seed: Sample Indian City Challenges ─────────────────────

INSERT INTO challenges (title, description, type, target_value, xp_reward, city, state, starts_at, ends_at, prize_desc) VALUES
('Mumbai Marathon Month', 'Run 100 km in Mumbai during March!', 'distance', 100, 1000, 'Mumbai', 'Maharashtra', '2026-03-01', '2026-03-31', 'Gold Runner badge + 1000 XP'),
('Delhi Territory King', 'Capture 50,000 sqm of territory in Delhi', 'territory', 50000, 1500, 'Delhi', 'Delhi', '2026-03-01', '2026-03-31', 'Territory King badge'),
('Bangalore 30-Day Streak', 'Complete a run every day for 30 days', 'runs', 30, 2000, 'Bangalore', 'Karnataka', '2026-03-01', '2026-03-31', 'Streak Master badge + 2000 XP'),
('Hyderabad Sprint Challenge', 'Run 50 km in Hyderabad', 'distance', 50, 750, 'Hyderabad', 'Telangana', '2026-03-01', '2026-03-31', 'Sprint Champion badge'),
('Chennai Beach Runner', 'Run 75 km along Chennai routes', 'distance', 75, 1000, 'Chennai', 'Tamil Nadu', '2026-03-01', '2026-03-31', 'Beach Runner badge'),
('Pune Hill Conqueror', 'Capture 25,000 sqm of territory in Pune', 'territory', 25000, 1000, 'Pune', 'Maharashtra', '2026-03-01', '2026-03-31', 'Hill Conqueror badge'),
('All India 500km Club', 'Run 500 km anywhere in India', 'distance', 500, 5000, NULL, NULL, '2026-01-01', '2026-12-31', 'Elite Runner badge + 5000 XP');
