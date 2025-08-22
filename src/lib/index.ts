// Main library exports - Hook-based integration only
export { useTransformationFrames } from "./hooks/useTransformationFrames";

// Export types
export type {
  TransformableObject,
  TransformationConfig,
  TransformationState,
  HoverZone,
  HoveredHandle,
  ViewState,
  DeckGLPickingInfo,
  ZoneData,
  BorderData,
  HandleData,
  HandleType,
  ZoneType,
  DragType,
} from "./types";

// Export utility functions that might be useful for custom implementations
export { getRotatedPolygon } from "./utils/coordinates";
export { createBitmapRotationMatrix } from "./utils/matrix";
export { createTransformationLayers as createTransformationPolygonLayers } from "./utils/layerFactories";

// Re-export for convenience
export type {
  UseTransformationFramesProps,
  UseTransformationFramesReturn,
} from "./hooks/useTransformationFrames";
