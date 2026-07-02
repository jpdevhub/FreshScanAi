insert into public.vendor_achievements
  (vendor_id, code, title, description, icon, tier)
select
  id,
  badge.code,
  badge.title,
  badge.description,
  badge.icon,
  badge.tier
from public.vendors
cross join (
  values
    (
      'fresh_streak_50',
      '50x Grade A Streak',
      'Awarded for 50 consecutive Grade A scans.',
      'bolt',
      'legendary'
    ),
    (
      'consistent_30d',
      '30 Days Consistently Fresh',
      'Awarded after Grade A scans across 30 clean scan days.',
      'calendar',
      'neon'
    ),
    (
      'trusted_volume_100',
      '100 Verified Scans',
      'Awarded after 100 recorded freshness scans.',
      'shield',
      'trusted'
    ),
    (
      'top_1_percent',
      'Top 1% Freshness',
      'Awarded to the highest freshness performers on the vendor leaderboard.',
      'crown',
      'elite'
    )
) as badge(code, title, description, icon, tier)
where public.vendors.id = (
  select id from public.vendors order by avg_freshness_score desc limit 1
)
on conflict (vendor_id, code) do nothing;