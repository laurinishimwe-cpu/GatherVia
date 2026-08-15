"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function DashboardRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isHydrated, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace("/login?next=/dashboard");
    }
  }, [isHydrated, isAuthenticated, router]);


  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-foreground/60">
        Checking authentication…
      </div>
    );
  }


  return <>{children}</>;
}
