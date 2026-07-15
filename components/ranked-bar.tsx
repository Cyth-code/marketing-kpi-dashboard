"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#64748b",
];

/**
 * Generic horizontal ranked bar chart for a {segment,value}[] breakdown.
 * If `drillTo` is set, clicking a bar navigates to that metric's detail page
 * for the clicked segment, preserving current granularity/window filters.
 */
export function RankedBar({
  data,
  valueLabel = "Value",
  emptyText = "No data yet.",
  drillTo,
}: {
  data: { segment: string; value: number }[];
  valueLabel?: string;
  emptyText?: string;
  drillTo?: string; // e.g. "/metric/traffic_source"
}) {
  const router = useRouter();
  const sp = useSearchParams();

  if (!data.length) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
  }

  function onBarClick(payload: any) {
    if (!drillTo || !payload) return;
    const seg = payload.segment ?? payload?.payload?.segment;
    if (!seg) return;
    const p = new URLSearchParams(Array.from(sp.entries()));
    p.set("segment", seg);
    router.push(`${drillTo}?${p.toString()}`);
  }

  return (
    <div style={{ height: Math.max(160, data.length * 34) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            type="category"
            dataKey="segment"
            width={130}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            formatter={(v: number) => [v.toLocaleString(), valueLabel]}
            cursor={{ fill: "rgba(79,70,229,0.06)" }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={onBarClick}
            cursor={drillTo ? "pointer" : undefined}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {drillTo && (
        <p className="mt-1 text-center text-[11px] text-gray-400">
          Click a bar to drill into its trend
        </p>
      )}
    </div>
  );
}
