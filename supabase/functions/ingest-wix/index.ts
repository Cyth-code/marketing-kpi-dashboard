// Supabase Edge Function: pull authoritative orders from Wix eCommerce.
// Self-contained — paste directly into the Supabase dashboard Edge Functions editor.
// Invoke:  POST /functions/v1/ingest-wix        (optional body: {"weeks": 12})
//
// Secrets required: WIX_API_KEY, WIX_SITE_ID  (WIX_ACCOUNT_ID optional)
import { createClient } from "jsr:@supabase/supabase-js@2";

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

type Row = {
  metric_key: string;
  segment: string;
  period_start: string;
  granularity: string;
  value: number;
  source: string;
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const weeks = (await req.json().catch(() => ({}))).weeks ?? 12;
    const apiKey = Deno.env.get("WIX_API_KEY");
    const siteId = Deno.env.get("WIX_SITE_ID");
    const accountId = Deno.env.get("WIX_ACCOUNT_ID"); // optional
    if (!apiKey || !siteId) throw new Error("Missing WIX_API_KEY / WIX_SITE_ID");

    const range = lastCompleteWeeks(weeks);
    const startDate = range[0].start;
    const yest = new Date();
    yest.setUTCDate(yest.getUTCDate() - 1);
    const thisMonday = ymd(mondayOf(new Date()));
    const startISO = `${ymd(startDate)}T00:00:00Z`;
    const endISO = `${ymd(yest)}T23:59:59Z`;

    const headers: Record<string, string> = {
      Authorization: apiKey,
      "wix-site-id": siteId,
      "Content-Type": "application/json",
    };
    if (accountId) headers["wix-account-id"] = accountId;

    // --- paginate Wix Search Orders across the whole range ---
    const orders: { date: string; amount: number }[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const search = cursor
        ? { cursorPaging: { limit: 100, cursor } }
        : {
            filter: {
              $and: [
                { createdDate: { $gte: startISO } },
                { createdDate: { $lte: endISO } },
              ],
            },
            sort: [{ fieldName: "createdDate", order: "ASC" }],
            cursorPaging: { limit: 100 },
          };
      const res = await fetch("https://www.wixapis.com/ecom/v1/orders/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ search }),
      });
      if (!res.ok) throw new Error(`Wix search ${res.status}: ${await res.text()}`);
      const j = await res.json();
      for (const o of j.orders ?? []) {
        orders.push({
          date: o.createdDate,
          amount: parseFloat(o.priceSummary?.total?.amount ?? "0") || 0,
        });
      }
      cursor = j.metadata?.hasNext ? j.metadata?.cursors?.next ?? null : null;
    } while (cursor && ++guard < 200);

    // --- bucket orders into weeks + days ---
    type B = { tx: number; rev: number };
    const wk = new Map<string, B>();
    const dy = new Map<string, B>();
    for (const o of orders) {
      const d = new Date(o.date);
      const w = ymd(mondayOf(d));
      const day = ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
      const bw = wk.get(w) ?? { tx: 0, rev: 0 };
      bw.tx += 1;
      bw.rev += o.amount;
      wk.set(w, bw);
      const bd = dy.get(day) ?? { tx: 0, rev: 0 };
      bd.tx += 1;
      bd.rev += o.amount;
      dy.set(day, bd);
    }

    // Sessions (GA4) for the range: used to (a) compute conversion and
    // (b) enumerate every period so Wix overwrites any legacy GA4 rows.
    const { data: sess } = await supabase
      .from("metric_values")
      .select("period_start,value,granularity")
      .eq("metric_key", "site_traffic")
      .eq("segment", "all")
      .gte("period_start", ymd(startDate));
    const sessMap = new Map<string, number>(); // "gran|period" -> sessions
    const periods = new Set<string>(); // "gran|period"
    for (const s of sess ?? []) {
      sessMap.set(`${s.granularity}|${s.period_start}`, s.value);
      periods.add(`${s.granularity}|${s.period_start}`);
    }
    // include periods with Wix orders even if no sessions were recorded
    for (const w of wk.keys()) periods.add(`weekly|${w}`);
    for (const d of dy.keys()) periods.add(`daily|${d}`);

    const rows: Row[] = [];
    for (const key of periods) {
      const [gran, period] = key.split("|");
      if (gran === "weekly" && period === thisMonday) continue; // complete weeks only
      const b = (gran === "daily" ? dy : wk).get(period);
      const tx = b?.tx ?? 0;
      const rev = b?.rev ?? 0;
      const sessions = sessMap.get(key) ?? 0;
      const conv = sessions ? (tx / sessions) * 100 : 0;
      rows.push({ granularity: gran, source: "wix", segment: "all", metric_key: "ecomm_transactions", period_start: period, value: tx });
      rows.push({ granularity: gran, source: "wix", segment: "all", metric_key: "ecomm_revenue", period_start: period, value: +rev.toFixed(2) });
      rows.push({ granularity: gran, source: "wix", segment: "all", metric_key: "sales_conversion_rate", period_start: period, value: +conv.toFixed(2) });
    }

    const { error } = await supabase
      .from("metric_values")
      .upsert(rows, { onConflict: "metric_key,segment,period_start,granularity" });
    if (error) throw error;

    await supabase.from("ingestion_runs").insert({ source: "wix", status: "success", rows_written: rows.length });
    return new Response(JSON.stringify({ ok: true, rows: rows.length, orders: orders.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("ingestion_runs").insert({ source: "wix", status: "error", error: String(e) });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
