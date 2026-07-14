import { createServerClient } from "@/lib/supabase/server";

export type WowRow = {
  metric_key: string;
  label: string;
  cluster: string;
  unit: "count" | "percent" | "position";
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

/**
 * Latest complete week's scalar KPIs (segment='all') plus a trend series.
 * `traffic_source` is excluded here — it is multi-segment, rendered separately.
 */
export async function getScalarKpis(cluster = "traffic"): Promise<ScalarKpi[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("metric_wow")
    .select("*")
    .eq("cluster", cluster)
    .eq("segment", "all")
    .order("sort_order", { ascending: true })
    .order("period_start", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as WowRow[];

  const byKey = new Map<string, WowRow[]>();
  for (const r of rows) {
    if (!byKey.has(r.metric_key)) byKey.set(r.metric_key, []);
    byKey.get(r.metric_key)!.push(r);
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
  out.sort(
    (a, b) =>
      (rows.find((r) => r.metric_key === a.key)?.sort_order ?? 0) -
      (rows.find((r) => r.metric_key === b.key)?.sort_order ?? 0),
  );
  return out;
}

/** Latest week's traffic-source breakdown (one row per channel). */
export async function getTrafficSources(): Promise<
  { segment: string; value: number }[]
> {
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
  return (data ?? []) as { segment: string; value: number }[];
}
