import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import {
  fetchCurrentUser,
  loginUser,
  loginWithGoogle,
  logoutCurrentSession,
  refreshAuthSession,
  registerUser,
  updateCurrentUserLanguage,
} from "@/lib/api/auth";
import {
  clearAuthSession,
  hydrateAuthSession,
  persistAuthSession,
  subscribeToAuthInvalidation,
} from "@/lib/session/auth-session";
import { invalidateCachedQuery } from "@/lib/api/query-cache";
import {
  configurePlanPurchases,
  resetPlanPurchasesUser,
} from "@/lib/iap/plans";
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  SupportedLanguage,
} from "@/lib/types/auth";
import { ApiError } from "@/lib/api/api";

const BYPASS_AUTH = process.env.EXPO_PUBLIC_BYPASS_AUTH === "true";

function getSystemLanguage(): AuthUser["preferred_language"] {
  const language = getLocales()[0]?.languageCode;
  return language && ["en", "fr", "es", "de"].includes(language)
    ? (language as AuthUser["preferred_language"])
    : "en";
}

const DEVELOPMENT_USER: AuthUser = {
  id: "mobile-development-user",
  email: "developer@gathervia.local",
  full_name: "GatherVia Host",
  auth_provider: "manual",
  auth_providers: ["manual"],
  has_password: true,
  tier: "free",
  preferred_language: getSystemLanguage(),
  needs_language_selection: false,
  historic_events: [],
};

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signInWithGoogle: (token: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  updatePreferredLanguage: (language: SupportedLanguage) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    BYPASS_AUTH ? DEVELOPMENT_USER : null,
  );
  const [isLoading, setIsLoading] = useState(!BYPASS_AUTH);

  useEffect(() => {
    if (BYPASS_AUTH) return;

    hydrateAuthSession().then(async (session) => {
      if (session) {
        try {
          const restored = await refreshAuthSession();
          await persistAuthSession(restored);
          setUser(restored.user);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            invalidateCachedQuery();
            await clearAuthSession();
          } else {
            // A temporary network or backend outage must not destroy the session.
            setUser(session.user);
          }
        }
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => subscribeToAuthInvalidation(() => {
    invalidateCachedQuery();
    setUser(null);
  }), []);

  useEffect(() => {
    if (!user?.id || BYPASS_AUTH) return;
    void configurePlanPurchases(user.id).catch(() => {
      // The Plans screen displays the actionable store configuration state.
    });
  }, [user?.id]);

  const completeAuth = async (session: AuthSession) => {
    invalidateCachedQuery();
    await persistAuthSession(session);
    setUser(session.user);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    signIn: async (payload) => completeAuth(await loginUser(payload)),
    signInWithGoogle: async (token) => completeAuth(await loginWithGoogle({ provider_token: token })),
    signUp: async (payload) => completeAuth(await registerUser(payload)),
    signOut: async () => {
      const revokeSession = logoutCurrentSession().catch(() => undefined);
      await resetPlanPurchasesUser().catch(() => undefined);
      invalidateCachedQuery();
      await clearAuthSession();
      setUser(null);
      await revokeSession;
    },
    updatePreferredLanguage: async (language) => {
      if (BYPASS_AUTH) {
        setUser((current) => current ? { ...current, preferred_language: language } : current);
        return;
      }
      setUser(await updateCurrentUserLanguage(language));
    },
    refreshUser: async () => {
      if (BYPASS_AUTH) return;
      setUser(await fetchCurrentUser());
    },
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
