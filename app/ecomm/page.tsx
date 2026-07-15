import { Suspense } from "react";
import { getScalarKpis, type ScalarKpi } from "@/lib/metrics";
import { KpiCard } from "@/components/kpi-card";
import { TimeWindow } from "@/components/filters/time-window";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function EcommPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const weeks = Number(searchParams?.weeks ?? 12) || 12;

  let kpis: ScalarKpi[] = [];
  let err: string | null = null;
  try {
    kpis = await getScalarKpis("ecomm", weeks);
  } catch (e) {
    err = String(e);
  }

  const latestWeek = kpis?.[0]?.trend.at(-1)?.period_start;

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">E-Commerce</h1>
        <p className="text-sm text-gray-500">
          {latestWeek
            ? `Latest complete week: ${new Date(latestWeek).toLocaleDateString()} · source: GA4 e-commerce`
            : "Transactions & conversion"}
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
          No e-commerce data yet. Run <code>0003_ecomm.sql</code> and invoke the{" "}
          <code>ingest-ecomm</code> function to backfill.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </section>
    </main>
  );
}
