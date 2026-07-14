// Supabase Edge Function: pull Google Search Console organic metrics per week.
// Invoke:  POST /functions/v1/ingest-gsc        (optional body: {"weeks": 12})
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAccessToken, lastCompleteWeeks, ymd } from "../_shared/google-auth.ts";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const weeks = (await req.json().catch(() => ({}))).weeks ?? 12;
    const siteUrl = Deno.env.get("GSC_SITE_URL")!; // e.g. "sc-domain:example.com"
    const token = await getAccessToken(GSC_SCOPE);

    const rows: any[] = [];
    const base = { granularity: "weekly", source: "gsc" };

    // One aggregate query per complete week (proper weighted avg position).
    for (const wk of lastCompleteWeeks(weeks)) {
      const res = await fetch(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
          siteUrl,
        )}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: ymd(wk.start),
            endDate: ymd(wk.end),
            dimensions: [], // totals for the range
            type: "web",
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`GSC query ${res.status}: ${await res.text()}`);
      }
      const json = await res.json();
      const agg = json.rows?.[0];
      const period_start = ymd(wk.start);
      if (agg) {
        rows.push({ ...base, metric_key: "organic_traffic", segment: "all", period_start, value: agg.clicks ?? 0 });
        rows.push({ ...base, metric_key: "avg_position", segment: "all", period_start, value: +(agg.position ?? 0).toFixed(1) });
      } else {
        rows.push({ ...base, metric_key: "organic_traffic", segment: "all", period_start, value: 0 });
      }
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({
      source: "gsc", status: "success", rows_written: rows.length,
    });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({
      source: "gsc", status: "error", error: String(e),
    });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
