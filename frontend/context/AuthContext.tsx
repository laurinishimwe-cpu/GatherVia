"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchCurrentUser,
  loginUser,
  loginWithGoogle,
  loginWithMicrosoft,
  logoutAuthSession,
  refreshAuthSession,
  updateCurrentUserLanguage,
  registerUser,
} from "@/lib/api/auth";
import {
  clearAuthSession,
  persistAuthSession,
  readCachedAuthUser,
  readAuthSession,
  subscribeToAuthInvalidation,
} from "@/lib/session/auth-session";
import { ApiError } from "@/lib/api/api";
import { invalidateCachedQuery } from "@/lib/api/query-cache";
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  SupportedLanguage,
} from "@/lib/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  handleGoogleToken: (idToken: string) => Promise<void>;
  handleMicrosoftToken: (idToken: string) => Promise<void>;
  setPreferredLanguage: (language: SupportedLanguage) => Promise<AuthUser>;
  refetchUser: () => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureUserTier(user: AuthUser): AuthUser {
  return {
    ...user,
    tier: user.tier ?? "free",
  };
}

function applySession(
  session: AuthSession,
  setters: {
    setUser: (user: AuthUser) => void;
    setAccessToken: (token: string | null) => void;
  },
) {
  const user = ensureUserTier(session.user);
  setters.setUser(user);
  if (session.accessToken) {
    setters.setAccessToken(session.accessToken);
  }
  persistAuthSession({ ...session, user });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Restore session ──────────────────────────────
  const restoreSession = useCallback(async () => {
    const stored = readAuthSession();
    const cachedUser = stored?.user ?? readCachedAuthUser();
    if (cachedUser) {
      setUser(ensureUserTier(cachedUser));
      setAccessToken(stored?.accessToken ?? null);
    }
    try {
      const session = await refreshAuthSession();
      applySession(session, { setUser, setAccessToken });
      setError(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        invalidateCachedQuery();
        clearAuthSession();
        setUser(null);
        setAccessToken(null);
      } else if (cachedUser) {
        setError("You appear to be offline. Your session will reconnect automatically.");
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // ── Refresh user data (exposed as refetchUser) ──
  const refetchUser = useCallback(async () => {
    try {
      const currentUser = ensureUserTier(await fetchCurrentUser());
      setUser(currentUser);
      const stored = readAuthSession();
      const token = stored?.accessToken ?? null;
      persistAuthSession({ accessToken: token ?? "", user: currentUser });
    } catch {
      // ignore
    }
  }, []);

  // ── Explicit token refresh (exposed) ──────────────
  const refreshToken = useCallback(async () => {
    try {
      const session = await refreshAuthSession();
      applySession(session, { setUser, setAccessToken });
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        invalidateCachedQuery();
        clearAuthSession();
        setUser(null);
        setAccessToken(null);
      }
      throw caughtError;
    }
  }, []);

  // ── Hydrate on mount ──
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void restoreSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [restoreSession]);

  useEffect(() => subscribeToAuthInvalidation(() => {
    invalidateCachedQuery();
    setUser(null);
    setAccessToken(null);
  }), []);

  // ── Renew the session before the one-hour access token expires ──
  useEffect(() => {
    if (!user || !isHydrated) return;

    const interval = window.setInterval(async () => {
      try {
        const session = await refreshAuthSession();
        applySession(session, { setUser, setAccessToken });
      } catch (caughtError) {
        if (caughtError instanceof ApiError && caughtError.status === 401) {
          invalidateCachedQuery();
          clearAuthSession();
          setUser(null);
          setAccessToken(null);
        }
      }
    }, 45 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [user, isHydrated]);

  // ── Login / Register / SSO ────────────────────────
  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await loginUser(payload);
      applySession(session, { setUser, setAccessToken });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await registerUser(payload);
      applySession(session, { setUser, setAccessToken });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Registration failed.");
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGoogleToken = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await loginWithGoogle({ provider_token: token });
      applySession(session, { setUser, setAccessToken });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Google login failed.");
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMicrosoftToken = useCallback(async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await loginWithMicrosoft({ provider_token: idToken });
      applySession(session, { setUser, setAccessToken });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Microsoft login failed.");
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Set preferred language ───────────────────────
  const setPreferredLanguage = useCallback(
    async (language: SupportedLanguage) => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedUser = ensureUserTier(await updateCurrentUserLanguage(language));
        setUser(updatedUser);
        const currentToken = accessToken ?? readAuthSession()?.accessToken ?? "";
        persistAuthSession({ accessToken: currentToken, user: updatedUser });
        return updatedUser;
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save.");
        throw caughtError;
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  const logout = useCallback(async () => {
    const revokeSession = logoutAuthSession().catch(() => undefined);
    invalidateCachedQuery();
    clearAuthSession();
    setUser(null);
    setAccessToken(null);
    setError(null);
    await revokeSession;
  }, []);

  // ── isAuthenticated depends ONLY on user ─────────
  const isAuthenticated = Boolean(user);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated,
      isLoading,
      isHydrated,
      error,
      login,
      register,
      handleGoogleToken,
      handleMicrosoftToken,
      setPreferredLanguage,
      refetchUser,
      refreshToken,   // NEW
      logout,
    }),
    [
      user,
      accessToken,
      isAuthenticated,
      isLoading,
      isHydrated,
      error,
      login,
      register,
      handleGoogleToken,
      handleMicrosoftToken,
      setPreferredLanguage,
      refetchUser,
      refreshToken,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
