-- ============================================================
--  Generic MQL segmentation (by acquisition channel).
--  Run in the Supabase SQL editor after 0004_leads.sql.
--  Named business segments (PRM/Project/Distribution/Embedded)
--  can be appended later without changing this.
-- ============================================================
insert into metric_definitions (key, label, cluster, source, unit, higher_is_better, sort_order) values
  ('mqls_from_seo',  'MQLs from SEO',   'leads', 'ga4', 'count', true, 15),
  ('mql_by_channel', 'MQLs by Channel', 'leads', 'ga4', 'count', true, 35)
on conflict (key) do nothing;
