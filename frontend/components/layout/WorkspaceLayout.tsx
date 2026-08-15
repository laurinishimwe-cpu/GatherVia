import { DashboardTopBar } from "./DashboardTopBar";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <DashboardTopBar />
      <main className="min-h-0 flex-1 overflow-hidden overscroll-none">
        {children}
      </main>
    </div>
  );
}
