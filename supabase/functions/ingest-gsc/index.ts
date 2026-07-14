// Supabase Edge Function: pull Google Search Console organic metrics per week.
// Self-contained — paste directly into the Supabase dashboard Edge Functions editor.
// Invoke:  POST /functions/v1/ingest-gsc        (optional body: {"weeks": 12})
import { createClient } from "jsr:@supabase/supabase-js@2";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

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

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const weeks = (await req.json().catch(() => ({}))).weeks ?? 12;
    const siteUrl = Deno.env.get("GSC_SITE_URL")!; // "sc-domain:example.com" or full URL
    const token = await getAccessToken(GSC_SCOPE);

    const rows: any[] = [];
    const base = { granularity: "weekly", source: "gsc" };

    for (const wk of lastCompleteWeeks(weeks)) {
      const res = await fetch(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
          siteUrl,
        )}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: ymd(wk.start),
            endDate: ymd(wk.end),
            dimensions: [],
            type: "web",
          }),
        },
      );
      if (!res.ok) throw new Error(`GSC query ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const agg = json.rows?.[0];
      const period_start = ymd(wk.start);
      rows.push({ ...base, metric_key: "organic_traffic", segment: "all", period_start, value: agg?.clicks ?? 0 });
      if (agg) {
        rows.push({ ...base, metric_key: "avg_position", segment: "all", period_start, value: +(agg.position ?? 0).toFixed(1) });
      }
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({ source: "gsc", status: "success", rows_written: rows.length });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({ source: "gsc", status: "error", error: String(e) });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
