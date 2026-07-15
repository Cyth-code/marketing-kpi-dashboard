// Supabase Edge Function: pull GA4 lead / key-event metrics, upsert weekly.
// Self-contained — paste directly into the Supabase dashboard Edge Functions editor.
// Invoke:  POST /functions/v1/ingest-leads      (optional body: {"weeks": 12})
import { createClient } from "jsr:@supabase/supabase-js@2";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

// ---------- Google service-account auth (JWT -> access token) ----------
function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}
async function getAccessToken(scope: string): Promise<string> {
  const email = Deno.env.get("GOOGLE_SA_EMAIL");
  const key = Deno.env.get("GOOGLE_SA_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Missing GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

// ---------- date helpers: complete ISO weeks (Mon–Sun) ----------
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function lastCompleteWeeks(n: number): { start: Date; end: Date }[] {
  const thisMonday = mondayOf(new Date());
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = n; i >= 1; i--) {
    const start = new Date(thisMonday);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({ start, end });
  }
  return weeks;
}
function parseGaDate(yyyymmdd: string): Date {
  return new Date(
    Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8)),
  );
}

type Row = {
  metric_key: string;
  segment: string;
  period_start: string;
  granularity: string;
  value: number;
  source: string;
};

async function runReport(propertyId: string, token: string, body: unknown) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
    const lastWeek = range[range.length - 1];

    const rows: Row[] = [];
    const base = { granularity: "weekly", source: "ga4" };

    // 1) total key events + sessions per week -> total_key_events, lead_conversion_rate
    const rep1 = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "keyEvents" }, { name: "sessions" }],
    });
    const wkTotals = new Map<string, { ke: number; sessions: number }>();
    for (const r of rep1.rows ?? []) {
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const b = wkTotals.get(wk) ?? { ke: 0, sessions: 0 };
      b.ke += +r.metricValues[0].value;
      b.sessions += +r.metricValues[1].value;
      wkTotals.set(wk, b);
    }
    for (const [wk, b] of wkTotals) {
      const conv = b.sessions ? (b.ke / b.sessions) * 100 : 0;
      rows.push({ ...base, metric_key: "total_key_events", segment: "all", period_start: wk, value: b.ke });
      rows.push({ ...base, metric_key: "lead_conversion_rate", segment: "all", period_start: wk, value: +conv.toFixed(2) });
    }

    // 2) key events by event name per week -> key_event (segment = eventName)
    const rep2 = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "eventName" }],
      metrics: [{ name: "keyEvents" }],
    });
    const evByWeek = new Map<string, number>(); // "week|event" -> keyEvents
    for (const r of rep2.rows ?? []) {
      const ke = +r.metricValues[0].value;
      if (ke <= 0) continue; // only actual key events
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const ev = r.dimensionValues[1].value;
      const k = `${wk}|${ev}`;
      evByWeek.set(k, (evByWeek.get(k) ?? 0) + ke);
    }
    for (const [k, v] of evByWeek) {
      const [wk, ev] = k.split("|");
      rows.push({ ...base, metric_key: "key_event", segment: ev, period_start: wk, value: v });
    }

    // 3) landing-page conversion ranking (latest complete week only), top 15
    const rep3 = await runReport(propertyId, token, {
      dateRanges: [{ startDate: ymd(lastWeek.start), endDate: ymd(lastWeek.end) }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [{ name: "keyEvents" }],
      orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
      limit: 15,
    });
    for (const r of rep3.rows ?? []) {
      const ke = +r.metricValues[0].value;
      if (ke <= 0) continue;
      const page = r.dimensionValues[0].value || "(not set)";
      rows.push({ ...base, metric_key: "landing_page_conversions", segment: page, period_start: ymd(lastWeek.start), value: ke });
    }

    // 4) key events by acquisition channel -> mql_by_channel + mqls_from_seo
    //    Generic MQL segmentation (no business rules); SEO = Organic Search.
    const rep4 = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "keyEvents" }],
    });
    const chByWeek = new Map<string, number>(); // "week|channel" -> keyEvents
    const seoByWeek = new Map<string, number>(); // week -> organic keyEvents
    for (const r of rep4.rows ?? []) {
      const ke = +r.metricValues[0].value;
      if (ke <= 0) continue;
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const ch = r.dimensionValues[1].value || "Unassigned";
      chByWeek.set(`${wk}|${ch}`, (chByWeek.get(`${wk}|${ch}`) ?? 0) + ke);
      if (ch === "Organic Search") seoByWeek.set(wk, (seoByWeek.get(wk) ?? 0) + ke);
    }
    for (const [k, v] of chByWeek) {
      const [wk, ch] = k.split("|");
      rows.push({ ...base, metric_key: "mql_by_channel", segment: ch, period_start: wk, value: v });
    }
    // Write a row for every week (0 when no organic key events) so WoW is clean.
    for (const wk of wkTotals.keys()) {
      rows.push({ ...base, metric_key: "mqls_from_seo", segment: "all", period_start: wk, value: seoByWeek.get(wk) ?? 0 });
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({ source: "leads-ga4", status: "success", rows_written: rows.length });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({ source: "leads-ga4", status: "error", error: String(e) });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
