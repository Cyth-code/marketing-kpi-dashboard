import Link from "next/link";
import { Suspense } from "react";
import {
  getDef,
  getSeries,
  getLatestBreakdown,
  resolveRange,
  type Granularity,
} from "@/lib/metrics";
import { formatValue, deltaTone } from "@/lib/format";
import { FilterBar } from "@/components/filters/filter-bar";
import { DetailChart } from "@/components/detail-chart";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

const CLUSTER_PATH: Record<string, string> = {
  traffic: "/traffic",
  ecomm: "/ecomm",
  leads: "/leads",
};

export default async function MetricDetailPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: SP;
}) {
  const key = params.key;
  const g: Granularity = searchParams?.g === "daily" ? "daily" : "weekly";
  const weeks = Number(searchParams?.weeks ?? 12) || 12;
  const from = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams?.to === "string" ? searchParams.to : undefined;
  const segment = typeof searchParams?.segment === "string" ? searchParams.segment : "all";
  const range = resolveRange({ weeks, from, to });

  const def = await getDef(key);
  if (!def) {
    return (
      <main className="mx-auto max-w-4xl px-8 py-8">
        <p className="text-sm text-gray-500">Unknown metric: {key}</p>
      </main>
    );
  }

  const backHref = CLUSTER_PATH[def.cluster] ?? "/overview";
  let series = await getSeries(key, segment, g, range);

  // Breakdown metric viewed without a segment → offer the segment list.
  let breakdown: { segment: string; value: number }[] = [];
  if (!series.length && segment === "all") {
    breakdown = await getLatestBreakdown(key);
  }

  // Per-period deltas for the table.
  const table = series.map((row, i) => {
    const prev = i > 0 ? series[i - 1].value : null;
    const pct =
      prev === null || prev === 0
        ? null
        : Math.round(((row.value - prev) / prev) * 1000) / 10;
    return { ...row, prev, pct };
  });
  const latest = series.at(-1);
  const latestPct = table.at(-1)?.pct ?? null;
  const comparison = g === "daily" ? "vs. previous day" : "vs. previous week";
  const carry = new URLSearchParams();
  for (const [k, v] of Object.entries({ g, weeks: String(weeks), from, to })) {
    if (v) carry.set(k, String(v));
  }

  return (
    <main className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-2 text-xs text-gray-400">
        <Link href={`${backHref}?${carry.toString()}`} className="hover:text-gray-600">
          ← Back to {def.cluster}
        </Link>
      </div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {def.label}
            {segment !== "all" && (
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-sm font-medium text-brand">
                {segment}
              </span>
            )}
          </h1>
          {latest && (
            <p className="mt-1 text-sm text-gray-500">
              <span className="text-lg font-semibold text-gray-900">
                {formatValue(latest.value, def.unit)}
              </span>{" "}
              latest ·{" "}
              {latestPct !== null && (
                <span className={deltaTone(latestPct, def.higher_is_better)}>
                  {latestPct > 0 ? "▲" : latestPct < 0 ? "▼" : "—"}{" "}
                  {Math.abs(latestPct)}% {comparison}
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="mb-6">
        <Suspense>
          <FilterBar />
        </Suspense>
      </div>

      {breakdown.length > 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Pick a segment to see its trend
          </h2>
          <div className="flex flex-wrap gap-2">
            {breakdown.map((b) => (
              <Link
                key={b.segment}
                href={`/metric/${key}?segment=${encodeURIComponent(b.segment)}&${carry.toString()}`}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-brand hover:text-brand"
              >
                {b.segment} · {b.value.toLocaleString()}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-500">
              {g === "daily" ? "Daily" : "Weekly"} trend
            </h2>
            <DetailChart data={series} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-medium text-gray-500">Data</h2>
            {table.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                      <th className="py-2 font-medium">
                        {g === "daily" ? "Day" : "Week of"}
                      </th>
                      <th className="py-2 text-right font-medium">Value</th>
                      <th className="py-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...table].reverse().map((r) => (
                      <tr key={r.period_start} className="border-b border-gray-50">
                        <td className="py-2 text-gray-700">
                          {new Date(r.period_start).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          {formatValue(r.value, def.unit)}
                        </td>
                        <td className="py-2 text-right">
                          {r.pct === null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className={deltaTone(r.pct, def.higher_is_better)}>
                              {r.pct > 0 ? "▲" : r.pct < 0 ? "▼" : "—"} {Math.abs(r.pct)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No {g} data in this range. Try switching View to{" "}
                {g === "daily" ? "Weekly" : "Daily"} or widening the window.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
