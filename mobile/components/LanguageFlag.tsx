import { Circle, ClipPath, Defs, G, Path, Rect, Svg } from "react-native-svg";
import type { SupportedLanguage } from "@/lib/types/auth";

export function LanguageFlag({ code, size = 30 }: { code: SupportedLanguage; size?: number }) {
  if (code === "en") {
    return (
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="40" fill="#0052B5" />
        <Path d="M30 22V1.26a40 40 0 0 1 20 0V27.5L67 10.49a40 40 0 0 1 6 7L60 30h18.74a40 40 0 0 1 0 20H57l15 14a40 40 0 0 1-7.5 7.62L50 57v21.74a40 40 0 0 1-20 0V53L13.5 69.96A40 40 0 0 1 7.5 63.32L22 50H1.26a40 40 0 0 1 0-20h21.24L8 16a40 40 0 0 1 7.78-7.83L30 22Z" fill="#fff" />
        <Path d="M30 30 11.74 11.69A40 40 0 0 0 9 14.72L25 30h5Zm20 0 18.26-18.31A40 40 0 0 1 71 14.72L55 30h-5Zm0 20.34 18.26 18.32A40 40 0 0 0 71 65.62L55 50.34h-5Zm-20 0L11.74 68.66A40 40 0 0 1 9 65.62l16-15.28h5Z" fill="#D90026" />
        <Path d="M.31 35a40 40 0 0 0 0 10H35v34.69a40 40 0 0 0 10 0V45h34.69a40 40 0 0 0 0-10H45V.31A34 34 0 0 0 35 .31V35H.31Z" fill="#D90026" />
      </Svg>
    );
  }

  const bands =
    code === "fr"
      ? ["#0F0B7F", "#F2F0F2", "#D90026"]
      : code === "es"
        ? ["#D90026", "#FFDB44", "#D90026"]
        : ["#000000", "#D90026", "#FFDB44"];

  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <ClipPath id={`flag-${code}`}><Circle cx="40" cy="40" r="40" /></ClipPath>
      </Defs>
      <G clipPath={`url(#flag-${code})`}>
        {code === "fr" ? (
          <>
            <Rect x="0" y="0" width="27" height="80" fill={bands[0]} />
            <Rect x="27" y="0" width="27" height="80" fill={bands[1]} />
            <Rect x="54" y="0" width="26" height="80" fill={bands[2]} />
          </>
        ) : (
          <>
            <Rect x="0" y="0" width="80" height="27" fill={bands[0]} />
            <Rect x="0" y="27" width="80" height="27" fill={bands[1]} />
            <Rect x="0" y="54" width="80" height="26" fill={bands[2]} />
          </>
        )}
      </G>
    </Svg>
  );
}
