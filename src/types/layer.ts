// Layer and interaction types
export interface LayerObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  selected: boolean;
  zIndex: number;
  rotation: number;
}

export interface ResizeHandle {
  type: "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
  x: number;
  y: number;
}

export type HandleType = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
export type ZoneType = "resize" | "rotate";
export type DragType = "move" | "resize" | "rotate";

export interface HoverZone {
  type: DragType;
  handle: string;
  zoneType: ZoneType;
}

export interface DraggingState {
  layerId: string;
  startX: number;
  startY: number;
  type: DragType;
  handle?: string;
  startRotation?: number;
  originalAspectRatio?: number;
  originalBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HoveredHandle {
  layerId: string;
  handleType: string;
  zoneType?: ZoneType;
}

// DeckGL data types
export interface PolygonData {
  polygon: Array<[number, number]>;
  color: [number, number, number];
  layerId: string;
}

export interface ZoneData {
  polygon: Array<[number, number]>;
  layerId: string;
  zoneType: ZoneType;
}

export interface BorderData {
  polygon: Array<Array<[number, number]>>;
  color: [number, number, number];
  layerId: string;
  type: "border";
}

export interface HandleData {
  position: [number, number];
  handleType: string;
  layerId: string;
  size: number;
  color: [number, number, number];
}

// DeckGL info parameter types
export interface DeckGLPickingInfo {
  object?: {
    layerId: string;
  };
  coordinate?: number[];
}