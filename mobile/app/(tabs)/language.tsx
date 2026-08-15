import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Check, Languages } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import type { SupportedLanguage } from "@/lib/types/auth";
import { useThemeMode } from "@/context/ThemeContext";
import { LanguageFlag } from "@/components/LanguageFlag";

const languages: Array<{ code: SupportedLanguage; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "de", label: "German", native: "Deutsch" },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { user, updatePreferredLanguage } = useAuth();
  const { resolvedMode } = useThemeMode();
  const light = resolvedMode === "light";
  const colors = light
    ? { background: "#f4f7f6", panel: "#ffffff", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { background: "#07110f", panel: "#10221e", border: "#203e37", text: "#f5f8f7", muted: "#78918b" };
  const [saving, setSaving] = useState<SupportedLanguage | null>(null);
  const isOnboarding = user?.needs_language_selection === true;

  const selectLanguage = async (language: SupportedLanguage) => {
    setSaving(language);
    try {
      await updatePreferredLanguage(language);
      if (isOnboarding) router.replace("/(tabs)/dashboard");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {!isOnboarding ? (
          <Pressable accessibilityLabel="Go back" style={styles.back} onPress={() => router.back()}>
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
        ) : <View style={styles.back} />}
        <Text style={[styles.headerTitle, { color: colors.text }]}>Language</Text>
      </View>

      <View style={styles.introIcon}>
        <Languages color="#4fd6be" size={24} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Choose your language</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        {isOnboarding
          ? "Choose a language to finish setting up your GatherVia account."
          : "GatherVia starts with your phone language when it is supported. You can change it here."}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        {languages.map((language, index) => {
          const selected = user?.preferred_language === language.code;
          return (
            <View key={language.code}>
              <Pressable style={styles.row} onPress={() => selectLanguage(language.code)}>
                <LanguageFlag code={language.code} size={30} />
                <View style={styles.languageCopy}>
                  <Text style={[styles.languageName, { color: colors.text }]}>{language.label}</Text>
                  <Text style={[styles.nativeName, { color: colors.muted }]}>{language.native}</Text>
                </View>
                {saving === language.code ? (
                  <ActivityIndicator color="#4fd6be" size="small" />
                ) : selected ? (
                  <View style={styles.check}>
                    <Check color="#07110f" size={15} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
              {index < languages.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, backgroundColor: "#07110f" },
  header: { height: 58, flexDirection: "row", alignItems: "center" },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#24483f",
  },
  headerTitle: { marginLeft: 13, color: "#f5f8f7", fontSize: 18, fontWeight: "800" },
  introIcon: {
    width: 48,
    height: 48,
    marginTop: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14332c",
  },
  title: { marginTop: 16, color: "#f5f8f7", fontSize: 22, fontWeight: "800" },
  description: { marginTop: 7, color: "#8ca09b", fontSize: 13, lineHeight: 19 },
  card: {
    marginTop: 24,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#203e37",
    backgroundColor: "#10221e",
  },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center" },
  languageCopy: { flex: 1, marginLeft: 12 },
  languageName: { color: "#edf3f1", fontSize: 14, fontWeight: "700" },
  nativeName: { marginTop: 3, color: "#78918b", fontSize: 11 },
  check: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fd6be",
  },
  divider: { height: 1, backgroundColor: "#1e3933" },
});
