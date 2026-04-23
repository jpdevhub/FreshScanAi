-- Run this in: Supabase Dashboard → SQL Editor
-- Fixes the overly permissive scan insert policy.

DROP POLICY IF EXISTS "Service role can insert scans" ON public.scans;

-- Service role bypasses RLS automatically — this policy was accidentally
-- granting anon-role write access to ALL scans rows. It is not needed.
