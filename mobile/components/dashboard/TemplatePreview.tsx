import { StyleSheet, View } from "react-native";
import { MobileFlyerRenderer } from "@/components/editor/MobileFlyerRenderer";
import { buildFlyerTemplateDraft } from "@/lib/flyer/templateDraft";
import type { FlyerTemplate } from "@/lib/types/flyer";

interface TemplatePreviewProps {
  template: FlyerTemplate;
  compact?: boolean;
  aspectRatio?: number;
  fill?: boolean;
}

export function TemplatePreview({ template, aspectRatio = 27 / 32, fill = false }: TemplatePreviewProps) {
  const draft = buildFlyerTemplateDraft(template);
  return (
    <View style={[styles.canvas, fill ? styles.fillCanvas : { aspectRatio }]}>
      <MobileFlyerRenderer
        layers={draft.layers}
        configuration={draft.configuration}
        mode="thumbnail"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: "100%", overflow: "hidden" },
  fillCanvas: { height: "100%" },
});
