import { PolygonLayer } from "@deck.gl/layers";
import type {
  TransformableObject,
  BorderData,
  ZoneData,
  HandleData,
} from "../types";

/**
 * Create DeckGL transformation layers from transformation data
 */
export function createTransformationLayers(
  transformationData: {
    borders: BorderData[];
    resizeZones: ZoneData[];
    rotateZones: ZoneData[];
    handles: HandleData[];
  },
  objects: TransformableObject[],
  config: {
    showDebugZones?: boolean;
    debugMode?: boolean;
  } = {}
): PolygonLayer[] {
  const layers: PolygonLayer[] = [];
  const showDebugZones = config.showDebugZones ?? config.debugMode ?? false;

  // Add border layer
  if (transformationData.borders.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "transformation-borders",
        data: transformationData.borders,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) =>
          [d.color[0], d.color[1], d.color[2], 255] as [
            number,
            number,
            number,
            number
          ],
        getLineColor: [0, 0, 0, 0],
        pickable: false,
      })
    );
  }

  // Add resize zones
  if (transformationData.resizeZones.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "transformation-resize-zones",
        data: transformationData.resizeZones,
        getPolygon: (d) => d.polygon,
        getFillColor: showDebugZones ? [0, 255, 0, 30] : [0, 0, 0, 0],
        getLineColor: showDebugZones ? [0, 255, 0, 80] : [0, 0, 0, 0],
        getLineWidth: showDebugZones ? 1 : 0,
        pickable: true,
      })
    );
  }

  // Add rotate zones
  if (transformationData.rotateZones.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "transformation-rotate-zones",
        data: transformationData.rotateZones,
        getPolygon: (d) => d.polygon,
        getFillColor: showDebugZones ? [0, 0, 255, 20] : [0, 0, 0, 0],
        getLineColor: showDebugZones ? [0, 0, 255, 60] : [0, 0, 0, 0],
        getLineWidth: showDebugZones ? 1 : 0,
        pickable: true,
      })
    );
  }

  // Add handles
  if (transformationData.handles.length > 0) {
    layers.push(
      new PolygonLayer({
        id: "transformation-handles",
        data: transformationData.handles,
        getPolygon: (d) => {
          const size = d.worldSize || 0.002; // Use zoom-independent world size
          const [x, y] = d.position;

          // Get the object this handle belongs to for rotation
          const obj = objects.find((o) => o.id === d.layerId);
          const rotation = obj?.rotation || 0;
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          // Create square corners relative to handle position
          const corners = [
            [-size, -size],
            [size, -size],
            [size, size],
            [-size, size],
          ];

          // Rotate each corner around the handle center
          return corners.map(([dx, dy]) => {
            const rotatedDx = dx * cos - dy * sin;
            const rotatedDy = dx * sin + dy * cos;
            return [x + rotatedDx, y + rotatedDy];
          });
        },
        getFillColor: [255, 255, 255, 255], // White fill
        getLineColor: [70, 130, 255, 255], // Blue border
        getLineWidth: 2,
        lineWidthMinPixels: 2,
        pickable: false,
      })
    );
  }

  return layers;
}
