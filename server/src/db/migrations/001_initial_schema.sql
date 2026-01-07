-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for Soft Launch
-- Based on: SlimeArena-Architecture-v4.2.5-Part4.md Appendix B

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_type VARCHAR(50) NOT NULL,
    platform_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(500),
    locale VARCHAR(10) DEFAULT 'ru',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason VARCHAR(255),
    ban_until TIMESTAMP,
    CONSTRAINT unique_platform_user UNIQUE (platform_type, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform_type, platform_id);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    ip VARCHAR(64),
    user_agent VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    selected_skin_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    coins BIGINT DEFAULT 0,
    gems BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unlocked items table
CREATE TABLE IF NOT EXISTS unlocked_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- skin, emote, title, frame
    unlocked_at TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) NOT NULL, -- shop, battlepass, achievement, admin
    source_details JSONB,
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_items_user ON unlocked_items(user_id, item_type);

-- Transactions table (for idempotency)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- spend, grant, purchase
    source VARCHAR(50) NOT NULL, -- shop, battlepass, ad, admin, match
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_user_operation UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);

-- Player ratings table (Glicko-2)
CREATE TABLE IF NOT EXISTS player_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL,
    season_id VARCHAR(50) NOT NULL,
    rating INT DEFAULT 1500,
    rating_data JSONB, -- rd, sigma, lastRatedAt
    games_played INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, mode, season_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_leaderboard ON player_ratings(season_id, mode, rating DESC);

-- Match results table
CREATE TABLE IF NOT EXISTS match_results (
    match_id UUID PRIMARY KEY,
    mode VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    config_version VARCHAR(50) NOT NULL,
    build_version VARCHAR(50) NOT NULL,
    summary JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_match_results_time ON match_results(started_at DESC);

-- Battle pass progress table
CREATE TABLE IF NOT EXISTS battlepass_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id VARCHAR(50) NOT NULL,
    level INT DEFAULT 0,
    xp INT DEFAULT 0,
    premium BOOLEAN DEFAULT FALSE,
    state JSONB, -- claimed rewards tracking
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, season_id)
);

-- Mission progress table
CREATE TABLE IF NOT EXISTS mission_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id VARCHAR(50) NOT NULL,
    mission_id VARCHAR(100) NOT NULL,
    progress INT DEFAULT 0,
    state VARCHAR(20) DEFAULT 'active', -- active, completed, claimed
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, season_id, mission_id)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(100) NOT NULL,
    state VARCHAR(20) DEFAULT 'locked', -- locked, unlocked, claimed
    progress INT DEFAULT 0,
    unlocked_at TIMESTAMP,
    claimed_at TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

-- Daily rewards table
CREATE TABLE IF NOT EXISTS daily_rewards (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    streak INT DEFAULT 0,
    last_claimed_at TIMESTAMP,
    ads_watched_today INT DEFAULT 0,
    ads_reset_at TIMESTAMP
);

-- Purchase receipts table (for real money transactions)
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- telegram, yandex, other
    receipt_id VARCHAR(255),
    receipt_payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, verified, rejected
    created_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    CONSTRAINT unique_user_purchase_operation UNIQUE (user_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_user ON purchase_receipts(user_id, created_at DESC);

-- Social invites table
CREATE TABLE IF NOT EXISTS social_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    invite_code VARCHAR(50) NOT NULL,
    state VARCHAR(20) DEFAULT 'created', -- created, opened, joined
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_platform_invite UNIQUE (platform, invite_code)
);

CREATE INDEX IF NOT EXISTS idx_social_invites_user ON social_invites(user_id);

-- A/B tests table
CREATE TABLE IF NOT EXISTS ab_tests (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_id VARCHAR(100) NOT NULL,
    variant_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, test_id)
);

-- Configs table (for storing RuntimeConfig versions)
CREATE TABLE IF NOT EXISTS configs (
    config_version VARCHAR(50) PRIMARY KEY,
    state VARCHAR(20) NOT NULL, -- draft, active, archived
    checksum VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(100),
    payload JSONB,
    ip VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);

-- Insert default config version
INSERT INTO configs (config_version, state, checksum, payload, activated_at) 
VALUES (
    'v1.0.0',
    'active',
    'default',
    '{
        "economy": {"currencies": [{"currencyId": "coins", "displayName": "Монеты", "precision": 0, "isPremium": false}]},
        "features": {"paymentsEnabled": false, "adsRewardEnabled": true, "matchmakingEnabled": true}
    }'::jsonb,
    NOW()
) ON CONFLICT (config_version) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
