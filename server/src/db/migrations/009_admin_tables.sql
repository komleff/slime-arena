-- Migration: 009_admin_tables
-- Description: Admin authentication tables for monitoring dashboard
-- Date: 2026-02-04
-- Updated: 2026-02-05 (fix audit_log schema conflict with 001_initial_schema)

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

-- ============================================================================
-- Fix audit_log schema conflict
-- Migration 001 creates audit_log with: actor_user_id, payload, created_at
-- This migration needs: user_id, details_json, timestamp
-- ============================================================================

-- Step 1: Check if audit_log has old schema and fix it
DO $$
BEGIN
    -- Check if audit_log has old schema (actor_user_id column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_log' AND column_name = 'actor_user_id'
    ) THEN
        -- Rename old table to preserve data
        ALTER TABLE audit_log RENAME TO audit_log_old;

        -- Drop old indexes
        DROP INDEX IF EXISTS idx_audit_log_time;
        DROP INDEX IF EXISTS idx_audit_log_actor;

        RAISE NOTICE 'Old audit_log table renamed to audit_log_old';
    END IF;
END $$;

-- Step 2: Create audit_log with correct schema (if not exists after rename)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(100),
    ip VARCHAR(64),
    timestamp TIMESTAMP DEFAULT NOW(),
    details_json JSONB
);

-- Step 3: Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
    ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp
    ON audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log(action);

-- Step 4: Migrate data from old table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log_old') THEN
        -- Migrate old data with column mapping
        -- Note: actor_user_id was UUID referencing users, not admin_users
        -- We set user_id to NULL for old records as they weren't admin actions
        INSERT INTO audit_log (action, target, ip, timestamp, details_json)
        SELECT
            action,
            target,
            ip,
            created_at,
            payload
        FROM audit_log_old;

        -- Drop old table after migration
        DROP TABLE audit_log_old;

        RAISE NOTICE 'Data migrated from audit_log_old and old table dropped';
    END IF;
END $$;
