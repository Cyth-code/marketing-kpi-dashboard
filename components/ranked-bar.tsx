"use client";

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

/** Generic horizontal ranked bar chart for a {segment,value}[] breakdown. */
export function RankedBar({
  data,
  valueLabel = "Value",
  emptyText = "No data yet.",
}: {
  data: { segment: string; value: number }[];
  valueLabel?: string;
  emptyText?: string;
}) {
  if (!data.length) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
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
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
