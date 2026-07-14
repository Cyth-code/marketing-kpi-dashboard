-- ============================================================
--  Marketing Metrics Dashboard — core schema
--  Run in Supabase SQL editor (or `supabase db push`)
-- ============================================================

-- ---- KPI catalog (config-driven; maps to the "View Trend" UI) ----
create table if not exists metric_definitions (
  key         text primary key,             -- 'site_traffic', 'bounce_rate', ...
  label       text not null,                -- 'Site Traffic'
  cluster     text not null,                -- 'traffic' | 'leads' | 'ecomm'
  source      text not null,                -- 'ga4' | 'gsc' | 'wix'
  unit        text not null default 'count',-- 'count' | 'percent' | 'position'
  higher_is_better boolean not null default true,
  show_trend  boolean not null default true,
  sort_order  int not null default 0
);

-- ---- Normalized fact table: every source lands here in one shape ----
create table if not exists metric_values (
  metric_key   text not null references metric_definitions(key) on delete cascade,
  segment      text not null default 'all',  -- e.g. traffic source, MQL type
  period_start date not null,                -- Monday of the ISO week
  granularity  text not null default 'weekly',
  value        numeric not null,
  source       text not null,
  loaded_at    timestamptz not null default now(),
  primary key (metric_key, segment, period_start, granularity)
);

create index if not exists idx_metric_values_lookup
  on metric_values (metric_key, granularity, period_start desc);

-- ---- Ingestion observability ----
create table if not exists ingestion_runs (
  id           bigint generated always as identity primary key,
  source       text not null,
  status       text not null,               -- 'success' | 'error'
  rows_written int not null default 0,
  error        text,
  ran_at       timestamptz not null default now()
);

-- ============================================================
--  Week-over-week view — frontend reads this, never computes deltas
-- ============================================================
create or replace view metric_wow as
with weekly as (
  select
    mv.metric_key,
    mv.segment,
    mv.period_start,
    mv.value,
    lag(mv.value) over (
      partition by mv.metric_key, mv.segment
      order by mv.period_start
    ) as prev_value
  from metric_values mv
  where mv.granularity = 'weekly'
)
select
  w.metric_key,
  d.label,
  d.cluster,
  d.unit,
  d.higher_is_better,
  d.show_trend,
  d.sort_order,
  w.segment,
  w.period_start,
  w.value,
  w.prev_value,
  case
    when w.prev_value is null or w.prev_value = 0 then null
    else round(((w.value - w.prev_value) / w.prev_value) * 100, 1)
  end as pct_change
from weekly w
join metric_definitions d on d.key = w.metric_key;

-- ============================================================
--  Seed — MVP: Traffic & Engagement
-- ============================================================
insert into metric_definitions (key, label, cluster, source, unit, higher_is_better, sort_order) values
  ('site_traffic',     'Site Traffic',        'traffic', 'ga4', 'count',    true,  10),
  ('engaged_sessions', 'Engaged Sessions',    'traffic', 'ga4', 'count',    true,  20),
  ('engagement_rate',  'Engagement Rate',     'traffic', 'ga4', 'percent',  true,  30),
  ('bounce_rate',      'Bounce Rate',         'traffic', 'ga4', 'percent',  false, 40),
  ('traffic_source',   'Traffic Source',      'traffic', 'ga4', 'count',    true,  50),
  ('organic_traffic',  'Organic Traffic',     'traffic', 'gsc', 'count',    true,  60),
  ('avg_position',     'Avg Keyword Position','traffic', 'gsc', 'position', false, 70)
on conflict (key) do nothing;

-- ============================================================
--  Row Level Security
--  Frontend uses the service_role key server-side (bypasses RLS),
--  so we enable RLS and add NO anon policies = anon cannot read.
-- ============================================================
alter table metric_definitions enable row level security;
alter table metric_values      enable row level security;
alter table ingestion_runs      enable row level security;
