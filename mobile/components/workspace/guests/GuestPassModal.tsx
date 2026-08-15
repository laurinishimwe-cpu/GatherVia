import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Download, Share2, X } from "lucide-react-native";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { downloadStoredGuestInvitation } from "@/lib/api/flyers";
import type { GuestOwnerView } from "@/lib/types/guest";

type ImageFormat = "png" | "jpg";

export function GuestPassModal({ guest, eventId, categories, categoriesEnabled, onClose }: {
  guest: GuestOwnerView | null;
  eventId: string | null;
  categories: string[];
  categoriesEnabled: boolean;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ImageFormat>("png");
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [renderedUri, setRenderedUri] = useState<string | null>(null);
  const [renderError, setRenderError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { resolvedMode } = useThemeMode();
  const { showToast } = useToast();
  const light = resolvedMode === "light";
  const colors = light
    ? { card: "#ffffff", panel: "#f4f7f6", border: "#d5e2de", text: "#10211d", muted: "#657772" }
    : { card: "#0b1815", panel: "#10221e", border: "#285046", text: "#f5f8f7", muted: "#89a099" };

  useEffect(() => {
    if (!guest || !categoriesEnabled) {
      setSelectedCategory(undefined);
      return;
    }
    setSelectedCategory(categories.includes(guest.category) ? guest.category : categories[0]);
  }, [categories, categoriesEnabled, guest]);

  useEffect(() => {
    if (!guest || !eventId || (categoriesEnabled && !selectedCategory)) {
      setRenderedUri(null);
      return;
    }
    let cancelled = false;
    let temporaryUri: string | null = null;
    setRenderedUri(null);
    setRenderError("");
    downloadStoredGuestInvitation(eventId, guest.id, format, selectedCategory)
      .then((uri) => {
        temporaryUri = uri;
        if (cancelled) {
          void FileSystem.deleteAsync(uri, { idempotent: true });
        } else {
          setRenderedUri(uri);
        }
      })
      .catch((error) => {
        if (!cancelled) setRenderError(error instanceof Error ? error.message : "Could not prepare invitation.");
      });
    return () => {
      cancelled = true;
      if (temporaryUri) void FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    };
  }, [categoriesEnabled, eventId, format, guest, selectedCategory]);

  const getRenderedFile = () => {
    if (!renderedUri) throw new Error(renderError || "The invitation is still being prepared.");
    return renderedUri;
  };

  const save = async () => {
    setBusy("save");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Photo permission is required to save the flyer.");
      const uri = getRenderedFile();
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast(`${format.toUpperCase()} invitation saved to your gallery.`, { tone: "success" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save invitation.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
      const uri = getRenderedFile();
      await Sharing.shareAsync(uri, { mimeType: format === "jpg" ? "image/jpeg" : "image/png", dialogTitle: `Share ${guest?.full_name ?? "guest"} invitation` });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not share invitation.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={Boolean(guest)} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>Guest pass</Text><Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>{guest?.full_name}</Text></View><Pressable accessibilityLabel="Close pass" onPress={onClose} style={[styles.close, { borderColor: colors.border }]}><X color={colors.muted} size={17} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.previewArea} showsVerticalScrollIndicator={false}>
            {renderedUri ? (
              <Image source={{ uri: renderedUri }} resizeMode="contain" style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewLoading]}>
                {renderError ? <Text style={styles.previewError}>{renderError}</Text> : <ActivityIndicator color="#4fd6be" />}
              </View>
            )}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.border }]}> 
            {categoriesEnabled && categories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
                {categories.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={[
                      styles.category,
                      { borderColor: colors.border, backgroundColor: colors.panel },
                      selectedCategory === category && styles.categoryActive,
                    ]}
                  >
                    <Text style={[styles.categoryText, { color: selectedCategory === category ? "#07110f" : colors.muted }]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={[styles.segment, { backgroundColor: colors.panel }]}>{(["png", "jpg"] as const).map((item) => <Pressable key={item} onPress={() => setFormat(item)} style={[styles.segmentButton, format === item && styles.segmentActive]}><Text style={[styles.segmentText, { color: format === item ? "#07110f" : colors.muted }]}>{item.toUpperCase()}</Text></Pressable>)}</View>
            <View style={styles.actions}>
              <Pressable disabled={Boolean(busy) || !renderedUri} onPress={save} style={[styles.action, { borderColor: colors.border }, !renderedUri && styles.disabled]}>{busy === "save" ? <ActivityIndicator color="#4fd6be" size="small" /> : <Download color="#4fd6be" size={17} />}<Text style={[styles.actionText, { color: colors.text }]}>Save flyer</Text></Pressable>
              <Pressable disabled={Boolean(busy) || !renderedUri} onPress={share} style={[styles.action, styles.share, !renderedUri && styles.disabled]}>{busy === "share" ? <ActivityIndicator color="#07110f" size="small" /> : <Share2 color="#07110f" size={17} />}<Text style={[styles.actionText, { color: "#07110f" }]}>Share</Text></Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 14, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.76)" },
  modal: { width: "100%", maxWidth: 440, height: "92%", alignSelf: "center", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  header: { minHeight: 64, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "800" },
  subtitle: { maxWidth: 270, marginTop: 2, fontSize: 9 },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewArea: { padding: 14, alignItems: "center" },
  preview: { width: 284, aspectRatio: 9 / 16, backgroundColor: "#111111" },
  previewLoading: { alignItems: "center", justifyContent: "center", padding: 20 },
  previewError: { color: "#e77b7f", fontSize: 10, textAlign: "center" },
  footer: { padding: 12, borderTopWidth: 1 },
  categories: { gap: 7, paddingBottom: 9 },
  category: { minHeight: 31, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  categoryActive: { borderColor: "#4fd6be", backgroundColor: "#4fd6be" },
  categoryText: { fontSize: 9, fontWeight: "800" },
  segment: { height: 38, padding: 3, borderRadius: 20, flexDirection: "row" },
  segmentButton: { flex: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: "#4fd6be" },
  segmentText: { fontSize: 10, fontWeight: "800" },
  actions: { marginTop: 9, flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 43, borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  share: { backgroundColor: "#4fd6be", borderColor: "#4fd6be" },
  actionText: { fontSize: 10, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
