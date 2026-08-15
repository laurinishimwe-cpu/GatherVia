import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Globe2, LogOut, UserRound, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { panel: "#10221e", border: "#25483f", text: "#f5f8f7", muted: "#78918b" };

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 115,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, visible]);

  const navigate = (path: "/(tabs)/profile" | "/(tabs)/language") => {
    onClose();
    router.push(path);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.panel, borderColor: colors.border },
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <UserRound color="#07110f" size={20} strokeWidth={2.2} />
            </View>
            <View style={styles.identity}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {user?.full_name ?? "GatherVia Host"}
              </Text>
              <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close profile menu" onPress={onClose} hitSlop={8}>
              <X color={colors.muted} size={18} />
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable style={styles.menuRow} onPress={() => navigate("/(tabs)/profile")}>
            <UserRound color={colors.text} size={18} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Manage profile</Text>
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => navigate("/(tabs)/language")}>
            <Globe2 color={colors.text} size={18} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Language</Text>
            <Text style={styles.languageValue}>
              {(user?.preferred_language ?? "en").toUpperCase()}
            </Text>
          </Pressable>
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              onClose();
              await signOut();
              router.replace("/(auth)/login");
            }}
          >
            <LogOut color="#f47b7b" size={18} />
            <Text style={styles.logoutLabel}>Sign out</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingTop: 68,
    paddingHorizontal: 16,
    alignItems: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  card: {
    width: "100%",
    maxWidth: 320,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#25483f",
    backgroundColor: "#10221e",
  },
  profileHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fd6be",
  },
  identity: { flex: 1, marginHorizontal: 11 },
  name: { color: "#f5f8f7", fontSize: 14, fontWeight: "700" },
  email: { marginTop: 2, color: "#78918b", fontSize: 11 },
  divider: { height: 1, marginVertical: 12, backgroundColor: "#1d3a33" },
  menuRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  menuLabel: { marginLeft: 11, color: "#dbe5e2", fontSize: 13, fontWeight: "600" },
  languageValue: { marginLeft: "auto", color: "#4fd6be", fontSize: 11, fontWeight: "700" },
  logoutLabel: { marginLeft: 11, color: "#f47b7b", fontSize: 13, fontWeight: "600" },
});
