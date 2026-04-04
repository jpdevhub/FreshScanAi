-- =====================================================================
-- FreshScan AI: Master Database Schema
-- Run this in: Supabase Dashboard -> SQL Editor
-- Safe to run multiple times (idempotent).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT,
    full_name  TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================================
-- 2. VENDORS (with explicit lat/lng for map)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    address             TEXT,
    location            GEOGRAPHY(POINT, 4326),
    lat                 FLOAT,
    lng                 FLOAT,
    trust_score         FLOAT DEFAULT 0.0,
    avg_freshness_score INTEGER DEFAULT 0,
    vendor_count        INTEGER DEFAULT 1,
    total_scans         INTEGER DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lat                 FLOAT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lng                 FLOAT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS avg_freshness_score INTEGER DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS vendor_count        INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS vendors_location_idx ON public.vendors USING GIST (location);


-- =====================================================================
-- 3. MAP SEARCH HISTORY
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.map_searches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    searched_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS map_searches_user_id_idx ON public.map_searches (user_id);


-- =====================================================================
-- 4. SCANS
-- =====================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scan_grade') THEN
        CREATE TYPE public.scan_grade AS ENUM ('A+', 'A', 'B', 'C', 'D', 'Spoiled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.scans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id        UUID REFERENCES public.vendors(id) ON DELETE SET NULL,

    -- Core result
    final_grade      TEXT NOT NULL DEFAULT 'C',
    confidence_score FLOAT NOT NULL DEFAULT 0.0,
    image_type       TEXT NOT NULL DEFAULT 'BODY',

    -- Extended result fields (added for full API support)
    freshness_index  INTEGER,
    scan_display_id  TEXT,
    species_detected TEXT DEFAULT 'Rohu Carp',
    biomarker_json   JSONB DEFAULT '{}',
    storage_hours    INTEGER DEFAULT 0,
    alert_flags      TEXT[] DEFAULT '{}',
    market_name      TEXT,
    is_target_domain BOOLEAN DEFAULT false,

    -- Photo storage
    photo_urls       TEXT[] DEFAULT '{}',

    timestamp        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Add new columns safely if table already exists
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS freshness_index  INTEGER;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS scan_display_id  TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS species_detected TEXT DEFAULT 'Rohu Carp';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS biomarker_json   JSONB DEFAULT '{}';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS storage_hours    INTEGER DEFAULT 0;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS alert_flags      TEXT[] DEFAULT '{}';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS market_name      TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_target_domain BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS scans_user_id_idx    ON public.scans (user_id);
CREATE INDEX IF NOT EXISTS scans_vendor_id_idx  ON public.scans (vendor_id);
CREATE INDEX IF NOT EXISTS scans_timestamp_idx  ON public.scans (timestamp);


-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"  ON public.profiles;
CREATE POLICY "Users view own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view vendors" ON public.vendors;
CREATE POLICY "Anyone can view vendors"
    ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users view own map searches"   ON public.map_searches;
DROP POLICY IF EXISTS "Users insert own map searches" ON public.map_searches;
CREATE POLICY "Users view own map searches"
    ON public.map_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own map searches"
    ON public.map_searches FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own scans"        ON public.scans;
DROP POLICY IF EXISTS "Users insert own scans"      ON public.scans;
DROP POLICY IF EXISTS "Service role can insert scans" ON public.scans;
CREATE POLICY "Users view own scans"
    ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans"
    ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert scans"
    ON public.scans FOR INSERT WITH CHECK (true);


-- =====================================================================
-- 6. STORAGE BUCKET
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('scan-images', 'scan-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access scan images"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload scan images"  ON storage.objects;
CREATE POLICY "Public read access scan images"
    ON storage.objects FOR SELECT USING (bucket_id = 'scan-images');
CREATE POLICY "Authenticated upload scan images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'scan-images' AND auth.role() = 'authenticated');



-- =====================================================================
-- 7. DONE
-- Scan history populates automatically when authenticated users run scans.
-- Run backend/seed_vendors.py after applying this migration to populate
-- the vendors table with market locations.
-- =====================================================================


