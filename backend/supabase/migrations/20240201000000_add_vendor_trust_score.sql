-- Migration: Vendor Trust Score (Issue #45)

-- Fix avg_freshness_score type (was INTEGER in master_schema.sql)
ALTER TABLE vendors
  ALTER COLUMN avg_freshness_score TYPE NUMERIC(5,2) USING avg_freshness_score::NUMERIC(5,2);

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS trust_badge TEXT DEFAULT 'unranked',
  ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0;

ALTER TABLE vendors
  DROP CONSTRAINT IF EXISTS vendors_trust_badge_check,
  DROP CONSTRAINT IF EXISTS vendors_trend_check;

ALTER TABLE vendors
  ADD CONSTRAINT vendors_trust_badge_check
    CHECK (trust_badge IN ('gold', 'silver', 'bronze', 'unranked')),
  ADD CONSTRAINT vendors_trend_check
    CHECK (trend IN ('up', 'down', 'stable'));

CREATE INDEX IF NOT EXISTS idx_vendors_avg_freshness
  ON vendors (avg_freshness_score DESC);