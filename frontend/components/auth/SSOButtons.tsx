"use client";

import { useGoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

interface SSOButtonsProps {
  onSuccess?: () => void;
}

export function SSOButtons({ onSuccess }: SSOButtonsProps) {
  const { handleGoogleToken, isLoading } = useAuth();


  const googleLogin = useGoogleLogin({
  flow: "implicit",
  onSuccess: async (response) => {
  const token = response.access_token;
   if (!token) return;
   await handleGoogleToken(token);
},
  onError: (err) => console.error("Google login error", err),
});

  const microsoftPlaceholder = () => {
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => googleLogin()}
        className="w-full flex items-center justify-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/5 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-brand-400/10 hover:-translate-y-0.5 disabled:opacity-50"
      >
        <Image src="/Google-logo.svg" alt="" width={18} height={18} />
        Google
      </button>

      {/* Microsoft – placeholder (no functionality) */}
      <button
        type="button"
        onClick={microsoftPlaceholder}
        className="w-full flex items-center justify-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/5 px-4 py-2.5 text-sm font-medium text-foreground/60 transition-all hover:bg-brand-400/10 hover:-translate-y-0.5 cursor-default"
      >
        <Image src="/Microsoft-logo.svg" alt="" width={18} height={18} />
        Microsoft
        <span className="text-[10px] opacity-50 ml-1">(soon)</span>
      </button>
    </div>
  );
}
