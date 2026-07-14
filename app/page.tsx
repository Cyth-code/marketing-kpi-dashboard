import { getScalarKpis, getTrafficSources, type ScalarKpi } from "@/lib/metrics";
import { KpiCard } from "@/components/kpi-card";
import { TrafficSourceChart } from "@/components/traffic-source-chart";

// Always render fresh on request (data changes with each ingestion run).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let kpis: ScalarKpi[] = [];
  let sources: { segment: string; value: number }[] = [];
  let err: string | null = null;
  try {
    [kpis, sources] = await Promise.all([
      getScalarKpis("traffic"),
      getTrafficSources(),
    ]);
  } catch (e) {
    err = String(e);
  }

  const latestWeek = kpis?.[0]?.trend.at(-1)?.period_start;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Marketing Metrics
          </h1>
          <p className="text-sm text-gray-500">
            Traffic &amp; Engagement
            {latestWeek && (
              <> · week of {new Date(latestWeek).toLocaleDateString()}</>
            )}
          </p>
        </div>
      </header>

      {err && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Could not load data: {err}. Check env vars and that an ingestion run
          has populated <code>metric_values</code>.
        </div>
      )}

      {!err && kpis.length === 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          No metrics yet. Run the <code>ingest-ga4</code> and{" "}
          <code>ingest-gsc</code> Edge Functions to backfill history.
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
