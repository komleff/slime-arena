-- Migration: 002_stage_c_monetization.sql
-- Description: Add tables for Stage C - Monetization & LiveOps
-- Features: A/B testing (refactored), analytics, payment receipts

-- Drop old ab_tests table and create new structure
DROP TABLE IF EXISTS ab_tests CASCADE;

-- A/B Tests table (test definitions)
CREATE TABLE ab_tests (
    test_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    variants JSONB NOT NULL,
    weights INT[] NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_state ON ab_tests(state);

-- A/B Test Conversions table (tracking)
CREATE TABLE ab_test_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id VARCHAR(100) NOT NULL REFERENCES ab_tests(test_id) ON DELETE CASCADE,
    variant_id VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_value NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ab_test_conversions_test ON ab_test_conversions(test_id, variant_id);
CREATE INDEX idx_ab_test_conversions_user ON ab_test_conversions(user_id, test_id);

-- Analytics events table
CREATE TABLE analytics_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    properties JSONB DEFAULT '{}',
    platform VARCHAR(50),
    client_version VARCHAR(50)
);

CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, timestamp DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, timestamp DESC);
CREATE INDEX idx_analytics_events_time ON analytics_events(timestamp DESC);

-- Update purchase_receipts table to new structure
ALTER TABLE purchase_receipts 
    DROP COLUMN IF EXISTS operation_id,
    DROP COLUMN IF EXISTS receipt_payload,
    DROP COLUMN IF EXISTS verified_at;

ALTER TABLE purchase_receipts 
    ADD COLUMN IF NOT EXISTS receipt_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS offer_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS price_amount INT,
    ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
    ADD COLUMN IF NOT EXISTS platform_transaction_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Rename provider to platform if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'purchase_receipts' AND column_name = 'provider') THEN
        ALTER TABLE purchase_receipts RENAME COLUMN provider TO platform;
    END IF;
END $$;

-- Update status column values
ALTER TABLE purchase_receipts 
    ALTER COLUMN status TYPE VARCHAR(20);

UPDATE purchase_receipts SET status = 'pending' WHERE status = 'verified';

-- Create unique constraint on receipt_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_receipt_id') THEN
        ALTER TABLE purchase_receipts ADD CONSTRAINT unique_receipt_id UNIQUE (receipt_id);
    END IF;
END $$;

-- Index for receipts
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_status ON purchase_receipts(status, created_at DESC);

-- Trigger for updated_at on ab_tests
CREATE TRIGGER update_ab_tests_updated_at BEFORE UPDATE ON ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
