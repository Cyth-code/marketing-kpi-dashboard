"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Toggle chips for traffic-source channels. No selection = show all. */
export function ChannelFilter({ channels }: { channels: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selected = new Set(
    (sp.get("channels") ?? "").split(",").filter(Boolean),
  );

  function toggle(c: string) {
    const next = new Set(selected);
    next.has(c) ? next.delete(c) : next.add(c);
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (next.size) p.set("channels", Array.from(next).join(","));
    else p.delete("channels");
    router.push(`${pathname}?${p.toString()}`);
  }

  if (!channels.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-gray-400">Channels</span>
      {channels.map((c) => {
        const on = selected.has(c);
        return (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              on
                ? "border-brand bg-brand/10 text-brand"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {c}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          onClick={() => {
            const p = new URLSearchParams(Array.from(sp.entries()));
            p.delete("channels");
            router.push(`${pathname}?${p.toString()}`);
          }}
          className="ml-1 text-xs text-gray-400 underline hover:text-gray-600"
        >
          clear
        </button>
      )}
    </div>
  );
}
