import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "@/components/nav/sidebar";

export const metadata: Metadata = {
  title: "Cyth Marketing KPI Dashboard",
  description: "Traffic, engagement, leads & e-comm KPIs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Suspense fallback={<div className="w-60 shrink-0 border-r border-gray-200 bg-white" />}>
            <Sidebar />
          </Suspense>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
