import { Suspense } from "react";
import { getClusterKpis, getLatestBreakdown, type Kpi } from "@/lib/metrics";
import { parseFilters, type SP } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { RankedBar } from "@/components/ranked-bar";
import { FilterBar } from "@/components/filters/filter-bar";
import { ChannelFilter } from "@/components/filters/channel-filter";

export const dynamic = "force-dynamic";

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { g, range, carryQS, comparison } = parseFilters(searchParams);
  const channels = String(searchParams?.channels ?? "")
    .split(",")
    .filter(Boolean);

  let kpis: Kpi[] = [];
  let allSources: { segment: string; value: number }[] = [];
  let err: string | null = null;
  try {
    [kpis, allSources] = await Promise.all([
      getClusterKpis("traffic", g, range),
      getLatestBreakdown("traffic_source"),
    ]);
  } catch (e) {
    err = String(e);
  }

  const allChannels = allSources.map((s) => s.segment);
  const sources = channels.length
    ? allSources.filter((s) => channels.includes(s.segment))
    : allSources;

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Traffic &amp; Engagement
        </h1>
        <p className="text-sm text-gray-500">Click any card to drill into its trend</p>
      </header>

      <div className="mb-6 space-y-3">
        <Suspense>
          <FilterBar />
        </Suspense>
        <Suspense>
          <ChannelFilter channels={allChannels} />
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

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Traffic Source · latest week
        </h2>
        <RankedBar data={sources} valueLabel="Sessions" drillTo="/metric/traffic_source" />
      </section>
    </main>
  );
}
