import { Suspense } from "react";
import { getScalarKpis, getTrafficSources, type ScalarKpi } from "@/lib/metrics";
import { KpiCard } from "@/components/kpi-card";
import { TrafficSourceChart } from "@/components/traffic-source-chart";
import { TimeWindow } from "@/components/filters/time-window";
import { ChannelFilter } from "@/components/filters/channel-filter";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const weeks = Number(searchParams?.weeks ?? 12) || 12;
  const channels = String(searchParams?.channels ?? "")
    .split(",")
    .filter(Boolean);

  let kpis: ScalarKpi[] = [];
  let allSources: { segment: string; value: number }[] = [];
  let err: string | null = null;
  try {
    [kpis, allSources] = await Promise.all([
      getScalarKpis("traffic", weeks),
      getTrafficSources(),
    ]);
  } catch (e) {
    err = String(e);
  }

  const allChannels = allSources.map((s) => s.segment);
  const sources = channels.length
    ? allSources.filter((s) => channels.includes(s.segment))
    : allSources;
  const latestWeek = kpis?.[0]?.trend.at(-1)?.period_start;

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Traffic &amp; Engagement
        </h1>
        <p className="text-sm text-gray-500">
          {latestWeek
            ? `Latest complete week: ${new Date(latestWeek).toLocaleDateString()}`
            : " "}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Suspense>
          <TimeWindow />
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
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Traffic Source · latest week
        </h2>
        <TrafficSourceChart data={sources} />
      </section>
    </main>
  );
}
