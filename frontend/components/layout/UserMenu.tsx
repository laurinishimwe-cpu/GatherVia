"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AvatarPlaceholder } from "@/components/ui/AvatarPlaceholder";
import { checkIsAdmin } from "@/lib/api/admin";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  checkIsAdmin()
    .then(data => setIsAdmin(data.is_admin))
    .catch(() => setIsAdmin(false));
}, []);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const handleSignOut = () => {
    setOpen(false);
    logout();
    router.push("/");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center h-9 w-9 rounded-full border border-brand-400/20 bg-brand-400/5 hover:bg-brand-400/10 transition"
        aria-label="User menu"
      >
        <AvatarPlaceholder />
      </button>
      {open && (
        <div className="absolute right-0 mt-6 w-64 rounded-2xl border border-brand-400/10 bg-background/95 backdrop-blur-xl shadow-xl z-50 p-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-400/30 bg-brand-400/5 mb-3">
              <AvatarPlaceholder />
            </div>
            <h3 className="text-base font-semibold truncate max-w-full">
              {user.full_name}
            </h3>
            <p className="text-sm text-foreground/60 truncate max-w-full mt-0.5">
              {user.email}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Link
  href="/dashboard/profile"
  onClick={() => setOpen(false)}
  className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-brand-400/10 transition"
>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400/10 text-brand-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              Manage profile
            </Link>

           <Link
  href="/dashboard/settings"
  onClick={() => setOpen(false)}
  className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-brand-400/10 transition"
>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400/10 text-brand-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              System settings
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-brand-400/10 transition"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400/10 text-brand-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                </span>
                Admin panel
              </Link>
            )}
          </div>

          <div className="border-t border-brand-400/10 my-3" />

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-400/10 transition"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-400/10 text-red-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
