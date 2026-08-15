import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRoute } from "@/lib/navigation/auth";

export default function OAuthRedirectScreen() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace(getPostAuthRoute(user));
      return;
    }

    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(auth)/login");
    }, 350);
    return () => clearTimeout(timer);
  }, [router, user]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#4fd6be" size="large" />
      <Text style={styles.title}>Completing Google sign-in…</Text>
      <Text style={styles.hint}>GatherVia will continue automatically.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#07110f" },
  title: { marginTop: 18, color: "#f5f8f7", fontSize: 18, fontWeight: "800" },
  hint: { marginTop: 7, color: "#78918b", fontSize: 12 },
});
