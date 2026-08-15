"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChartIcon, EditIcon } from "@/components/ui/Icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: ChartIcon },
  { href: "/dashboard/editor", label: "Editor", icon: EditIcon },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/10 bg-[#0b130d]/96 px-3 py-3 backdrop-blur-xl lg:hidden">
      <ul className="grid grid-cols-2 gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#4fd6be]/30 bg-white/[0.08] text-[#f2efe4]"
                    : "border-white/10 bg-white/[0.03] text-[#a9b3aa] hover:bg-white/[0.06] hover:text-[#f2efe4]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#4fd6be]" : ""}`} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
