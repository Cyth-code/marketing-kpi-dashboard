// Supabase Edge Function: pull GA4 traffic & engagement, upsert weekly metrics.
// Invoke:  POST /functions/v1/ingest-ga4        (optional body: {"weeks": 12})
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  getAccessToken,
  lastCompleteWeeks,
  mondayOf,
  ymd,
} from "../_shared/google-auth.ts";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

type Row = {
  metric_key: string;
  segment: string;
  period_start: string;
  granularity: string;
  value: number;
  source: string;
};

function parseGaDate(yyyymmdd: string): Date {
  return new Date(
    Date.UTC(
      +yyyymmdd.slice(0, 4),
      +yyyymmdd.slice(4, 6) - 1,
      +yyyymmdd.slice(6, 8),
    ),
  );
}

async function runReport(propertyId: string, token: string, body: unknown) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GA4 runReport ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const weeks = (await req.json().catch(() => ({}))).weeks ?? 12;
    const propertyId = Deno.env.get("GA4_PROPERTY_ID")!;
    const token = await getAccessToken(GA4_SCOPE);

    const range = lastCompleteWeeks(weeks);
    const startDate = ymd(range[0].start);
    const endDate = ymd(range[range.length - 1].end);

    // --- 1) daily scalar metrics -> bucket into weeks ---
    const scalar = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
    });

    // week key -> {sessions, engaged}
    const buckets = new Map<string, { sessions: number; engaged: number }>();
    for (const r of scalar.rows ?? []) {
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const b = buckets.get(wk) ?? { sessions: 0, engaged: 0 };
      b.sessions += +r.metricValues[0].value;
      b.engaged += +r.metricValues[1].value;
      buckets.set(wk, b);
    }

    const rows: Row[] = [];
    const base = { granularity: "weekly", source: "ga4" };
    for (const [wk, b] of buckets) {
      const engRate = b.sessions ? (b.engaged / b.sessions) * 100 : 0;
      rows.push({ ...base, metric_key: "site_traffic", segment: "all", period_start: wk, value: b.sessions });
      rows.push({ ...base, metric_key: "engaged_sessions", segment: "all", period_start: wk, value: b.engaged });
      rows.push({ ...base, metric_key: "engagement_rate", segment: "all", period_start: wk, value: +engRate.toFixed(1) });
      rows.push({ ...base, metric_key: "bounce_rate", segment: "all", period_start: wk, value: +(100 - engRate).toFixed(1) });
    }

    // --- 2) traffic source breakdown (date x channel) ---
    const bySource = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
    });
    const srcBuckets = new Map<string, number>(); // "week|channel" -> sessions
    for (const r of bySource.rows ?? []) {
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const channel = r.dimensionValues[1].value || "Unassigned";
      const k = `${wk}|${channel}`;
      srcBuckets.set(k, (srcBuckets.get(k) ?? 0) + +r.metricValues[0].value);
    }
    for (const [k, v] of srcBuckets) {
      const [wk, channel] = k.split("|");
      rows.push({ ...base, metric_key: "traffic_source", segment: channel, period_start: wk, value: v });
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({
      source: "ga4", status: "success", rows_written: rows.length,
    });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({
      source: "ga4", status: "error", error: String(e),
    });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
