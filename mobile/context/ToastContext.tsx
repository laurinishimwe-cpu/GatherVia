import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { AlertCircle, CheckCircle2, Info } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";

type ToastTone = "info" | "success" | "error";

interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";

  const hideToast = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 100,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [progress]);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    progress.stopAnimation();
    setToast({ message, tone: options?.tone ?? "info" });
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(hideToast, options?.duration ?? 2200);
  }, [hideToast, progress]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const tone = toast?.tone ?? "info";
  const accent = tone === "error" ? "#e66d72" : tone === "success" ? "#4fd6be" : "#63bce7";
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.layer}>
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.toast,
              {
                backgroundColor: light ? "#ffffff" : "#10221e",
                borderColor: light ? "#d5e2de" : "#285046",
                opacity: progress,
                transform: [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
                ],
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: `${accent}20` }]}><Icon color={accent} size={17} /></View>
            <Text numberOfLines={3} style={[styles.message, { color: light ? "#10211d" : "#f5f8f7" }]}>{toast.message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: Platform.OS === "android" ? 42 : 54, left: 14, right: 14, zIndex: 1000, alignItems: "center" },
  toast: { width: "100%", maxWidth: 430, minHeight: 50, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 9, elevation: 7, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  icon: { width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  message: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
