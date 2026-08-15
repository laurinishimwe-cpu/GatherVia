import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, useColorScheme } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "dark" | "light";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: "dark" | "light";
  setMode: (mode: ThemeMode) => Promise<void>;
}

const STORAGE_KEY = "gatekeep.theme.mode";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemMode = useColorScheme() === "light" ? "light" : "dark";
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "system" || stored === "dark" || stored === "light") {
        setModeState(stored);
        Appearance.setColorScheme(stored === "system" ? null : stored);
      }
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode: mode === "system" ? systemMode : mode,
      setMode: async (nextMode) => {
        setModeState(nextMode);
        Appearance.setColorScheme(nextMode === "system" ? null : nextMode);
        await AsyncStorage.setItem(STORAGE_KEY, nextMode);
      },
    }),
    [mode, systemMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeMode must be used inside ThemeProvider");
  return context;
}
