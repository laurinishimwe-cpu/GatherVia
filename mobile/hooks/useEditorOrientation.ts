import { useWindowDimensions } from "react-native";

export function useEditorOrientation() {
  const window = useWindowDimensions();
  return {
    ...window,
    isLandscape: window.width > window.height,
  };
}
