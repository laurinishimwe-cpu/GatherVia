"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { DashboardTopBar } from "@/components/layout/DashboardTopBar";
import { useAuth } from "@/context/AuthContext";
import { checkIsAdmin } from "@/lib/api/admin";

type AccessState =
  | "checking"
  | "allowed"
  | "redirecting";

interface AdminLayoutProps {
  children: ReactNode;
}

function AdminAccessState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50">
        <DashboardTopBar />
      </div>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-3xl border border-brand-400/15 bg-brand-400/[0.04] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-400">
            <ShieldCheck
              aria-hidden="true"
              className="h-7 w-7"
              strokeWidth={1.8}
            />
          </div>

          <h1 className="mt-5 text-lg font-semibold">
            GatherVia Admin
          </h1>

          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-foreground/55">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400/20 border-t-brand-400" />
            {message}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    isHydrated,
    isAuthenticated,
  } = useAuth();

  const [accessState, setAccessState] =
    useState<AccessState>("checking");
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated || !userId) {
      const nextPath = encodeURIComponent(
        pathname || "/admin",
      );

      router.replace(
        `/login?next=${nextPath}`,
      );

      return;
    }

    let cancelled = false;

    checkIsAdmin()
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result.is_admin) {
          setAccessState("redirecting");
          router.replace("/dashboard");
          return;
        }

        setAccessState("allowed");
      })
      .catch((error) => {
        console.error(
          "Unable to verify admin access",
          error,
        );

        if (!cancelled) {
          setAccessState("redirecting");
          router.replace("/dashboard");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    isHydrated,
    pathname,
    router,
    userId,
  ]);

  if (
    !isHydrated ||
    accessState === "checking"
  ) {
    return (
      <AdminAccessState message="Checking admin access…" />
    );
  }

  if (
    !isAuthenticated ||
    !userId ||
    accessState !== "allowed"
  ) {
    return (
      <AdminAccessState message="Redirecting…" />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50">
        <DashboardTopBar />
      </div>

      <div className="border-b border-brand-400/10 bg-brand-400/[0.035]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-400/10 text-brand-400">
            <ShieldCheck
              aria-hidden="true"
              className="h-4 w-4"
              strokeWidth={2}
            />
          </span>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
              GatherVia Admin
            </p>

            <p className="text-xs text-foreground/45">
              Template studio
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
