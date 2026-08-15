import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Images, LayoutTemplate, PenLine, X } from "lucide-react-native";
import { useThemeMode } from "@/context/ThemeContext";
import type { EventRecord } from "@/lib/types/event";

type CreationStep = "method" | "details";

export interface PendingFlyerSelection {
  uri: string;
  name: string;
  type: string;
  width: number;
  height: number;
  cached: boolean;
}

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onBrowseTemplates: () => void;
  onCreate: (
    title: string,
    eventType: EventRecord["event_type"],
    flyer: PendingFlyerSelection | null,
  ) => Promise<void>;
}

const eventTypes: Array<{
  label: string;
  value: EventRecord["event_type"];
}> = [
  { label: "Wedding", value: "marriage" },
  { label: "Corporate", value: "corporate" },
  { label: "Birthday", value: "private" },
  { label: "Party", value: "private" },
  { label: "Conference", value: "conference" },
  { label: "Other", value: "other" },
];

export function CreateEventModal({
  visible,
  onClose,
  onBrowseTemplates,
  onCreate,
}: CreateEventModalProps) {
  const { resolvedMode } = useThemeMode();
  const lightMode = resolvedMode === "light";
  const colors = lightMode
    ? {
        overlay: "rgba(10, 25, 21, 0.4)",
        card: "#ffffff",
        panel: "#f0f7f5",
        input: "#f7fbfa",
        border: "#cfe1dc",
        text: "#10211d",
        muted: "#60756f",
        icon: "#dff3ed",
      }
    : {
        overlay: "rgba(0, 0, 0, 0.72)",
        card: "#0b1815",
        panel: "#10221e",
        input: "#10221e",
        border: "#285046",
        text: "#f5f8f7",
        muted: "#8ca09b",
        icon: "#17352e",
      };
  const [step, setStep] = useState<CreationStep>("method");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventRecord["event_type"] | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [flyer, setFlyer] = useState<PendingFlyerSelection | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      entrance.setValue(0);
      Animated.timing(entrance, {
        toValue: 1,
        duration: 130,
        useNativeDriver: true,
      }).start();
    }
    if (!visible) {
      setStep("method");
      setTitle("");
      setEventType(null);
      setError("");
      setFlyer(null);
    }
  }, [entrance, visible]);

  const removeCachedFlyer = async (selection: PendingFlyerSelection | null) => {
    if (!selection?.cached) return;
    await FileSystem.deleteAsync(selection.uri, { idempotent: true }).catch(() => undefined);
  };

  const pickFlyer = async () => {
    if (isPicking || isCreating) return;
    setError("");
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const extension =
        asset.fileName?.split(".").pop()?.toLowerCase() ||
        asset.mimeType?.split("/").pop()?.replace("jpeg", "jpg") ||
        "jpg";
      let uri = asset.uri;
      let cached = false;
      if (FileSystem.cacheDirectory) {
        const destination = `${FileSystem.cacheDirectory}gathervia-create-${Date.now()}.${extension}`;
        try {
          await FileSystem.copyAsync({ from: asset.uri, to: destination });
          uri = destination;
          cached = true;
        } catch {
          // The picker URI remains usable if a device does not allow a cache copy.
        }
      }

      const nextFlyer: PendingFlyerSelection = {
        uri,
        name: asset.fileName ?? `flyer-${Date.now()}.${extension}`,
        type: asset.mimeType ?? `image/${extension === "jpg" ? "jpeg" : extension}`,
        width: Math.max(asset.width || 1080, 1),
        height: Math.max(asset.height || 1920, 1),
        cached,
      };
      await removeCachedFlyer(flyer);
      setFlyer(nextFlyer);
      setStep("details");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not open this image.");
    } finally {
      setIsPicking(false);
    }
  };

  const closeAndClean = () => {
    if (isCreating) return;
    void removeCachedFlyer(flyer);
    setFlyer(null);
    onClose();
  };

  const browseTemplates = () => {
    if (isCreating) return;
    void removeCachedFlyer(flyer);
    setFlyer(null);
    onBrowseTemplates();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Enter an event name.");
      return;
    }
    if (!eventType) {
      setError("Choose an event type.");
      return;
    }

    setError("");
    setIsCreating(true);
    try {
      await onCreate(title.trim(), eventType, flyer);
      await removeCachedFlyer(flyer);
      setFlyer(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create event.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeAndClean}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeAndClean} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            {
              opacity: entrance,
              transform: [
                {
                  scale: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.step}>STEP {step === "method" ? "1" : "2"} OF 2</Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {step === "method" ? "Create event" : "Event details"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              style={[styles.iconButton, { borderColor: colors.border }]}
              onPress={closeAndClean}
            >
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {step === "method" ? (
              <>
                <Text style={[styles.description, { color: colors.muted }]}>Choose how you want to begin your invitation.</Text>
                <Pressable
                  style={[styles.methodCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
                  onPress={() => void pickFlyer()}
                  disabled={isPicking}
                >
                  <View style={[styles.methodIcon, { backgroundColor: colors.icon }]}>
                    {isPicking ? <ActivityIndicator color="#4fd6be" size="small" /> : <Images color="#4fd6be" size={22} />}
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={[styles.methodTitle, { color: colors.text }]}>Upload your flyer</Text>
                    <Text style={[styles.methodDescription, { color: colors.muted }]}>Choose it now, then add event details</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.methodCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
                  onPress={browseTemplates}
                >
                  <View style={[styles.methodIcon, { backgroundColor: colors.icon }]}>
                    <LayoutTemplate color="#4fd6be" size={22} />
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={[styles.methodTitle, { color: colors.text }]}>Use a template</Text>
                    <Text style={[styles.methodDescription, { color: colors.muted }]}>Browse ready-made invitations</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.methodCard, { backgroundColor: colors.panel, borderColor: colors.border }]}
                  onPress={() => {
                    void removeCachedFlyer(flyer);
                    setFlyer(null);
                    setStep("details");
                  }}
                >
                  <View style={[styles.methodIcon, { backgroundColor: colors.icon }]}>
                    <PenLine color="#4fd6be" size={22} />
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={[styles.methodTitle, { color: colors.text }]}>Start from scratch</Text>
                    <Text style={[styles.methodDescription, { color: colors.muted }]}>Open a blank design canvas</Text>
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.description, { color: colors.muted }]}>Name your event and choose its type.</Text>
                {flyer ? (
                  <View style={[styles.flyerPreview, { backgroundColor: colors.panel, borderColor: colors.border }]}>
                    <Image source={{ uri: flyer.uri }} style={styles.flyerImage} resizeMode="cover" />
                    <View style={styles.flyerCopy}>
                      <Text style={[styles.flyerTitle, { color: colors.text }]}>Flyer ready</Text>
                      <Text style={[styles.flyerName, { color: colors.muted }]} numberOfLines={1}>{flyer.name}</Text>
                      <Pressable onPress={() => void pickFlyer()} disabled={isPicking || isCreating}>
                        <Text style={styles.changeFlyer}>{isPicking ? "Opening photos…" : "Change flyer"}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <Text style={[styles.label, { color: colors.text }]}>Event name</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Amara & Kofi Wedding"
                  placeholderTextColor={colors.muted}
                  selectionColor="#4fd6be"
                  style={[
                    styles.input,
                    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  ]}
                  maxLength={300}
                  autoFocus
                  returnKeyType="done"
                />
                <Text style={[styles.label, { color: colors.text }]}>Event type</Text>
                <View style={styles.typeGrid}>
                  {eventTypes.map((type) => {
                    const selected = eventType === type.value;
                    return (
                      <Pressable
                        key={type.label}
                        onPress={() => setEventType(type.value)}
                        style={[
                          styles.typeButton,
                          { backgroundColor: colors.panel, borderColor: colors.border },
                          selected && styles.typeButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            { color: colors.muted },
                            selected && styles.typeTextSelected,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {step === "details" ? (
              <>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={() => setStep("method")}
                >
                  <ArrowLeft color={colors.text} size={17} />
                  <Text style={[styles.secondaryText, { color: colors.text }]}>Back</Text>
                </Pressable>
                <Pressable
                  disabled={isCreating}
                  style={[styles.primaryButton, isCreating && styles.disabled]}
                  onPress={handleCreate}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#07110f" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>{flyer ? "Create & design stub" : "Create event"}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.cancelButton} onPress={closeAndClean}>
                <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(0, 0, 0, 0.66)",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "82%",
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#24483f",
    backgroundColor: "#0b1815",
  },
  header: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  step: { color: "#4fd6be", fontSize: 10, fontWeight: "800", letterSpacing: 0 },
  title: { marginTop: 4, color: "#f5f8f7", fontSize: 21, fontWeight: "800" },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#26483f",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  description: { marginBottom: 18, color: "#8ca09b", fontSize: 13, lineHeight: 19 },
  methodCard: {
    minHeight: 78,
    marginBottom: 10,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#204239",
    backgroundColor: "#10221e",
    flexDirection: "row",
    alignItems: "center",
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17352e",
  },
  methodCopy: { flex: 1, marginLeft: 13 },
  methodTitle: { color: "#f5f8f7", fontSize: 14, fontWeight: "700" },
  methodDescription: { marginTop: 4, color: "#78918b", fontSize: 11 },
  flyerPreview: {
    minHeight: 92,
    marginBottom: 18,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  flyerImage: { width: 62, height: 76, borderRadius: 6, backgroundColor: "#07110f" },
  flyerCopy: { flex: 1, marginLeft: 12 },
  flyerTitle: { fontSize: 13, fontWeight: "800" },
  flyerName: { marginTop: 3, marginBottom: 9, fontSize: 11 },
  changeFlyer: { color: "#4fd6be", fontSize: 12, fontWeight: "800" },
  label: { marginBottom: 7, color: "#dbe5e2", fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 48,
    marginBottom: 18,
    paddingHorizontal: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#285046",
    color: "#f5f8f7",
    backgroundColor: "#10221e",
    fontSize: 14,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeButton: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#285046",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10221e",
  },
  typeButtonSelected: { borderColor: "#4fd6be", backgroundColor: "#4fd6be" },
  typeText: { color: "#a7b5b1", fontSize: 11, fontWeight: "700" },
  typeTextSelected: { color: "#07110f" },
  error: { marginTop: 14, color: "#f47b7b", fontSize: 12 },
  footer: {
    minHeight: 70,
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#1b3932",
    flexDirection: "row",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2a5147",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryText: { color: "#dbe5e2", fontSize: 13, fontWeight: "700" },
  primaryButton: {
    flex: 1.35,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4fd6be",
  },
  primaryText: { color: "#07110f", fontSize: 13, fontWeight: "800" },
  cancelButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#8ca09b", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
