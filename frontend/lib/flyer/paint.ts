export function isCssGradient(value?: string | null): value is string {
  return Boolean(value && /^(linear|radial)-gradient\(/i.test(value.trim()));
}

interface PaintBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function splitGradientArguments(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseColorStops(values: string[]) {
  return values.map((value, index) => {
    const positionMatch = value.match(/\s+(-?\d+(?:\.\d+)?)%\s*$/);
    const fallback = values.length <= 1 ? 0 : index / (values.length - 1);
    return {
      color: positionMatch ? value.slice(0, positionMatch.index).trim() : value.trim(),
      position: positionMatch
        ? Math.min(1, Math.max(0, Number(positionMatch[1]) / 100))
        : fallback,
    };
  });
}

export function createCanvasPaint(
  ctx: CanvasRenderingContext2D,
  value: string | undefined | null,
  bounds: PaintBounds,
  fallback = "transparent",
): string | CanvasGradient {
  const paint = value?.trim() || fallback;
  const match = paint.match(/^(linear|radial)-gradient\(([\s\S]*)\)$/i);
  if (!match) return paint;

  const type = match[1].toLowerCase();
  const args = splitGradientArguments(match[2]);
  let gradient: CanvasGradient;

  if (type === "linear") {
    const angleMatch = args[0]?.match(/^(-?\d+(?:\.\d+)?)deg$/i);
    const angle = angleMatch ? Number(angleMatch[1]) : 180;
    if (angleMatch) args.shift();
    const radians = (angle * Math.PI) / 180;
    const directionX = Math.sin(radians);
    const directionY = -Math.cos(radians);
    const length = Math.abs(bounds.width * directionX) + Math.abs(bounds.height * directionY);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    gradient = ctx.createLinearGradient(
      centerX - (directionX * length) / 2,
      centerY - (directionY * length) / 2,
      centerX + (directionX * length) / 2,
      centerY + (directionY * length) / 2,
    );
  } else {
    if (/^(circle|ellipse)(\s|$)/i.test(args[0] ?? "")) args.shift();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(bounds.width, bounds.height) / 2,
    );
  }

  const stops = parseColorStops(args);
  if (stops.length === 0) return fallback;
  for (const stop of stops) {
    try {
      gradient.addColorStop(stop.position, stop.color);
    } catch {
      gradient.addColorStop(stop.position, fallback === "transparent" ? "#00000000" : fallback);
    }
  }
  return gradient;
}
