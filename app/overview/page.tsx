import Link from "next/link";
import { Suspense } from "react";
import { getClusterKpis, type Kpi } from "@/lib/metrics";
import { parseFilters, type SP } from "@/lib/filters";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filters/filter-bar";

export const dynamic = "force-dynamic";

function ClusterTile({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
          live
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </Link>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { g, range, carryQS, comparison } = parseFilters(searchParams);

  let kpis: Kpi[] = [];
  let err: string | null = null;
  try {
    kpis = await getClusterKpis("traffic", g, range);
  } catch (e) {
    err = String(e);
  }

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-gray-500">Marketing performance at a glance</p>
        </div>
        <Suspense>
          <FilterBar />
        </Suspense>
      </header>

      {err && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Could not load data: {err}
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium text-gray-500">Traffic &amp; Engagement</h2>
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

      <h2 className="mb-3 mt-8 text-sm font-medium text-gray-500">Clusters</h2>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ClusterTile
          href={`/traffic?${carryQS}`}
          title="Traffic & Engagement"
          desc="Sessions, engagement, bounce, sources, SEO"
        />
        <ClusterTile
          href={`/ecomm?${carryQS}`}
          title="E-Commerce"
          desc="Transactions, sales conversion, cart abandonment"
        />
        <ClusterTile
          href={`/leads?${carryQS}`}
          title="Leads & MQLs"
          desc="Key events, lead conversion, landing-page ranking"
        />
      </section>
    </main>
  );
}
