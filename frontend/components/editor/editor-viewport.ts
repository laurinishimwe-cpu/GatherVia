export const MIN_VIEWPORT_SCALE = 0.1;
export const MAX_VIEWPORT_SCALE = 4;
export const TRACKPAD_ZOOM_SENSITIVITY = 0.002;

export function clampViewportScale(scale: number): number {
  return Math.min(
    Math.max(scale, MIN_VIEWPORT_SCALE),
    MAX_VIEWPORT_SCALE,
  );
}

export function getWheelDeltaInPixels(
  event: WheelEvent,
  pageSize: number,
) {
  const multiplier =
    event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? pageSize
        : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

export function getEditorViewportBackgroundStyle(viewport: {
  x: number;
  y: number;
  scale: number;
}) {
  return {
    backgroundImage:
      "radial-gradient(circle, rgba(58,126,148,0.18) 1px, transparent 1px)",
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
    backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
  };
}
