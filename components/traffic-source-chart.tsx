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

export function TrafficSourceChart({
  data,
}: {
  data: { segment: string; value: number }[];
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-gray-400">No traffic-source data yet.</p>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            type="category"
            dataKey="segment"
            width={110}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            formatter={(v: number) => [v.toLocaleString(), "Sessions"]}
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
