import type { TransformableObject, TransformationConfig, ZoneData, BorderData, HandleData } from "../types";
import type { ViewState } from "./coordinates";
import { getRotatedPolygon } from "./coordinates";

/**
 * Generate resize zone data for selected objects
 */
export function generateResizeZoneData(
  objects: TransformableObject[],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null,
  config: Partial<TransformationConfig> = {}
): ZoneData[] {
  if (!canvasElement || config.enableResize === false) return [];

  const resizeDistance = config.resizeZoneDistance || 12;
  const data: ZoneData[] = [];

  objects.forEach((obj) => {
    if (obj.selected) {
      // Calculate buffer in world coordinates
      const scale = Math.pow(2, viewState.zoom - 8) * 400;
      const bufferWorld = resizeDistance / scale;

      // Create extended object dimensions for resize zone
      const extendedObj = {
        x: obj.x - bufferWorld,
        y: obj.y - bufferWorld,
        width: obj.width + 2 * bufferWorld,
        height: obj.height + 2 * bufferWorld,
        rotation: obj.rotation || 0,
      };

      // Calculate rotated polygon for extended object
      const centerX = extendedObj.x + extendedObj.width / 2;
      const centerY = extendedObj.y + extendedObj.height / 2;
      const rad = (extendedObj.rotation * Math.PI) / 180;

      const corners: Array<[number, number]> = [
        [extendedObj.x, extendedObj.y],
        [extendedObj.x + extendedObj.width, extendedObj.y],
        [extendedObj.x + extendedObj.width, extendedObj.y + extendedObj.height],
        [extendedObj.x, extendedObj.y + extendedObj.height],
      ];

      const rotatedCorners = corners.map(([x, y]) => {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;
        return [rotatedX, rotatedY] as [number, number];
      });

      data.push({
        polygon: rotatedCorners,
        layerId: obj.id,
        zoneType: "resize",
      });
    }
  });

  return data;
}

/**
 * Generate rotate zone data for selected objects
 */
export function generateRotateZoneData(
  objects: TransformableObject[],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null,
  config: Partial<TransformationConfig> = {}
): ZoneData[] {
  if (!canvasElement || config.enableRotate === false) return [];

  const rotateDistance = config.rotateZoneDistance || 24;
  const data: ZoneData[] = [];

  objects.forEach((obj) => {
    if (obj.selected) {
      // Calculate buffer in world coordinates for rotate zone
      const scale = Math.pow(2, viewState.zoom - 8) * 400;
      const bufferWorld = rotateDistance / scale;

      // Create extended object dimensions for rotate zone
      const extendedObj = {
        x: obj.x - bufferWorld,
        y: obj.y - bufferWorld,
        width: obj.width + 2 * bufferWorld,
        height: obj.height + 2 * bufferWorld,
        rotation: obj.rotation || 0,
      };

      // Calculate rotated polygon for extended object
      const centerX = extendedObj.x + extendedObj.width / 2;
      const centerY = extendedObj.y + extendedObj.height / 2;
      const rad = (extendedObj.rotation * Math.PI) / 180;

      const corners: Array<[number, number]> = [
        [extendedObj.x, extendedObj.y],
        [extendedObj.x + extendedObj.width, extendedObj.y],
        [extendedObj.x + extendedObj.width, extendedObj.y + extendedObj.height],
        [extendedObj.x, extendedObj.y + extendedObj.height],
      ];

      const rotatedCorners = corners.map(([x, y]) => {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;
        return [rotatedX, rotatedY] as [number, number];
      });

      data.push({
        polygon: rotatedCorners,
        layerId: obj.id,
        zoneType: "rotate",
      });
    }
  });

  return data;
}

/**
 * Generate border data for selected objects
 */
export function generateBorderData(
  objects: TransformableObject[],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null,
  config: Partial<TransformationConfig> = {}
): BorderData[] {
  if (!canvasElement) return [];
  
  const borderWidthPx = config.borderWidth || 2; // Now in pixels, not world units
  // Calculate border width in world coordinates based on zoom
  const scale = Math.pow(2, viewState.zoom - 8) * 400;
  const borderWidth = borderWidthPx / scale;
  const data: BorderData[] = [];

  objects.forEach((obj) => {
    if (obj.selected) {
      // Selection border outline with rotation support
      const centerX = obj.x + obj.width / 2;
      const centerY = obj.y + obj.height / 2;
      const rad = ((obj.rotation || 0) * Math.PI) / 180;

      const rotatePoint = (x: number, y: number): [number, number] => {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;
        return [rotatedX, rotatedY];
      };

      const outerBorder: Array<[number, number]> = [
        rotatePoint(obj.x - borderWidth, obj.y - borderWidth),
        rotatePoint(obj.x + obj.width + borderWidth, obj.y - borderWidth),
        rotatePoint(obj.x + obj.width + borderWidth, obj.y + obj.height + borderWidth),
        rotatePoint(obj.x - borderWidth, obj.y + obj.height + borderWidth),
      ];
      const innerBorder = getRotatedPolygon(obj);

      data.push({
        polygon: [outerBorder, innerBorder],
        color: config.borderColor || [24, 144, 255],
        layerId: obj.id,
        type: "border" as const,
      });
    }
  });

  return data;
}

/**
 * Generate handle data for selected objects
 */
export function generateHandleData(
  objects: TransformableObject[],
  viewState?: ViewState,
  canvasElement?: HTMLDivElement | null,
  config: Partial<TransformationConfig> = {}
): HandleData[] {
  const handleSizePx = config.handleSize || 4; // 4px for the 4x4 square
  const handleColor = config.handleColor || [70, 130, 255];
  
  // Calculate zoom-independent size in world coordinates
  let worldSize = 0.002; // Default fallback
  if (viewState && canvasElement) {
    const scale = Math.pow(2, viewState.zoom - 8) * 400;
    worldSize = (handleSizePx / 2) / scale; // Half size since we use ±size for squares
  }
  
  const handles: HandleData[] = [];

  objects.forEach((obj) => {
    if (obj.selected) {
      const corners = getRotatedPolygon(obj);
      const [nw, ne, se, sw] = corners;

      // Calculate midpoints of edges
      const n: [number, number] = [(nw[0] + ne[0]) / 2, (nw[1] + ne[1]) / 2];
      const e: [number, number] = [(ne[0] + se[0]) / 2, (ne[1] + se[1]) / 2];
      const s: [number, number] = [(sw[0] + se[0]) / 2, (sw[1] + se[1]) / 2];
      const w: [number, number] = [(sw[0] + nw[0]) / 2, (sw[1] + nw[1]) / 2];

      const handlePositions = [
        { position: nw, type: "nw" },
        { position: n, type: "n" },
        { position: ne, type: "ne" },
        { position: e, type: "e" },
        { position: se, type: "se" },
        { position: s, type: "s" },
        { position: sw, type: "sw" },
        { position: w, type: "w" },
      ];

      handlePositions.forEach(({ position, type }) => {
        handles.push({
          position,
          handleType: type,
          layerId: obj.id,
          size: handleSizePx,
          worldSize: worldSize,
          color: handleColor,
        });
      });
    }
  });

  return handles;
}