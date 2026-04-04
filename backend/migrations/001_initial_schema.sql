-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create vendors table
CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Using PostGIS GEOGRAPHY point for location (longitude, latitude)
    -- This allows for distance queries like ST_DWithin
    location GEOGRAPHY(POINT, 4326),
    trust_score FLOAT DEFAULT 0.0,
    total_scans INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create enum for final grade to ensure data integrity
CREATE TYPE public.scan_grade AS ENUM ('A', 'B', 'C', 'Spoiled');

-- Create scans table
CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    final_grade scan_grade NOT NULL,
    confidence_score FLOAT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_target_domain BOOLEAN DEFAULT false
);

-- Create indexes for performance
CREATE INDEX vendors_location_idx ON public.vendors USING GIST (location);
CREATE INDEX scans_vendor_id_idx ON public.scans (vendor_id);
CREATE INDEX scans_timestamp_idx ON public.scans (timestamp);
