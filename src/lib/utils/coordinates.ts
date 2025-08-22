import type { TransformableObject } from "../types";

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(
  worldPos: [number, number],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null
): ScreenPosition | null {
  if (!canvasElement) return null;

  const rect = canvasElement.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // Simple linear projection that matches DeckGL at zoom level 8
  const scale = Math.pow(2, viewState.zoom - 8) * 400;
  const x = centerX + (worldPos[0] - viewState.longitude) * scale;
  const y = centerY - (worldPos[1] - viewState.latitude) * scale;

  return { x, y };
}

/**
 * Check if a point is inside a rotated rectangle
 */
export function isPointInsideLayer(
  layer: TransformableObject,
  worldX: number,
  worldY: number
): boolean {
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  const rad = -((layer.rotation || 0) * Math.PI) / 180; // Negative for inverse rotation

  // Rotate the point back to local coordinates
  const dx = worldX - centerX;
  const dy = worldY - centerY;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;

  // Check if point is inside the unrotated rectangle
  return (
    localX >= layer.x &&
    localX <= layer.x + layer.width &&
    localY >= layer.y &&
    localY <= layer.y + layer.height
  );
}

/**
 * Get the rotated polygon coordinates for a layer
 */
export function getRotatedPolygon(layer: TransformableObject): Array<[number, number]> {
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  const rad = ((layer.rotation || 0) * Math.PI) / 180;

  const corners: Array<[number, number]> = [
    [layer.x, layer.y],
    [layer.x + layer.width, layer.y],
    [layer.x + layer.width, layer.y + layer.height],
    [layer.x, layer.y + layer.height],
  ];

  return corners.map(([x, y]) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
    const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;
    return [rotatedX, rotatedY];
  });
}

/**
 * Calculate distance from point to line segment
 */
export function distanceToLineSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}