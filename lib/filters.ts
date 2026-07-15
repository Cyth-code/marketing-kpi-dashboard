import { resolveRange, type Granularity } from "@/lib/metrics";

export type SP = { [key: string]: string | string[] | undefined };

/** Parse the shared URL filter params into everything a page needs. */
export function parseFilters(searchParams: SP) {
  const g: Granularity = searchParams?.g === "daily" ? "daily" : "weekly";
  const weeks = Number(searchParams?.weeks ?? 12) || 12;
  const from = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams?.to === "string" ? searchParams.to : undefined;
  const range = resolveRange({ weeks, from, to });

  const carry = new URLSearchParams();
  for (const [k, v] of Object.entries({ g, weeks: String(weeks), from, to })) {
    if (v) carry.set(k, String(v));
  }

  return {
    g,
    range,
    carryQS: carry.toString(),
    comparison: g === "daily" ? "vs. previous day" : "vs. previous week",
  };
}
