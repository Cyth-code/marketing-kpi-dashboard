// Supabase Edge Function: pull GA4 e-commerce metrics, upsert weekly.
// Self-contained — paste directly into the Supabase dashboard Edge Functions editor.
// Invoke:  POST /functions/v1/ingest-ecomm      (optional body: {"weeks": 12})
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
    // Extend through yesterday for the daily view; weekly skips the current week.
    const yest = new Date();
    yest.setUTCDate(yest.getUTCDate() - 1);
    const endDate = ymd(yest);
    const thisMonday = ymd(mondayOf(new Date()));

    // daily e-comm metrics -> bucket into weeks
    const report = await runReport(propertyId, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "ecommercePurchases" },
        { name: "purchaseRevenue" },
        { name: "addToCarts" },
        { name: "sessions" },
      ],
    });

    type Bucket = { tx: number; rev: number; carts: number; sessions: number };
    const buckets = new Map<string, Bucket>();
    for (const r of report.rows ?? []) {
      const wk = ymd(mondayOf(parseGaDate(r.dimensionValues[0].value)));
      const b = buckets.get(wk) ?? { tx: 0, rev: 0, carts: 0, sessions: 0 };
      b.tx += +r.metricValues[0].value;
      b.rev += +r.metricValues[1].value;
      b.carts += +r.metricValues[2].value;
      b.sessions += +r.metricValues[3].value;
      buckets.set(wk, b);
    }

    const rows: Row[] = [];
    const base = { granularity: "weekly", source: "ga4", segment: "all" };
    const dbase = { granularity: "daily", source: "ga4", segment: "all" };
    const derive = (tx: number, rev: number, carts: number, sessions: number, period: string, b: typeof base) => {
      const salesConv = sessions ? (tx / sessions) * 100 : 0;
      const aband = carts ? Math.max(0, Math.min(100, (1 - tx / carts) * 100)) : 0;
      rows.push({ ...b, metric_key: "ecomm_transactions", period_start: period, value: tx });
      rows.push({ ...b, metric_key: "ecomm_revenue", period_start: period, value: +rev.toFixed(2) });
      rows.push({ ...b, metric_key: "ecomm_carts", period_start: period, value: carts });
      rows.push({ ...b, metric_key: "sales_conversion_rate", period_start: period, value: +salesConv.toFixed(2) });
      rows.push({ ...b, metric_key: "cart_abandonment_rate", period_start: period, value: +aband.toFixed(1) });
    };
    for (const [wk, b] of buckets) {
      if (wk === thisMonday) continue; // skip in-progress week for weekly
      derive(b.tx, b.rev, b.carts, b.sessions, wk, base);
    }
    // daily rows (per day, through yesterday)
    for (const r of report.rows ?? []) {
      const day = ymd(parseGaDate(r.dimensionValues[0].value));
      derive(
        +r.metricValues[0].value,
        +r.metricValues[1].value,
        +r.metricValues[2].value,
        +r.metricValues[3].value,
        day,
        dbase,
      );
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({ source: "ecomm-ga4", status: "success", rows_written: rows.length });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({ source: "ecomm-ga4", status: "error", error: String(e) });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
