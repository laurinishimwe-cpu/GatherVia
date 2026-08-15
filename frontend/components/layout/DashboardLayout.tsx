"use client";

import { DashboardTopBar } from "./DashboardTopBar";
import { FlyerDraftProvider } from "@/context/FlyerDraftContext";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardTopBar />
      <FlyerDraftProvider>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </FlyerDraftProvider>
    </div>
  );
}
