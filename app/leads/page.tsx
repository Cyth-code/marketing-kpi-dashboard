import { Suspense } from "react";
import Link from "next/link";
import { getClusterKpis, getLatestBreakdown, type Kpi } from "@/lib/metrics";
import { parseFilters, type SP } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { RankedBar } from "@/components/ranked-bar";
import { FilterBar } from "@/components/filters/filter-bar";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { g, range, carryQS, comparison } = parseFilters(searchParams);

  let kpis: Kpi[] = [];
  let keyEvents: { segment: string; value: number }[] = [];
  let landingPages: { segment: string; value: number }[] = [];
  let mqlByChannel: { segment: string; value: number }[] = [];
  let err: string | null = null;
  try {
    [kpis, keyEvents, landingPages, mqlByChannel] = await Promise.all([
      getClusterKpis("leads", g, range),
      getLatestBreakdown("key_event"),
      getLatestBreakdown("landing_page_conversions"),
      getLatestBreakdown("mql_by_channel"),
    ]);
  } catch (e) {
    err = String(e);
  }

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leads &amp; MQLs</h1>
        <p className="text-sm text-gray-500">
          Lead generation &amp; conversion · source: GA4 key events
        </p>
      </header>

      <div className="mb-6">
        <Suspense>
          <FilterBar />
        </Suspense>
      </div>

      {err && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Could not load data: {err}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            href={`/metric/${kpi.key}?${carryQS}`}
            comparisonLabel={comparison}
          />
        ))}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            MQLs by Channel · latest week
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Generic segmentation by acquisition channel.
          </p>
          <RankedBar
            data={mqlByChannel}
            valueLabel="MQLs"
            drillTo="/metric/mql_by_channel"
            emptyText="No MQL channel data yet."
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Key Event Volume · latest week
          </h2>
          <p className="mb-4 text-xs text-gray-400">
            Use these event names to define named MQL segments later.
          </p>
          <RankedBar
            data={keyEvents}
            valueLabel="Key events"
            drillTo="/metric/key_event"
            emptyText="No key events recorded."
          />
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Landing Page Conversion · latest week
        </h2>
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
                  <tr key={p.segment} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="max-w-md truncate py-2 text-gray-700" title={p.segment}>
                      <Link
                        href={`/metric/landing_page_conversions?segment=${encodeURIComponent(p.segment)}&${carryQS}`}
                        className="hover:text-brand hover:underline"
                      >
                        {p.segment}
                      </Link>
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
    </main>
  );
}
