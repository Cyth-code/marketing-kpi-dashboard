import { createServerClient } from "@/lib/supabase/server";

export type WowRow = {
  metric_key: string;
  label: string;
  cluster: string;
  unit: "count" | "percent" | "position" | "currency";
  higher_is_better: boolean;
  show_trend: boolean;
  sort_order: number;
  segment: string;
  period_start: string;
  value: number;
  prev_value: number | null;
  pct_change: number | null;
};

export type ScalarKpi = {
  key: string;
  label: string;
  unit: WowRow["unit"];
  higher_is_better: boolean;
  show_trend: boolean;
  value: number;
  pct_change: number | null;
  trend: { period_start: string; value: number }[];
};

/** yyyy-mm-dd cutoff `weeks` back from today (+1wk buffer so the window fills). */
function cutoffDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (weeks * 7 + 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Scalar KPIs for a cluster (segment='all'), limited to the last `weeks`.
 * pct_change comes from the metric_wow view, whose lag is computed over ALL
 * history — so filtering the window never distorts the week-over-week delta.
 */
export async function getScalarKpis(
  cluster: string,
  weeks = 12,
): Promise<ScalarKpi[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metric_wow")
    .select("*")
    .eq("cluster", cluster)
    .eq("segment", "all")
    .gte("period_start", cutoffDate(weeks))
    .order("sort_order", { ascending: true })
    .order("period_start", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as WowRow[];

  const byKey = new Map<string, WowRow[]>();
  const orderOf = new Map<string, number>();
  for (const r of rows) {
    if (!byKey.has(r.metric_key)) byKey.set(r.metric_key, []);
    byKey.get(r.metric_key)!.push(r);
    orderOf.set(r.metric_key, r.sort_order);
  }

  const out: ScalarKpi[] = [];
  for (const [key, series] of byKey) {
    const latest = series[series.length - 1];
    out.push({
      key,
      label: latest.label,
      unit: latest.unit,
      higher_is_better: latest.higher_is_better,
      show_trend: latest.show_trend,
      value: latest.value,
      pct_change: latest.pct_change,
      trend: series.map((s) => ({ period_start: s.period_start, value: s.value })),
    });
  }
  out.sort((a, b) => (orderOf.get(a.key) ?? 0) - (orderOf.get(b.key) ?? 0));
  return out;
}

/**
 * Latest week's traffic-source breakdown (one row per channel).
 * If `channels` is non-empty, restrict to those channels.
 */
export async function getTrafficSources(
  channels: string[] = [],
): Promise<{ segment: string; value: number }[]> {
  const supabase = createServerClient();

  const { data: latest } = await supabase
    .from("metric_values")
    .select("period_start")
    .eq("metric_key", "traffic_source")
    .eq("granularity", "weekly")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return [];

  const { data, error } = await supabase
    .from("metric_values")
    .select("segment, value")
    .eq("metric_key", "traffic_source")
    .eq("granularity", "weekly")
    .eq("period_start", latest.period_start)
    .order("value", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as { segment: string; value: number }[];
  return channels.length ? rows.filter((r) => channels.includes(r.segment)) : rows;
}
