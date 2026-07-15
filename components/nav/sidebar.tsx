"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/traffic", label: "Traffic & Engagement" },
  { href: "/ecomm", label: "E-Commerce" },
  { href: "/leads", label: "Leads & MQLs", soon: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  // Carry the time-window filter across pages.
  const weeks = sp.get("weeks");
  const qs = weeks ? `?weeks=${weeks}` : "";

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
      <div className="px-5 py-5">
        <div className="text-sm font-semibold text-gray-900">Cyth Marketing</div>
        <div className="text-xs text-gray-400">KPI Dashboard</div>
      </div>
      <nav className="space-y-1 px-2">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={`${n.href}${qs}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{n.label}</span>
              {n.soon && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
