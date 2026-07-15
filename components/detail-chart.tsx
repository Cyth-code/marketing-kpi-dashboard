"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function DetailChart({
  data,
}: {
  data: { period_start: string; value: number }[];
}) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        Not enough data points to plot a trend for this range.
      </p>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="period_start"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} />
          <Tooltip
            labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
            formatter={(v: number) => [v.toLocaleString(), "Value"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
