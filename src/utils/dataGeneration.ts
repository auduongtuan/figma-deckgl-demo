import type { LayerObject, PolygonData, ZoneData, BorderData, HandleData } from "../types/layer";
import type { ViewState } from "./coordinates";
import { getRotatedPolygon } from "./coordinates";

/**
 * Generate polygon data for main layer rendering
 */
export function generatePolygonData(layers: LayerObject[]): PolygonData[] {
  return [...layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => ({
      polygon: getRotatedPolygon(layer),
      color: layer.color,
      layerId: layer.id,
    }));
}

/**
 * Generate resize zone data for selected layers
 */
export function generateResizeZoneData(
  layers: LayerObject[],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null
): ZoneData[] {
  if (!canvasElement) return [];

  const data: ZoneData[] = [];

  layers.forEach((layer) => {
    if (layer.selected) {
      // Calculate 12px buffer in world coordinates
      const scale = Math.pow(2, viewState.zoom - 8) * 400;
      const bufferWorld = 12 / scale;

      // Create extended layer dimensions for resize zone
      const extendedLayer = {
        x: layer.x - bufferWorld,
        y: layer.y - bufferWorld,
        width: layer.width + 2 * bufferWorld,
        height: layer.height + 2 * bufferWorld,
        rotation: layer.rotation,
      };

      // Calculate rotated polygon for extended layer
      const centerX = extendedLayer.x + extendedLayer.width / 2;
      const centerY = extendedLayer.y + extendedLayer.height / 2;
      const rad = (extendedLayer.rotation * Math.PI) / 180;

      const corners: Array<[number, number]> = [
        [extendedLayer.x, extendedLayer.y],
        [extendedLayer.x + extendedLayer.width, extendedLayer.y],
        [
          extendedLayer.x + extendedLayer.width,
          extendedLayer.y + extendedLayer.height,
        ],
        [extendedLayer.x, extendedLayer.y + extendedLayer.height],
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
        layerId: layer.id,
        zoneType: "resize",
      });
    }
  });

  return data;
}

/**
 * Generate rotate zone data for selected layers
 */
export function generateRotateZoneData(
  layers: LayerObject[],
  viewState: ViewState,
  canvasElement: HTMLDivElement | null
): ZoneData[] {
  if (!canvasElement) return [];

  const data: ZoneData[] = [];

  layers.forEach((layer) => {
    if (layer.selected) {
      // Calculate 24px buffer in world coordinates for rotate zone
      const scale = Math.pow(2, viewState.zoom - 8) * 400;
      const bufferWorld = 24 / scale;

      // Create extended layer dimensions for rotate zone
      const extendedLayer = {
        x: layer.x - bufferWorld,
        y: layer.y - bufferWorld,
        width: layer.width + 2 * bufferWorld,
        height: layer.height + 2 * bufferWorld,
        rotation: layer.rotation,
      };

      // Calculate rotated polygon for extended layer
      const centerX = extendedLayer.x + extendedLayer.width / 2;
      const centerY = extendedLayer.y + extendedLayer.height / 2;
      const rad = (extendedLayer.rotation * Math.PI) / 180;

      const corners: Array<[number, number]> = [
        [extendedLayer.x, extendedLayer.y],
        [extendedLayer.x + extendedLayer.width, extendedLayer.y],
        [
          extendedLayer.x + extendedLayer.width,
          extendedLayer.y + extendedLayer.height,
        ],
        [extendedLayer.x, extendedLayer.y + extendedLayer.height],
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
        layerId: layer.id,
        zoneType: "rotate",
      });
    }
  });

  return data;
}

/**
 * Generate border data for selected layers
 */
export function generateBorderData(layers: LayerObject[]): BorderData[] {
  const data: BorderData[] = [];

  layers.forEach((layer) => {
    if (layer.selected) {
      // Selection border outline with rotation support
      const borderWidth = 0.005;
      const centerX = layer.x + layer.width / 2;
      const centerY = layer.y + layer.height / 2;
      const rad = (layer.rotation * Math.PI) / 180;

      const rotatePoint = (x: number, y: number): [number, number] => {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX;
        const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY;
        return [rotatedX, rotatedY];
      };

      const outerBorder: Array<[number, number]> = [
        rotatePoint(layer.x - borderWidth, layer.y - borderWidth),
        rotatePoint(
          layer.x + layer.width + borderWidth,
          layer.y - borderWidth
        ),
        rotatePoint(
          layer.x + layer.width + borderWidth,
          layer.y + layer.height + borderWidth
        ),
        rotatePoint(
          layer.x - borderWidth,
          layer.y + layer.height + borderWidth
        ),
      ];
      const innerBorder = getRotatedPolygon(layer);

      data.push({
        polygon: [outerBorder, innerBorder],
        color: [24, 144, 255],
        layerId: layer.id,
        type: "border",
      });
    }
  });

  return data;
}

/**
 * Generate handle data for selected layers
 */
export function generateHandleData(layers: LayerObject[]): HandleData[] {
  const handles: HandleData[] = [];

  layers.forEach((layer) => {
    if (layer.selected) {
      const corners = getRotatedPolygon(layer);
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
          layerId: layer.id,
          size: 8,
          color: [70, 130, 255], // Blue handles
        });
      });
    }
  });

  return handles;
}