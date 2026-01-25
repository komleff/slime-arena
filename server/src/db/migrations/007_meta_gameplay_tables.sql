-- Migration: 007_meta_gameplay_tables.sql
-- Description: Add tables for Sprint 13 - Meta-gameplay (leaderboards, rating awards, OAuth links)
-- Features: Total mass leaderboard, best mass leaderboard, rating awards idempotency, OAuth providers linking

-- Leaderboard: Total Mass
CREATE TABLE IF NOT EXISTS leaderboard_total_mass (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_mass INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_mass_ranking ON leaderboard_total_mass(total_mass DESC);

-- Leaderboard: Best Mass
CREATE TABLE IF NOT EXISTS leaderboard_best_mass (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    best_mass INTEGER NOT NULL DEFAULT 0,
    best_match_id UUID REFERENCES match_results(match_id) ON DELETE SET NULL,
    players_in_match INTEGER NOT NULL DEFAULT 0,
    achieved_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_best_mass_ranking ON leaderboard_best_mass(best_mass DESC);

-- Rating Awards (idempotency for rating distribution)
CREATE TABLE IF NOT EXISTS rating_awards (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES match_results(match_id) ON DELETE CASCADE,
    awarded_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_awards_user ON rating_awards(user_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_awards_match ON rating_awards(match_id);

-- OAuth Links (for linking multiple OAuth providers to one account)
CREATE TABLE IF NOT EXISTS oauth_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth_provider VARCHAR(20) NOT NULL, -- telegram, google, yandex
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_oauth_provider_user UNIQUE (auth_provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_links_user ON oauth_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_links_provider ON oauth_links(auth_provider, provider_user_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_leaderboard_total_mass_updated_at ON leaderboard_total_mass;
CREATE TRIGGER update_leaderboard_total_mass_updated_at BEFORE UPDATE ON leaderboard_total_mass
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaderboard_best_mass_updated_at ON leaderboard_best_mass;
CREATE TRIGGER update_leaderboard_best_mass_updated_at BEFORE UPDATE ON leaderboard_best_mass
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
