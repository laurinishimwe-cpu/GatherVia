import {
  AUTH_SESSION_STORAGE_KEY,
  AUTH_TOKEN_COOKIE,
  EVENT_LOCALE_COOKIE,
} from "@/lib/constants/cookies";
import type { AuthSession } from "@/lib/types/auth";

const AUTH_USER_CACHE_KEY = "gathervia.auth.user-cache.v1";
const AUTH_INVALIDATED_EVENT = "gathervia:auth-invalidated";

export function readAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function persistAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
  window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(session.user));
  document.cookie = `${AUTH_TOKEN_COOKIE}=${session.accessToken}; path=/; SameSite=Lax`;
  document.cookie = `${EVENT_LOCALE_COOKIE}=${
    session.user.preferred_language ?? "en"
  }; path=/; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_CACHE_KEY);
  document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${EVENT_LOCALE_COOKIE}=; path=/; max-age=0`;
}

export function getAuthToken(): string | null {
  return readAuthSession()?.accessToken ?? null;
}

export function invalidateAuthSession(): void {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT));
  }
}

export function subscribeToAuthInvalidation(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(AUTH_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(AUTH_INVALIDATED_EVENT, listener);
}

export function readCachedAuthUser(): AuthSession["user"] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession["user"];
  } catch {
    window.localStorage.removeItem(AUTH_USER_CACHE_KEY);
    return null;
  }
}
