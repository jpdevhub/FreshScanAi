-- =====================================================================
-- FreshScan AI: Master Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Features:
-- 1. User Profiles linked to Google OAuth (auth.users)
-- 2. Vendors with PostGIS map locations
-- 3. Scans table for saving fish scan results WITH uploaded photos
-- 4. User Map Search History
-- 5. Row-Level Security (RLS) policies
-- =====================================================================

-- Enable PostGIS extension for geospatial queries / map searches
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================================
-- 1. USERS & PROFILES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to automatically create a profile when someone signs in with Google
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

-- Attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================================
-- 2. VENDORS & MAP SYSTEM
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    location GEOGRAPHY(POINT, 4326),  -- Stores Longitude/Latitude
    trust_score FLOAT DEFAULT 0.0,
    total_scans INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX vendors_location_idx ON public.vendors USING GIST (location);


-- =====================================================================
-- 3. USER MAP SEARCH HISTORY
-- =====================================================================
-- Stores what the user searched for on the map (e.g., location name, coords)
CREATE TABLE IF NOT EXISTS public.map_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,  -- e.g., "Seattle Fish Market" or coordinates
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX map_searches_user_id_idx ON public.map_searches (user_id);


-- =====================================================================
-- 4. FISH SCANS & RESULTS
-- =====================================================================
CREATE TYPE public.scan_grade AS ENUM ('A', 'B', 'C', 'Spoiled');

CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL, -- Nullable if they haven't picked a vendor
    
    -- Scan Results
    final_grade scan_grade NOT NULL,
    confidence_score FLOAT NOT NULL,
    image_type TEXT NOT NULL, -- e.g., 'EYE', 'GILL', 'BODY', or 'full_scan'
    
    -- Photo Storage (paths to the Supabase Storage bucket)
    -- This stores the photos so the user can see past images
    photo_urls TEXT[] DEFAULT '{}', 
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX scans_user_id_idx ON public.scans (user_id);
CREATE INDEX scans_vendor_id_idx ON public.scans (vendor_id);
CREATE INDEX scans_timestamp_idx ON public.scans (timestamp);


-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
-- Protect tables so users can only see their own data

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Profiles: Users see and edit their own profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Vendors: Everyone can see vendors
CREATE POLICY "Anyone can view vendors" ON public.vendors FOR SELECT USING (true);

-- Map searches: Users see their own history
CREATE POLICY "Users view own map searches" ON public.map_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own map searches" ON public.map_searches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scans: Users see and insert their own scans
CREATE POLICY "Users view own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS for backend scripts
CREATE POLICY "Service role can insert scans" ON public.scans FOR INSERT WITH CHECK (true);


-- =====================================================================
-- 6. STORAGE BUCKET (Run this manually or via dashboard if preferred)
-- =====================================================================
-- Allows storage of scan images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scan-images', 'scan-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can upload images to their own folder, but everyone can view them
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'scan-images');
CREATE POLICY "Users can upload their own images" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'scan-images' AND auth.role() = 'authenticated');
