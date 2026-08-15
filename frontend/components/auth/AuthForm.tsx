"use client";

import { useState, useCallback } from "react";
import { SSOButtons } from "@/components/auth/SSOButtons";
import { useAuth } from "@/context/AuthContext";

interface AuthFormProps {
  onSuccess?: () => void;
}

const inputClass =
  "w-full rounded-2xl border border-brand-400/20 bg-background px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-foreground/40 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20";

export function AuthForm({ onSuccess }: AuthFormProps) {
  const { login, register, isLoading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Field‑level validation
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Invalid email" : null;
  const passwordError = password && password.length < 8 ? "At least 8 characters" : null;
  const fullNameError = mode === "signup" && fullName && fullName.trim().length < 2 ? "Required" : null;

  const canSubmit =
    email &&
    !emailError &&
    password &&
    !passwordError &&
    (mode === "login" || (fullName && !fullNameError));

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLocalError(null);
      if (!canSubmit) return;

      try {
        if (mode === "signup") {
          await register({ email, password, full_name: fullName.trim() });
        } else {
          await login({ email, password });
        }
        onSuccess?.();
      } catch (caughtError) {
        const msg =
          caughtError instanceof Error ? caughtError.message : "Authentication failed.";
        setLocalError(msg);
      }
    },
    [canSubmit, email, fullName, mode, password, login, register, onSuccess],
  );

  const displayError = localError || error;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 rounded-full border border-brand-400/20 bg-brand-400/5 p-1">
        {(["login", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setLocalError(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === item
                ? "bg-brand-400 text-black"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {item === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <SSOButtons onSuccess={onSuccess} />

      <div className="relative py-2 text-center text-xs uppercase tracking-[0.18em] text-foreground/40">
        <span className="relative z-10 bg-background px-3">or use email</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-brand-400/10" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${inputClass} ${fullNameError ? "border-red-400/50 focus:border-red-400" : ""}`}
              placeholder="Amina Yusuf"
            />
            {fullNameError && (
              <p className="text-xs text-red-400">{fullNameError}</p>
            )}
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} ${emailError ? "border-red-400/50 focus:border-red-400" : ""}`}
            placeholder="you@example.com"
          />
          {emailError && (
            <p className="text-xs text-red-400">{emailError}</p>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10 ${passwordError ? "border-red-400/50 focus:border-red-400" : ""}`}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M15 12a3 3 0 01-3 3m0 0v0m6.978-4.343A9.97 9.97 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 013.022-4.622" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-400">{passwordError}</p>
          )}
        </label>

        {displayError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {displayError}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || isLoading}
          className={`w-full rounded-full bg-brand-400 px-5 py-3 text-sm font-semibold text-black transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(79,214,190,0.35)] border border-brand-200/30 disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
              </svg>
              Loading…
            </>
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setLocalError(null);
        }}
        className="w-full text-sm font-medium text-foreground/60 hover:text-foreground transition"
      >
        {mode === "login" ? "Need an account? Sign up" : "Already registered? Sign in"}
      </button>
    </div>
  );
}
