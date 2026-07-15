-- ============================================================
--  E-Commerce cluster KPI definitions (GA4-sourced to start).
--  Run in the Supabase SQL editor after 0001_init.sql.
-- ============================================================
insert into metric_definitions (key, label, cluster, source, unit, higher_is_better, sort_order) values
  ('ecomm_transactions',    'Transactions',          'ecomm', 'ga4', 'count',    true,  10),
  ('ecomm_revenue',         'Revenue',               'ecomm', 'ga4', 'currency', true,  20),
  ('ecomm_carts',           'Carts Started',         'ecomm', 'ga4', 'count',    true,  30),
  ('sales_conversion_rate', 'Sales Conversion Rate', 'ecomm', 'ga4', 'percent',  true,  40),
  ('cart_abandonment_rate', 'Cart Abandonment Rate', 'ecomm', 'ga4', 'percent',  false, 50)
on conflict (key) do nothing;
