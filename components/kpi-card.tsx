"use client";

import Link from "next/link";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { Kpi } from "@/lib/metrics";
import { formatValue, deltaTone } from "@/lib/format";

export function KpiCard({
  kpi,
  href,
  comparisonLabel = "vs. previous period",
}: {
  kpi: Kpi;
  href?: string;
  comparisonLabel?: string;
}) {
  const pct = kpi.pct_change;
  const arrow = pct === null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "—";

  const body = (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
        {pct !== null && (
          <span className={`text-xs font-semibold ${deltaTone(pct, kpi.higher_is_better)}`}>
            {arrow} {Math.abs(pct)}%
          </span>
        )}
      </div>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {formatValue(kpi.value, kpi.unit)}
      </p>
      <p className="mt-1 flex items-center justify-between text-xs text-gray-400">
        <span>{comparisonLabel}</span>
        {href && <span className="text-brand">Drill in →</span>}
      </p>

      {kpi.show_trend && kpi.trend.length > 1 && (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpi.trend}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
