import { createServerClient } from "@/lib/supabase/server";

export type Granularity = "weekly" | "daily";
export type Unit = "count" | "percent" | "position" | "currency";

export type Def = {
  key: string;
  label: string;
  cluster: string;
  unit: Unit;
  higher_is_better: boolean;
  show_trend: boolean;
  sort_order: number;
};

export type Kpi = {
  key: string;
  label: string;
  unit: Unit;
  higher_is_better: boolean;
  show_trend: boolean;
  value: number;
  prev: number | null;
  pct_change: number | null;
  trend: { period_start: string; value: number }[];
};

/** Resolve [from,to] (yyyy-mm-dd) from filter params. Custom range wins. */
export function resolveRange(opts: {
  weeks?: number;
  from?: string;
  to?: string;
}): { from: string; to: string } {
  if (opts.from && opts.to) return { from: opts.from, to: opts.to };
  const to = new Date();
  const weeks = opts.weeks && opts.weeks > 0 ? opts.weeks : 12;
  const from = new Date(to);
  from.setDate(from.getDate() - (weeks * 7 + 7));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function pctChange(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function getDefs(cluster: string): Promise<Def[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("metric_definitions")
    .select("key,label,cluster,unit,higher_is_better,show_trend,sort_order")
    .eq("cluster", cluster)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Def[];
}

export async function getDef(key: string): Promise<Def | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("metric_definitions")
    .select("key,label,cluster,unit,higher_is_better,show_trend,sort_order")
    .eq("key", key)
    .maybeSingle();
  return (data as Def) ?? null;
}

/** Scalar KPI cards (segment='all') for a cluster at a granularity + range. */
export async function getClusterKpis(
  cluster: string,
  g: Granularity,
  range: { from: string; to: string },
): Promise<Kpi[]> {
  const supabase = createServerClient();
  const defs = await getDefs(cluster);
  const keys = defs.map((d) => d.key);
  if (!keys.length) return [];

  const { data, error } = await supabase
    .from("metric_values")
    .select("metric_key,period_start,value")
    .in("metric_key", keys)
    .eq("segment", "all")
    .eq("granularity", g)
    .gte("period_start", range.from)
    .lte("period_start", range.to)
    .order("period_start", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as {
    metric_key: string;
    period_start: string;
    value: number;
  }[];
  const byKey = new Map<string, { period_start: string; value: number }[]>();
  for (const r of rows) {
    if (!byKey.has(r.metric_key)) byKey.set(r.metric_key, []);
    byKey.get(r.metric_key)!.push({ period_start: r.period_start, value: r.value });
  }

  const out: Kpi[] = [];
  for (const d of defs) {
    const series = byKey.get(d.key);
    if (!series || !series.length) continue; // breakdown metrics have no 'all' rows
    const value = series[series.length - 1].value;
    const prev = series.length > 1 ? series[series.length - 2].value : null;
    out.push({
      key: d.key,
      label: d.label,
      unit: d.unit,
      higher_is_better: d.higher_is_better,
      show_trend: d.show_trend,
      value,
      prev,
      pct_change: pctChange(value, prev),
      trend: series,
    });
  }
  return out;
}

/** Time series for one metric (optionally one segment) at a granularity + range. */
export async function getSeries(
  key: string,
  segment: string,
  g: Granularity,
  range: { from: string; to: string },
): Promise<{ period_start: string; value: number }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("metric_values")
    .select("period_start,value")
    .eq("metric_key", key)
    .eq("segment", segment)
    .eq("granularity", g)
    .gte("period_start", range.from)
    .lte("period_start", range.to)
    .order("period_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { period_start: string; value: number }[];
}

/** Latest period's breakdown for a multi-segment metric (weekly snapshot). */
export async function getLatestBreakdown(
  metricKey: string,
): Promise<{ segment: string; value: number }[]> {
  const supabase = createServerClient();

  const { data: latest } = await supabase
    .from("metric_values")
    .select("period_start")
    .eq("metric_key", metricKey)
    .eq("granularity", "weekly")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];

  const { data, error } = await supabase
    .from("metric_values")
    .select("segment, value")
    .eq("metric_key", metricKey)
    .eq("granularity", "weekly")
    .eq("period_start", latest.period_start)
    .order("value", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { segment: string; value: number }[];
}

/** Distinct segments recorded for a breakdown metric (for filters). */
export async function getSegments(metricKey: string): Promise<string[]> {
  const rows = await getLatestBreakdown(metricKey);
  return rows.map((r) => r.segment);
}
