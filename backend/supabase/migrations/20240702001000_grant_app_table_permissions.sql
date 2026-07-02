-- Grant table privileges required by local Supabase API roles.
-- RLS policies still enforce row-level access; these grants only allow the
-- roles to access the tables through PostgREST/Supabase clients.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.vendors TO anon, authenticated, service_role;
GRANT UPDATE ON TABLE public.vendors TO service_role;

GRANT SELECT, INSERT ON TABLE public.scans TO authenticated, service_role;

GRANT SELECT ON TABLE public.vendor_achievements TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.vendor_achievements TO service_role;
