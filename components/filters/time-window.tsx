"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [4, 8, 12, 26];

export function TimeWindow() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = Number(sp.get("weeks") ?? 12);

  function set(w: number) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    p.set("weeks", String(w));
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-gray-400">Window</span>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {OPTIONS.map((w) => (
          <button
            key={w}
            onClick={() => set(w)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              current === w
                ? "bg-brand text-white"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {w}w
          </button>
        ))}
      </div>
    </div>
  );
}
