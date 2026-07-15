import type { Unit } from "@/lib/metrics";

export function formatValue(v: number, unit: Unit): string {
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

/** "▲ 8.4%" style delta with tone class. */
export function deltaTone(pct: number | null, higherIsBetter: boolean): string {
  if (pct === null || pct === 0) return "text-gray-400";
  const good = pct > 0 === higherIsBetter;
  return good ? "text-emerald-600" : "text-rose-600";
}
