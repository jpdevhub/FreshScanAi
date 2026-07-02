-- Vendor achievements awarded from scan history.

CREATE TABLE IF NOT EXISTS public.vendor_achievements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id    UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    code         TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    icon         TEXT NOT NULL,
    tier         TEXT NOT NULL DEFAULT 'neon',
    awarded_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    metadata     JSONB DEFAULT '{}',
    UNIQUE (vendor_id, code)
);

ALTER TABLE public.vendor_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view vendor achievements" ON public.vendor_achievements;
CREATE POLICY "Anyone can view vendor achievements"
    ON public.vendor_achievements FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS vendor_achievements_vendor_id_idx
    ON public.vendor_achievements (vendor_id);

CREATE INDEX IF NOT EXISTS vendor_achievements_code_idx
    ON public.vendor_achievements (code);
