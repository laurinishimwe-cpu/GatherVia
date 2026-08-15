import { useEffect, useState } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MobileTicketStubRenderer } from "@/components/editor/MobileTicketStubRenderer";
import { useEditorOrientation } from "@/hooks/useEditorOrientation";
import type { CanvasLayer } from "@/lib/types/canvas";
import type { EventRecord } from "@/lib/types/event";
import type { FlyerConfiguration } from "@/lib/types/flyer";

interface MobileInvitationPreviewProps {
  visible: boolean;
  onClose: () => void;
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  event: EventRecord | null;
}

export function MobileInvitationPreview({
  visible,
  onClose,
  layers,
  configuration,
  event,
}: MobileInvitationPreviewProps) {
  const window = useEditorOrientation();
  const availableHeight = Math.max(window.height - (window.isLandscape ? 72 : 120), 120);
  const previewWidth = Math.min(window.width * 0.9, availableHeight * 9 / 16, 430);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, visible]);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={[styles.header, window.isLandscape && styles.landscapeHeader]}>
          <Pressable accessibilityLabel="Close preview" onPress={onClose} style={styles.backButton}>
            <ArrowLeft color="#f5f8f7" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Invitation Preview</Text>
            <Text style={styles.subtitle}>Unsaved changes are included</Text>
          </View>
        </View>
        <View style={[styles.previewArea, window.isLandscape && styles.landscapePreviewArea]}>
          <View style={[styles.invitation, { width: previewWidth }]}>
            <InvitationBody layers={layers} configuration={configuration} event={event} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function InvitationBody({
  layers,
  configuration,
  event,
}: {
  layers: CanvasLayer[];
  configuration: FlyerConfiguration;
  event: EventRecord | null;
}) {
  return <MobileTicketStubRenderer layers={layers} configuration={configuration} event={event} mode="preview" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050b09" },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1e4037" },
  landscapeHeader: { height: 52 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCopy: { marginLeft: 4 },
  title: { color: "#f5f8f7", fontSize: 16, fontWeight: "800" },
  subtitle: { marginTop: 2, color: "#78918b", fontSize: 10 },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  landscapePreviewArea: { paddingVertical: 6 },
  invitation: { aspectRatio: 9 / 16, overflow: "hidden", backgroundColor: "#ffffff", elevation: 10, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
});
