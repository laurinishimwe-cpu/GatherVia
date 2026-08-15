"use client";

import {
  Suspense,
  useEffect,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";

function getSafeNextPath(
  requestedPath: string | null,
): string {
  if (
    !requestedPath ||
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//")
  ) {
    return "/dashboard";
  }

  return requestedPath;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    isHydrated,
    isAuthenticated,
  } = useAuth();

  const nextPath = getSafeNextPath(
    searchParams.get("next"),
  );

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      return;
    }

    router.replace(nextPath);
  }, [
    isAuthenticated,
    isHydrated,
    nextPath,
    router,
  ]);

  if (isHydrated && isAuthenticated) {
    return null;
  }

  return (
    <AuthShell
      title="Continue with GatherVia"
      subtitle="Sign in or create an account to create, invite and welcome your guests."
    >
      <AuthForm
        onSuccess={() => {
          router.replace(nextPath);
        }}
      />
    </AuthShell>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="flex items-center gap-3 rounded-full border border-brand-400/15 bg-brand-400/5 px-5 py-3 text-sm text-foreground/60">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400/25 border-t-brand-400" />
        Loading GatherVia…
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}