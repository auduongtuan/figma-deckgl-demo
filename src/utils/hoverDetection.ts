import type { LayerObject, HoverZone } from "../types/layer";
import { worldToScreen, getRotatedPolygon, distanceToLineSegment } from "./coordinates";
import type { ViewState, ScreenPosition } from "./coordinates";

interface Edge {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Corner {
  name: string;
  x: number;
  y: number;
}

/**
 * Detect hover zone based on pixel distance from layer edges
 */
export function getHoverZone(
  layer: LayerObject,
  worldX: number,
  worldY: number,
  viewState: ViewState,
  canvasElement: HTMLDivElement | null
): HoverZone | null {
  if (!layer.selected) return null;

  // Get layer corners in world coordinates
  const corners = getRotatedPolygon(layer);
  const screenCorners = corners
    .map(([x, y]) => worldToScreen([x, y], viewState, canvasElement))
    .filter(Boolean) as ScreenPosition[];

  if (screenCorners.length !== 4) return null;

  // Get mouse position in screen coordinates
  const mouseScreen = worldToScreen([worldX, worldY], viewState, canvasElement);
  if (!mouseScreen) return null;

  // Check distance to each edge and corner
  const [topLeft, topRight, bottomRight, bottomLeft] = screenCorners;

  // Check corners first for corner resize zones (±12px from corners)
  // Correct mapping: topLeft=nw, topRight=ne, bottomRight=se, bottomLeft=sw
  const corners_screen: Corner[] = [
    { name: "nw", x: topLeft.x, y: topLeft.y },     // Top-left = northwest
    { name: "ne", x: topRight.x, y: topRight.y },   // Top-right = northeast  
    { name: "se", x: bottomRight.x, y: bottomRight.y }, // Bottom-right = southeast
    { name: "sw", x: bottomLeft.x, y: bottomLeft.y },   // Bottom-left = southwest
  ];

  for (const corner of corners_screen) {
    const dx = mouseScreen.x - corner.x;
    const dy = mouseScreen.y - corner.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= 12) {
      return { type: "resize", handle: corner.name, zoneType: "resize" };
    }
  }

  // Check edges for resize zones (±12px)
  const edges: Edge[] = [
    {
      name: "n",
      x1: topLeft.x,
      y1: topLeft.y,
      x2: topRight.x,
      y2: topRight.y,
    }, // Visual top edge (topLeft to topRight)
    {
      name: "e",
      x1: topRight.x,
      y1: topRight.y,
      x2: bottomRight.x,
      y2: bottomRight.y,
    }, // Visual right edge
    {
      name: "s",
      x1: bottomRight.x,
      y1: bottomRight.y,
      x2: bottomLeft.x,
      y2: bottomLeft.y,
    }, // Visual bottom edge (bottomRight to bottomLeft)
    {
      name: "w",
      x1: bottomLeft.x,
      y1: bottomLeft.y,
      x2: topLeft.x,
      y2: topLeft.y,
    }, // Visual left edge
  ];

  for (const edge of edges) {
    const distance = distanceToLineSegment(
      mouseScreen.x,
      mouseScreen.y,
      edge.x1,
      edge.y1,
      edge.x2,
      edge.y2
    );
    if (distance <= 12) {
      return { type: "resize", handle: edge.name, zoneType: "resize" };
    }
  }

  // Check corners for rotate zones (12-24px from corners, outside resize zone)
  for (const corner of corners_screen) {
    const dx = mouseScreen.x - corner.x;
    const dy = mouseScreen.y - corner.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 12 && distance <= 24) {
      return { type: "rotate", handle: corner.name, zoneType: "rotate" }; // Return specific corner name for directional cursors
    }
  }

  return null;
}