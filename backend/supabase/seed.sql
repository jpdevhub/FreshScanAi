-- FreshScan AI — Local Dev Seed Data
-- Applied automatically after migrations by: supabase db reset

INSERT INTO public.vendors (name, address, lat, lng, trust_score, avg_freshness_score, vendor_count, total_scans)
VALUES
  ('Howrah Fish Market',     'Howrah, West Bengal',       22.5958, 88.3099, 88.0, 88, 47, 342),
  ('Gariahat Market',        'Gariahat, Kolkata',          22.5196, 88.3653, 94.0, 94, 31, 289),
  ('New Market Fish Hall',   'New Market, Kolkata',        22.5654, 88.3499, 61.0, 61, 24, 156),
  ('Lake Market',            'Rashbehari, Kolkata',        22.5151, 88.3469, 78.0, 78, 19, 198),
  ('Maniktala Bazaar',       'Maniktala, Kolkata',         22.5807, 88.3793, 72.0, 72, 28, 211),
  ('Shyambazar Fish Market', 'Shyambazar, Kolkata',        22.5953, 88.3720, 82.0, 82, 22, 167),
  ('Jorabagan Market',       'Jorabagan, Kolkata',         22.5843, 88.3594, 65.0, 65, 15, 113),
  ('Jadavpur Fish Market',   'Jadavpur, Kolkata',          22.4981, 88.3706, 91.0, 91, 36, 248)
ON CONFLICT DO NOTHING;

-- Insert DEV bypass user so local scans don't fail foreign key constraints
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '977a222c-53a1-5f37-a984-b1c98ae18bff',
  'authenticated',
  'authenticated',
  'dev@freshscan.local',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name": "Dev Tester"}',
  false
) ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, email, full_name)
VALUES ('977a222c-53a1-5f37-a984-b1c98ae18bff', 'dev@freshscan.local', 'Dev Tester')
ON CONFLICT DO NOTHING;
