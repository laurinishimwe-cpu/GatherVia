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
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyTheme,
  getSystemTheme,
  isThemePreference,
  resolveTheme,
  type Theme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: Theme;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  defaultPreference?: ThemePreference;
}

function readThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function readStoredPreference(defaultPreference: ThemePreference): ThemePreference {
  if (typeof window === "undefined") return defaultPreference;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemePreference(stored)) return stored;

  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (isThemePreference(legacy)) return legacy;

  return defaultPreference;
}

export function ThemeProvider({
  children,
  defaultPreference = "system",
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(defaultPreference);
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(readThemeFromDocument);
  const [isReady, setIsReady] = useState(false);

  const updateTheme = useCallback((nextPreference: ThemePreference, persist: boolean) => {
    const nextResolvedTheme = resolveTheme(nextPreference);

    setPreferenceState(nextPreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);

    if (persist) {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  }, []);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => updateTheme(nextPreference, true),
    [updateTheme],
  );

  const toggleTheme = useCallback(() => {
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setPreference]);

  useEffect(() => {
    const initialPreference = readStoredPreference(defaultPreference);
    updateTheme(initialPreference, false);
    setIsReady(true);
  }, [defaultPreference, updateTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");

    const handleSystemChange = () => {
      if (preference !== "system") return;
      const nextTheme = getSystemTheme();
      setResolvedTheme(nextTheme);
      applyTheme(nextTheme);
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [preference]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== LEGACY_THEME_STORAGE_KEY) return;
      updateTheme(readStoredPreference(defaultPreference), false);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultPreference, updateTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, isReady, setPreference, toggleTheme }),
    [isReady, preference, resolvedTheme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}