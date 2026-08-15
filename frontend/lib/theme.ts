export const THEME_STORAGE_KEY = "gathervia-theme";
export const LEGACY_THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
