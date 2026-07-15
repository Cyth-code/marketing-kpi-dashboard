"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const WEEK_OPTS = [4, 8, 12, 26];

/** Granularity toggle + window presets + custom date range, all URL-driven. */
export function FilterBar({ showGranularity = true }: { showGranularity?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const g = sp.get("g") === "daily" ? "daily" : "weekly";
  const weeks = Number(sp.get("weeks") ?? 12) || 12;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const custom = !!(from && to);

  function update(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    mut(p);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {showGranularity && (
        <div className="inline-flex items-center gap-2">
          <span className="text-xs text-gray-400">View</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {(["weekly", "daily"] as const).map((val) => (
              <button
                key={val}
                onClick={() => update((p) => p.set("g", val))}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  g === val ? "bg-brand text-white" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-gray-400">Window</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {WEEK_OPTS.map((w) => (
            <button
              key={w}
              onClick={() =>
                update((p) => {
                  p.set("weeks", String(w));
                  p.delete("from");
                  p.delete("to");
                })
              }
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !custom && weeks === w
                  ? "bg-brand text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {w}w
            </button>
          ))}
        </div>
      </div>

      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-gray-400">Custom</span>
        <input
          type="date"
          value={from}
          onChange={(e) => update((p) => (e.target.value ? p.set("from", e.target.value) : p.delete("from")))}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => update((p) => (e.target.value ? p.set("to", e.target.value) : p.delete("to")))}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
        />
        {custom && (
          <button
            onClick={() => update((p) => {
              p.delete("from");
              p.delete("to");
            })}
            className="text-xs text-gray-400 underline hover:text-gray-600"
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}
