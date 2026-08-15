import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { GoogleLogo } from "./GoogleLogo";
import { useThemeMode } from "@/context/ThemeContext";

interface GoogleSignInButtonProps {
  onPress: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function GoogleSignInButton({
  onPress,
  isLoading,
  disabled,
}: GoogleSignInButtonProps) {
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  return (
    <Pressable
      style={[styles.button, { borderColor: light ? "#d5e2de" : "#285046" }]}
      onPress={onPress}
      disabled={disabled}
    >
      {isLoading ? (
        <ActivityIndicator color="#4fd6be" />
      ) : (
        <>
          <View style={styles.logo}><GoogleLogo size={20} /></View>
          <Text style={[styles.label, { color: light ? "#10211d" : "#f5f8f7" }]}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16 },
  logo: { marginRight: 12, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#ffffff" },
  label: { fontWeight: "600" },
});
