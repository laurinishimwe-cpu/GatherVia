"use client";

import Link from "next/link";
import Image from "next/image";
import { UserMenu } from "@/components/layout/UserMenu";

export function DashboardTopBar() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-brand-400/10 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em]">
          <Image
            src="/gathervia-mark.svg"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8"
          />
           <span className="text-base font-semibold tracking-tight">
              Gather<span className="text-brand-400">Via</span>
            </span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
