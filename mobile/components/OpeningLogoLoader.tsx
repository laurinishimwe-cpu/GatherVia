import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Circle, Svg } from "react-native-svg";
import { useThemeMode } from "@/context/ThemeContext";
import { GatherViaLogo } from "@/components/GatherViaLogo";

const LOGO_SIZE = 148;
const RING_SIZE = 184;

export function OpeningLogoLoader({ onComplete }: { onComplete: () => void }) {
  const { resolvedMode } = useThemeMode();
  const translateX = useSharedValue(0);
  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(1);

  useEffect(() => {
    translateX.value = withSequence(
      withTiming(-5, { duration: 60, easing: Easing.out(Easing.quad) }),
      withTiming(5, { duration: 70, easing: Easing.inOut(Easing.quad) }),
      withTiming(-4, { duration: 65, easing: Easing.inOut(Easing.quad) }),
      withTiming(4, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(-2, { duration: 55, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 60, easing: Easing.out(Easing.quad) }),
    );
    ringRotation.value = withDelay(330, withTiming(360, { duration: 700, easing: Easing.inOut(Easing.cubic) }));
    ringOpacity.value = withDelay(1030, withTiming(0, { duration: 120 }, (finished) => {
      if (finished) runOnJS(onComplete)();
    }));

    return () => {
      cancelAnimation(translateX);
      cancelAnimation(ringRotation);
      cancelAnimation(ringOpacity);
    };
  }, [onComplete, ringOpacity, ringRotation, translateX]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));
  const ringColor = resolvedMode === "light" ? "#176f61" : "#4fd6be";

  return (
    <View style={[styles.screen, { backgroundColor: resolvedMode === "light" ? "#f4f7f6" : "#081512" }]}>
      <View style={styles.logoArea}>
        <Animated.View style={[styles.ring, ringStyle]}>
          <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_SIZE / 2 - 4} fill="none" stroke={ringColor} strokeWidth={2} strokeLinecap="round" strokeDasharray="88 18" />
          </Svg>
        </Animated.View>
        <Animated.View style={logoStyle}><GatherViaLogo size={LOGO_SIZE} /></Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoArea: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
});
