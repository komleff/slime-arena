-- Migration: 009_admin_tables
-- Description: Admin authentication tables for monitoring dashboard
-- Date: 2026-02-04

-- Table: admin_users
-- Stores admin accounts, separate from player accounts
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    totp_secret_encrypted VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table: admin_sessions
-- Stores refresh token sessions for admins
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip VARCHAR(64),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Indexes for admin_sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_created
    ON admin_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
    ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_refresh_token_hash
    ON admin_sessions(refresh_token_hash);

-- Table: audit_log
-- Stores all admin actions for security audit
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(100),
    ip VARCHAR(64),
    timestamp TIMESTAMP DEFAULT NOW(),
    details_json JSONB
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
    ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp
    ON audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log(action);
