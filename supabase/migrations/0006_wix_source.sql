-- ============================================================
--  E-commerce transactions/revenue/conversion now come from Wix
--  (authoritative orders). GA4 keeps carts + cart abandonment.
--  Cosmetic: update the recorded source. Run after 0003_ecomm.sql.
-- ============================================================
update metric_definitions
set source = 'wix'
where key in ('ecomm_transactions', 'ecomm_revenue', 'sales_conversion_rate');
