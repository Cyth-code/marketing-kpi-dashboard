-- ============================================================
--  Leads & MQL cluster KPI definitions (GA4 key-events to start).
--  Run in the Supabase SQL editor after 0001_init.sql.
--  Segmented MQLs (PRM/Project/Distribution/Embedded/SEO) are added
--  later once the event->segment mapping is defined.
-- ============================================================
insert into metric_definitions (key, label, cluster, source, unit, higher_is_better, sort_order) values
  ('total_key_events',          'Key Events (total)',    'leads', 'ga4', 'count',   true, 10),
  ('lead_conversion_rate',      'Lead Conversion Rate',  'leads', 'ga4', 'percent', true, 20),
  -- breakdown metrics (segment != 'all'), not shown as scalar cards:
  ('key_event',                 'Key Event Volume',      'leads', 'ga4', 'count',   true, 30),
  ('landing_page_conversions',  'Landing Page Conv.',    'leads', 'ga4', 'count',   true, 40)
on conflict (key) do nothing;
