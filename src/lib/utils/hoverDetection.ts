import type { TransformableObject, HoverZone, TransformationConfig } from "../types";
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
  object: TransformableObject,
  worldX: number,
  worldY: number,
  viewState: ViewState,
  canvasElement: HTMLDivElement | null,
  config: Partial<TransformationConfig> = {}
): HoverZone | null {
  if (!object.selected) return null;

  const resizeDistance = config.resizeZoneDistance || 12;
  const rotateDistance = config.rotateZoneDistance || 24;

  // Get layer corners in world coordinates
  const corners = getRotatedPolygon(object);
  const screenCorners = corners
    .map(([x, y]) => worldToScreen([x, y], viewState, canvasElement))
    .filter(Boolean) as ScreenPosition[];

  if (screenCorners.length !== 4) return null;

  // Get mouse position in screen coordinates
  const mouseScreen = worldToScreen([worldX, worldY], viewState, canvasElement);
  if (!mouseScreen) return null;

  // Check distance to each edge and corner
  const [topLeft, topRight, bottomRight, bottomLeft] = screenCorners;

  // Check corners first for corner resize zones
  const corners_screen: Corner[] = [
    { name: "nw", x: topLeft.x, y: topLeft.y },     // Top-left = northwest
    { name: "ne", x: topRight.x, y: topRight.y },   // Top-right = northeast  
    { name: "se", x: bottomRight.x, y: bottomRight.y }, // Bottom-right = southeast
    { name: "sw", x: bottomLeft.x, y: bottomLeft.y },   // Bottom-left = southwest
  ];

  if (config.enableResize !== false) {
    for (const corner of corners_screen) {
      const dx = mouseScreen.x - corner.x;
      const dy = mouseScreen.y - corner.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= resizeDistance) {
        return { type: "resize", handle: corner.name, zoneType: "resize" };
      }
    }

    // Check edges for resize zones
    const edges: Edge[] = [
      {
        name: "n",
        x1: topLeft.x,
        y1: topLeft.y,
        x2: topRight.x,
        y2: topRight.y,
      }, // Visual top edge
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
      }, // Visual bottom edge
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
      if (distance <= resizeDistance) {
        return { type: "resize", handle: edge.name, zoneType: "resize" };
      }
    }
  }

  // Check corners for rotate zones (outside resize zone)
  if (config.enableRotate !== false) {
    for (const corner of corners_screen) {
      const dx = mouseScreen.x - corner.x;
      const dy = mouseScreen.y - corner.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > resizeDistance && distance <= rotateDistance) {
        return { type: "rotate", handle: corner.name, zoneType: "rotate" };
      }
    }
  }

  return null;
}