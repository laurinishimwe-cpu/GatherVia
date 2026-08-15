import type { MirrorMode, VectorNode } from "@/lib/types/canvas";

export type VectorHandleType = "handleIn" | "handleOut";
export interface VectorPoint { x: number; y: number }

export const VECTOR_COORDINATE_MIN = -100;
export const VECTOR_COORDINATE_MAX = 200;
export const MIN_VECTOR_LAYER_SIZE = 0.1;

export function roundVectorValue(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clampVectorCoordinate(value: number): number {
  return Math.min(Math.max(value, VECTOR_COORDINATE_MIN), VECTOR_COORDINATE_MAX);
}

export function isValidVectorPoint(point: VectorPoint | undefined): point is VectorPoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function cloneVectorNode(node: VectorNode): VectorNode {
  return {
    ...node,
    handleIn: node.handleIn ? { ...node.handleIn } : undefined,
    handleOut: node.handleOut ? { ...node.handleOut } : undefined,
  };
}

export function cloneVectorNodes(nodes: VectorNode[]): VectorNode[] {
  return nodes.map(cloneVectorNode);
}

export function compileVectorPath(nodes: VectorNode[], closed = false): string {
  if (nodes.length === 0) return "";
  let path = `M ${roundVectorValue(nodes[0].x)} ${roundVectorValue(nodes[0].y)}`;
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1];
    const current = nodes[index];
    if (previous.handleOut || current.handleIn) {
      const first = previous.handleOut ?? previous;
      const second = current.handleIn ?? current;
      path += ` C ${roundVectorValue(first.x)} ${roundVectorValue(first.y)}, ${roundVectorValue(second.x)} ${roundVectorValue(second.y)}, ${roundVectorValue(current.x)} ${roundVectorValue(current.y)}`;
    } else {
      path += ` L ${roundVectorValue(current.x)} ${roundVectorValue(current.y)}`;
    }
  }
  return closed ? `${path} Z` : path;
}

export function localVectorNodesToGlobal(
  nodes: VectorNode[],
  bounds: VectorPoint & { width: number; height: number },
): VectorNode[] {
  return nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y)).map((node) => ({
    ...cloneVectorNode(node),
    x: bounds.x + (node.x / 100) * bounds.width,
    y: bounds.y + (node.y / 100) * bounds.height,
    handleIn: isValidVectorPoint(node.handleIn) ? {
      x: bounds.x + (node.handleIn.x / 100) * bounds.width,
      y: bounds.y + (node.handleIn.y / 100) * bounds.height,
    } : undefined,
    handleOut: isValidVectorPoint(node.handleOut) ? {
      x: bounds.x + (node.handleOut.x / 100) * bounds.width,
      y: bounds.y + (node.handleOut.y / 100) * bounds.height,
    } : undefined,
  }));
}

export function constrainVectorHandle(anchor: VectorPoint, point: VectorPoint): VectorPoint {
  const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
  const angle = Math.atan2(point.y - anchor.y, point.x - anchor.x);
  const constrained = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: anchor.x + Math.cos(constrained) * distance, y: anchor.y + Math.sin(constrained) * distance };
}

function oppositeHandle(type: VectorHandleType): VectorHandleType {
  return type === "handleIn" ? "handleOut" : "handleIn";
}

export function moveVectorNode(node: VectorNode, x: number, y: number): VectorNode {
  const nextX = clampVectorCoordinate(x);
  const nextY = clampVectorCoordinate(y);
  const dx = nextX - node.x;
  const dy = nextY - node.y;
  return {
    ...cloneVectorNode(node),
    x: nextX,
    y: nextY,
    handleIn: node.handleIn ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy } : undefined,
    handleOut: node.handleOut ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy } : undefined,
  };
}

export function moveVectorHandle(
  node: VectorNode,
  type: VectorHandleType,
  point: VectorPoint,
  temporarilyDisconnected = false,
): VectorNode {
  const next = cloneVectorNode(node);
  const moved = { x: clampVectorCoordinate(point.x), y: clampVectorCoordinate(point.y) };
  next[type] = moved;
  if (temporarilyDisconnected || node.mirror === "disconnected" || node.mirror === "straight") return next;
  const opposite = oppositeHandle(type);
  if (node.mirror === "mirrored") {
    next[opposite] = { x: node.x - (moved.x - node.x), y: node.y - (moved.y - node.y) };
  } else if (node.mirror === "asymmetric" && node[opposite]) {
    const oldOpposite = node[opposite];
    const distance = Math.hypot(oldOpposite.x - node.x, oldOpposite.y - node.y);
    const angle = Math.atan2(node.y - moved.y, node.x - moved.x);
    next[opposite] = { x: node.x + Math.cos(angle) * distance, y: node.y + Math.sin(angle) * distance };
  }
  return next;
}

export function applyVectorMirrorMode(
  node: VectorNode,
  mirror: MirrorMode,
  referenceType?: VectorHandleType,
): VectorNode {
  const next = cloneVectorNode(node);
  next.mirror = mirror;
  if (mirror === "disconnected" || mirror === "straight") return next;
  const reference = referenceType && next[referenceType]
    ? referenceType
    : next.handleOut ? "handleOut" : next.handleIn ? "handleIn" : null;
  if (!reference || !next[reference]) return next;
  const point = next[reference];
  const opposite = oppositeHandle(reference);
  const oldOpposite = next[opposite];
  const angle = Math.atan2(point.y - next.y, point.x - next.x);
  const referenceDistance = Math.hypot(point.x - next.x, point.y - next.y);
  const oppositeDistance = mirror === "asymmetric" && oldOpposite
    ? Math.hypot(oldOpposite.x - next.x, oldOpposite.y - next.y)
    : referenceDistance;
  next[opposite] = { x: next.x - Math.cos(angle) * oppositeDistance, y: next.y - Math.sin(angle) * oppositeDistance };
  return next;
}

export function vectorNodeToCorner(node: VectorNode): VectorNode {
  return { ...cloneVectorNode(node), handleIn: undefined, handleOut: undefined };
}

export function vectorNodeToSmooth(node: VectorNode): VectorNode {
  if (node.handleIn || node.handleOut) {
    const next = applyVectorMirrorMode(node, node.mirror === "straight" ? "mirrored" : node.mirror);
    if (next.handleIn && !next.handleOut) {
      next.handleOut = {
        x: clampVectorCoordinate(next.x * 2 - next.handleIn.x),
        y: clampVectorCoordinate(next.y * 2 - next.handleIn.y),
      };
    } else if (next.handleOut && !next.handleIn) {
      next.handleIn = {
        x: clampVectorCoordinate(next.x * 2 - next.handleOut.x),
        y: clampVectorCoordinate(next.y * 2 - next.handleOut.y),
      };
    }
    return next;
  }
  const next = cloneVectorNode(node);
  next.mirror = "mirrored";
  next.handleIn = { x: clampVectorCoordinate(next.x - 4), y: next.y };
  next.handleOut = { x: clampVectorCoordinate(next.x + 4), y: next.y };
  return next;
}

export function toggleVectorNodeKind(node: VectorNode): VectorNode {
  return node.handleIn || node.handleOut ? vectorNodeToCorner(node) : vectorNodeToSmooth(node);
}
