import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  FeBlend,
  FeColorMatrix,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeOffset,
  Filter,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

interface GatherViaLogoProps {
  size: number;
}

// This is the supplied gather-via-logo-small.svg artwork, rendered unchanged
// with the app's existing react-native-svg setup.
export function GatherViaLogo({ size }: GatherViaLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 254 254" fill="none">
      <Defs>
        <ClipPath id="clip0_2009_34"><Rect width="254" height="254" fill="white" /></ClipPath>
        <Filter id="filter0_d_2009_34" x="28" y="28" width="198.72" height="198.72" filterUnits="userSpaceOnUse">
          <FeFlood floodOpacity="0" result="BackgroundImageFix" />
          <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <FeOffset dy="4" /><FeGaussianBlur stdDeviation="2" /><FeComposite in2="hardAlpha" operator="out" />
          <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2009_34" />
          <FeBlend mode="normal" in="BackgroundImageFix" in2="effect1_dropShadow_2009_34" result="BackgroundImageFix" />
          <FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        </Filter>
        <LinearGradient id="paint0_linear_2009_34" x1="127" y1="0" x2="127" y2="254" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4FD6BE" /><Stop offset="1" stopColor="#06AB8E" />
        </LinearGradient>
        <LinearGradient id="paint1_linear_2009_34" x1="187" y1="14" x2="25" y2="201.5" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#1BB79B" /><Stop offset="1" stopColor="#06AB8E" />
        </LinearGradient>
        <LinearGradient id="paint2_linear_2009_34" x1="127.36" y1="28" x2="127.36" y2="218.72" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#08FBD0" /><Stop offset="1" stopColor="#78FA83" stopOpacity="0.23" />
        </LinearGradient>
        <LinearGradient id="paint3_linear_2009_34" x1="137" y1="41" x2="137.5" y2="226" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F3FFBA" /><Stop offset="1" stopColor="white" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <G clipPath="url(#clip0_2009_34)">
        <Circle cx="127" cy="127" r="127" fill="url(#paint0_linear_2009_34)" />
        <Circle cx="32.5" cy="102.5" r="12.5" fill="#12B396" />
        <Circle cx="109.5" cy="35.5" r="7.5" fill="#12B396" />
        <Circle cx="207.5" cy="161.5" r="12.5" fill="#06AB8E" />
        <Path d="M40.5 219C38.8081 221.477 12.75 188 8 169C34 100.5 118.594 89.8329 147.912 95.8164L177 10C177 10 194 18.5 204 26C215.5 34.625 225.5 47 225.5 47C221.053 60.2968 206.811 99.8055 189.418 149.668C105.22 117.756 54.5 198.5 40.5 219Z" fill="url(#paint1_linear_2009_34)" />
        <G filter="url(#filter0_d_2009_34)">
          <Path d="M127.971 28C122.373 28 116.944 79.4565 111.772 81.4946C111.772 81.4946 101.171 28 95.5733 28C60.4627 28 32 70.6941 32 123.36C32 176.026 60.4627 218.72 95.5733 218.72C101.171 218.72 106.601 125.398 111.772 123.36C116.944 125.398 122.373 218.72 127.971 218.72C133.349 218.72 138.571 125.246 143.559 123.36C148.547 125.246 153.769 218.72 159.147 218.72C194.257 218.72 222.72 176.026 222.72 123.36C222.72 70.6941 194.257 28 159.147 28C153.769 28 148.547 79.6088 143.559 81.4946C138.571 79.6088 133.349 28 127.971 28Z" fill="url(#paint2_linear_2009_34)" fillOpacity="0.2" />
        </G>
        <Path d="M159.133 190.867C147.844 202.156 134.422 207.8 118.867 207.8C107.844 207.8 98.2889 205.889 90.2 202.067C82.2 198.244 75.8444 192.733 71.1333 185.533C66.4222 178.333 62.9556 170.111 60.7333 160.867C58.6 151.622 57.5333 141.089 57.5333 129.267C57.5333 120.467 57.9778 112.556 58.8667 105.533C59.8444 98.5111 61.4 91.8 63.5333 85.4C65.6667 79 68.6 73.4889 72.3333 68.8667C76.0667 64.1556 80.6444 60.0667 86.0667 56.6C91.4889 53.1333 98.0667 50.5556 105.8 48.8667C113.533 47.0889 122.333 46.2 132.2 46.2C136.644 46.2 140.867 46.4667 144.867 47C148.956 47.5333 152.422 48.2 155.267 49C158.111 49.7111 160.778 50.6444 163.267 51.8C165.844 52.8667 167.844 53.8444 169.267 54.7333C170.778 55.5333 172.156 56.4222 173.4 57.4C174.644 58.3778 175.4 59.0444 175.667 59.4C176.022 59.7556 176.289 60.0222 176.467 60.2L174.467 90.8667H150.2L142.6 73.1333C140.644 72.0667 137.489 71.5333 133.133 71.5333C129.578 71.5333 126.644 71.8444 124.333 72.4667C122.022 73.0889 119.711 74.4222 117.4 76.4667C115.178 78.4222 113.4 81.3111 112.067 85.1333C110.822 88.8667 109.8 93.9778 109 100.467C108.2 106.867 107.8 114.689 107.8 123.933C107.8 143.222 108.822 157.533 110.867 166.867C113 176.2 117.222 180.867 123.533 180.867C126.644 180.867 129.267 180.6 131.4 180.067C133.533 179.444 135.533 178.378 137.4 176.867C139.267 175.267 140.644 172.956 141.533 169.933C142.422 166.822 142.867 162.867 142.867 158.067V144.467L125.267 140.467V113.267H184.6L184.467 205H160.733L159.133 190.867Z" fill="url(#paint3_linear_2009_34)" />
        <Ellipse cx="127" cy="229" rx="51" ry="3" fill="#121212" fillOpacity="0.13" />
      </G>
    </Svg>
  );
}
