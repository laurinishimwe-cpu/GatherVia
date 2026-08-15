"use client";

import { BatteryFull, Wifi } from "lucide-react";
import type { ReactNode } from "react";

interface MobileFrameProps {
  children: ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="relative w-full max-w-[340px] shrink-0 rounded-[clamp(32px,12vw,46px)] bg-black p-[clamp(7px,2.8vw,10px)] shadow-2xl">
      <div className="absolute -left-[3px] top-[21%] h-9 w-[3px] rounded-l bg-neutral-800" />
      <div className="absolute -left-[3px] top-[30%] h-14 w-[3px] rounded-l bg-neutral-800" />
      <div className="absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r bg-neutral-800" />

      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[clamp(26px,10vw,38px)]">
        {children}

        <div className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-[7%] pt-[3.5%] text-white mix-blend-difference">
          <span className="text-[clamp(9px,3.8vw,13px)] font-semibold tracking-wide">19:30</span>
          <div className="absolute left-1/2 top-2 h-[clamp(18px,7.6vw,26px)] w-[29%] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex items-center gap-1.5">
            <SignalBars />
            <Wifi size={14} strokeWidth={2.5} />
            <BatteryFull size={16} strokeWidth={2} />
          </div>
        </div>

        <div className="absolute bottom-2 left-1/2 z-50 h-1 w-[38%] -translate-x-1/2 rounded-full bg-white/40 mix-blend-screen" />
      </div>
    </div>
  );
}

function SignalBars() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <rect x="0" y="7" width="3" height="5" rx="0.5" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.5" />
      <rect x="9" y="3" width="3" height="9" rx="0.5" />
      <rect x="13" y="0" width="3" height="12" rx="0.5" />
    </svg>
  );
}
