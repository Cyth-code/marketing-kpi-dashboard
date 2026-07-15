"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { ScalarKpi } from "@/lib/metrics";

function formatValue(v: number, unit: ScalarKpi["unit"]): string {
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "position") return v.toFixed(1);
  if (unit === "currency")
    return v.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  return v.toLocaleString();
}

/** A rise is "good" or "bad" depending on the metric (bounce rate up = bad). */
function deltaTone(pct: number | null, higherIsBetter: boolean): string {
  if (pct === null || pct === 0) return "text-gray-400";
  const positive = pct > 0;
  const good = positive === higherIsBetter;
  return good ? "text-emerald-600" : "text-rose-600";
}

export function KpiCard({ kpi }: { kpi: ScalarKpi }) {
  const pct = kpi.pct_change;
  const arrow = pct === null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "—";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
      <p className="mt-1 text-xs text-gray-400">vs. previous week</p>

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
}
