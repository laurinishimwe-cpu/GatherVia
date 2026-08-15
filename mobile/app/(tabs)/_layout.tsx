import { Tabs } from "expo-router";
import { Home, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeMode } from "@/context/ThemeContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4fd6be",
        tabBarInactiveTintColor: light ? "#657772" : "#78918b",
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 7),
          backgroundColor: light ? "#ffffff" : "#081512",
          borderTopWidth: 1,
          borderTopColor: light ? "#d5e2de" : "#19362f",
          elevation: 0,
          shadowColor: light ? "#506b64" : "#000000",
          shadowOpacity: light ? 0.08 : 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} strokeWidth={2.1} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} strokeWidth={2.1} />
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="language" options={{ href: null }} />
    </Tabs>
  );
}
