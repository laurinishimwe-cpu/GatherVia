import "../global.css";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/context/AuthContext";
import { EventProvider } from "@/context/EventContext";
import { FlyerDraftProvider } from "@/context/FlyerDraftContext";
import { ThemeProvider, useThemeMode } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { MOBILE_FLYER_FONT_SOURCES } from "@/lib/flyer/fontRegistry";

function ThemedApplication() {
  const { resolvedMode } = useThemeMode();
  const dark = resolvedMode === "dark";

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setStyle(dark ? "dark" : "light");
    }
  }, [dark]);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: dark ? "#081512" : "#f4f7f6" }}
    >
      <ToastProvider>
        <AuthProvider>
          <ApplicationNavigator />
        </AuthProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

function ApplicationNavigator() {
  const [fontsLoaded, fontError] = useFonts(MOBILE_FLYER_FONT_SOURCES);

  if (!fontsLoaded && !fontError) return null;

  return (
    <EventProvider>
      <FlyerDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </FlyerDraftProvider>
    </EventProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedApplication />
    </ThemeProvider>
  );
}
