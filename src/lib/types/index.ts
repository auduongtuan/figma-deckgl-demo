// Core transformation library types
export interface TransformableObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  selected?: boolean;
  zIndex?: number;
}

export type HandleType = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
export type ZoneType = "resize" | "rotate";
export type DragType = "move" | "resize" | "rotate";

export interface TransformationConfig {
  // Zone settings
  resizeZoneDistance?: number;    // Default: 12px
  rotateZoneDistance?: number;    // Default: 24px
  handleSize?: number;            // Default: 8px
  borderWidth?: number;           // Default: 2px
  
  // Behavior settings  
  enableResize?: boolean;         // Default: true
  enableRotate?: boolean;         // Default: true
  enableMove?: boolean;           // Default: true
  maintainAspectRatio?: boolean;  // Default: false
  snapRotation?: number;          // Default: 15 degrees
  minWidth?: number;              // Default: 0.01
  minHeight?: number;             // Default: 0.01
  
  // Visual settings
  debugMode?: boolean;            // Default: false
  theme?: 'light' | 'dark';       // Default: 'light'
  borderColor?: [number, number, number];      // Default: [24, 144, 255]
  handleColor?: [number, number, number];      // Default: [70, 130, 255]
  resizeZoneColor?: [number, number, number];  // Default: [0, 255, 0]
  rotateZoneColor?: [number, number, number];  // Default: [0, 0, 255]
  
  // Callbacks
  onTransformStart?: (object: TransformableObject, type: DragType) => void;
  onTransformUpdate?: (object: TransformableObject, changes: Partial<TransformableObject>) => void;
  onTransformEnd?: (object: TransformableObject) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface TransformationState {
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

export interface HoverZone {
  type: DragType;
  handle: string;
  zoneType: ZoneType;
}

export interface HoveredHandle {
  layerId: string;
  handleType: string;
  zoneType?: ZoneType;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface DeckGLPickingInfo {
  object?: {
    layerId: string;
    [key: string]: unknown;
  };
  coordinate?: number[];
  layer?: unknown;
  [key: string]: unknown;
}

// Layer data interfaces for DeckGL
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
  worldSize?: number;
  color: [number, number, number];
}