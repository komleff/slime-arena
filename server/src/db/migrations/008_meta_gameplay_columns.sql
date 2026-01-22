-- Migration: 008_meta_gameplay_columns.sql
-- Description: Add columns to existing tables for anonymous users and claim tokens
-- Features: Anonymous user support, registration tracking, guest match linking, claim idempotency

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_skin_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_match_id UUID REFERENCES match_results(match_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname_set_at TIMESTAMP;

-- Add new columns to match_results table
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS guest_subject_id VARCHAR(255);
ALTER TABLE match_results ADD COLUMN IF NOT EXISTS claim_consumed_at TIMESTAMP;

-- Create index for fast guest match lookup
CREATE INDEX IF NOT EXISTS idx_match_results_guest_subject ON match_results(guest_subject_id);
