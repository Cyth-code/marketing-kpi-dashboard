import { Suspense } from "react";
import { getClusterKpis, type Kpi } from "@/lib/metrics";
import { parseFilters, type SP } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filters/filter-bar";

export const dynamic = "force-dynamic";

export default async function EcommPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { g, range, carryQS, comparison } = parseFilters(searchParams);

  let kpis: Kpi[] = [];
  let err: string | null = null;
  try {
    kpis = await getClusterKpis("ecomm", g, range);
  } catch (e) {
    err = String(e);
  }

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">E-Commerce</h1>
        <p className="text-sm text-gray-500">
          Transactions &amp; conversion · source: GA4 e-commerce
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

      {!err && kpis.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No e-commerce data in this range. Try switching View/Window.
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
    </main>
  );
}
