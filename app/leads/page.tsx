import { Suspense } from "react";
import {
  getScalarKpis,
  getLatestBreakdown,
  type ScalarKpi,
} from "@/lib/metrics";
import { KpiCard } from "@/components/kpi-card";
import { RankedBar } from "@/components/ranked-bar";
import { TimeWindow } from "@/components/filters/time-window";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const weeks = Number(searchParams?.weeks ?? 12) || 12;

  let kpis: ScalarKpi[] = [];
  let keyEvents: { segment: string; value: number }[] = [];
  let landingPages: { segment: string; value: number }[] = [];
  let mqlByChannel: { segment: string; value: number }[] = [];
  let err: string | null = null;
  try {
    [kpis, keyEvents, landingPages, mqlByChannel] = await Promise.all([
      getScalarKpis("leads", weeks),
      getLatestBreakdown("key_event"),
      getLatestBreakdown("landing_page_conversions"),
      getLatestBreakdown("mql_by_channel"),
    ]);
  } catch (e) {
    err = String(e);
  }

  const latestWeek = kpis?.[0]?.trend.at(-1)?.period_start;

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leads &amp; MQLs</h1>
        <p className="text-sm text-gray-500">
          {latestWeek
            ? `Latest complete week: ${new Date(latestWeek).toLocaleDateString()} · source: GA4 key events`
            : "Lead generation & conversion"}
        </p>
      </header>

      <div className="mb-6">
        <Suspense>
          <TimeWindow />
        </Suspense>
      </div>

      {err && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Could not load data: {err}
        </div>
      )}

      {!err && kpis.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No leads data yet. Run <code>0004_leads.sql</code> and invoke the{" "}
          <code>ingest-leads</code> function to backfill.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            MQLs by Channel · latest week
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Key events by acquisition channel. Generic segmentation until named
            segments are defined.
          </p>
          <RankedBar
            data={mqlByChannel}
            valueLabel="MQLs"
            emptyText="No MQL channel data yet."
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Key Event Volume · latest week
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Which high-value actions fired. Use these event names to define MQL
            segments.
          </p>
          <RankedBar
            data={keyEvents}
            valueLabel="Key events"
            emptyText="No key events recorded — check that GA4 has key events marked."
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Landing Page Conversion · latest week
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Pages driving the most key events (top 15).
          </p>
          {landingPages.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <th className="py-2 font-medium">Landing page</th>
                    <th className="py-2 text-right font-medium">Key events</th>
                  </tr>
                </thead>
                <tbody>
                  {landingPages.map((p) => (
                    <tr key={p.segment} className="border-b border-gray-50">
                      <td className="max-w-xs truncate py-2 text-gray-700" title={p.segment}>
                        {p.segment}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {p.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No landing-page conversions yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
