-- Migration: Vendor Trust Score (Issue #45)
-- Run this in your Supabase SQL Editor

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS trust_badge TEXT
    CHECK (trust_badge IN ('gold', 'silver', 'bronze', 'unranked'))
    DEFAULT 'unranked',
  ADD COLUMN IF NOT EXISTS trend TEXT
    CHECK (trend IN ('up', 'down', 'stable'))
    DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_freshness_score NUMERIC(4,2) DEFAULT 0.0;

-- Index for fast leaderboard sorting
CREATE INDEX IF NOT EXISTS idx_vendors_avg_freshness
  ON vendors (avg_freshness_score DESC);