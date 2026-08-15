import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getPostAuthRoute } from "@/lib/navigation/auth";
import { useThemeMode } from "@/context/ThemeContext";

WebBrowser.maybeCompleteAuthSession();

const googleRedirectUri = AuthSession.makeRedirectUri({
  native: "com.laurinishimwe.gathervia:/oauthredirect",
});

export default function LoginScreen() {
  const router = useRouter();
  const { user, signIn, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772", errorBackground: "#fff5f5", errorBorder: "#f3b6ba", errorText: "#a12b33" }
    : { background: "#081512", panel: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099", errorBackground: "#38191d", errorBorder: "#8f3b45", errorText: "#ffb9bf" };
  const [googleRequest, , promptGoogleAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: googleRedirectUri,
    selectAccount: true,
    shouldAutoExchangeCode: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(getPostAuthRoute(user));
  }, [router, user]);

  const handleLogin = async () => {
    setError("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      const message = "Enter your email address.";
      setError(message);
      showToast(message, { tone: "error" });
      return;
    }
    if (!password) {
      const message = "Enter your password.";
      setError(message);
      showToast(message, { tone: "error" });
      return;
    }
    if (password.length < 8) {
      const message = "Password must be at least 8 characters.";
      setError(message);
      showToast(message, { tone: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      await signIn({ email: normalizedEmail, password });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to sign in.";
      setError(message);
      showToast(message, { tone: "error", duration: 4200 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      if (!googleRequest) throw new Error("Google sign-in is still initializing.");
      const response = await promptGoogleAsync();
      if (response.type !== "success") {
        if (response.type !== "cancel" && response.type !== "dismiss") {
          throw new Error("Google sign-in did not complete.");
        }
        return;
      }
      let token = response.authentication?.accessToken ?? response.params.access_token;
      if (!token && response.params.code) {
        const authentication = await AuthSession.exchangeCodeAsync(
          {
            clientId: googleRequest.clientId,
            code: response.params.code,
            redirectUri: googleRedirectUri,
            extraParams: {
              code_verifier: googleRequest.codeVerifier ?? "",
            },
          },
          Google.discovery,
        );
        token = authentication.accessToken;
      }
      if (!token) throw new Error("Google did not return an access token.");
      await signInWithGoogle(token);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Google sign‑in failed."
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View className="mb-10">
        <View className="flex-row items-center">
          <Image
            source={require("../../assets/gathervia-mark.png")}
            style={{ width: 52, height: 52, marginRight: 12 }}
            resizeMode="contain"
          />
          <Text style={[styles.brand, { color: colors.text }]}>GatherVia</Text>
        </View>
        <Text style={[styles.tagline, { color: colors.muted }]}>
          Your events, beautifully under control.
        </Text>
      </View>

      <Text style={[styles.welcome, { color: colors.text }]}>
        Welcome to GatherVia
      </Text>

      <TextInput
        style={[styles.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? (
        <View
          accessibilityRole="alert"
          style={[styles.error, { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder }]}
        >
          <Text style={[styles.errorTitle, { color: colors.errorText }]}>Sign in failed</Text>
          <Text style={[styles.errorMessage, { color: colors.errorText }]}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.signInButton}
        onPress={handleLogin}
        disabled={isSubmitting || isGoogleLoading}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#07110f" />
        ) : (
          <Text style={styles.signInText}>Sign in</Text>
        )}
      </Pressable>

      {/* Native Google Sign‑In button */}
      <GoogleSignInButton
        onPress={handleGoogleSignIn}
        isLoading={isGoogleLoading}
        disabled={isSubmitting || isGoogleLoading}
      />

      <Pressable
        style={styles.registerLink}
        onPress={() => router.push("/(auth)/register")}
      >
        <Text style={{ color: colors.muted }}>
          New to GatherVia?{" "}
          <Text style={styles.createAccount}>Create an account</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: { fontSize: 36, fontWeight: "700" },
  tagline: { marginTop: 8, fontSize: 16 },
  welcome: { marginBottom: 20, fontSize: 24, fontWeight: "600" },
  input: { marginBottom: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16 },
  error: { marginTop: 0, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  errorTitle: { fontSize: 14, fontWeight: "600" },
  errorMessage: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  signInButton: { marginTop: 20, alignItems: "center", borderRadius: 16, backgroundColor: "#4fd6be", paddingHorizontal: 16, paddingVertical: 16 },
  signInText: { color: "#07110f", fontWeight: "700" },
  registerLink: { marginTop: 24, alignItems: "center" },
  createAccount: { color: "#176f61", fontWeight: "600" },
});
