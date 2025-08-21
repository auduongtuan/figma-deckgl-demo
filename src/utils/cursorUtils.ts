import type { DraggingState, HoveredHandle, LayerObject } from "../types/layer";
import { getDirectionalRotateCursor } from "./cursor";

/**
 * Get the appropriate cursor based on current state
 */
export function getCursor(
  dragging: DraggingState | null,
  hoveredHandle: HoveredHandle | null,
  layers: LayerObject[],
  isHoveringInsideLayer: boolean
): string {
  if (dragging) {
    if (dragging.type === "resize" && dragging.handle) {
      const handle = dragging.handle;
      if (handle === "nw") return "nesw-resize"; // Top-left
      if (handle === "ne") return "nwse-resize"; // Top-right
      if (handle === "sw") return "nwse-resize"; // Bottom-left
      if (handle === "se") return "nesw-resize"; // Bottom-right
      if (handle === "n" || handle === "s") return "ns-resize";
      if (handle === "e" || handle === "w") return "ew-resize";
    }
    if (dragging.type === "rotate" && dragging.handle) {
      // Use directional rotate cursor during drag
      const handle = dragging.handle;
      if (
        handle === "nw" ||
        handle === "ne" ||
        handle === "se" ||
        handle === "sw"
      ) {
        return getDirectionalRotateCursor(handle);
      }
      return "grabbing";
    }
    if (dragging.type === "move") return "move";
    return "grab";
  }

  // Only show cursor hints when hovering over a selected layer
  if (hoveredHandle && layers.some((layer) => layer.selected)) {
    const handle = hoveredHandle.handleType;

    // Check if we have zoneType information to determine cursor type
    if (hoveredHandle.zoneType) {
      const zoneType = hoveredHandle.zoneType;

      if (
        zoneType === "rotate" &&
        (handle === "nw" ||
          handle === "ne" ||
          handle === "se" ||
          handle === "sw")
      ) {
        // Use directional rotate cursor for corner rotate zones
        return getDirectionalRotateCursor(handle);
      } else if (zoneType === "resize") {
        // Use standard resize cursors for resize zones
        if (handle === "nw") return "nesw-resize"; // Top-left
        if (handle === "ne") return "nwse-resize"; // Top-right
        if (handle === "sw") return "nwse-resize"; // Bottom-left
        if (handle === "se") return "nesw-resize"; // Bottom-right
        if (handle === "n" || handle === "s") return "ns-resize";
        if (handle === "e" || handle === "w") return "ew-resize";
      }
    }

    // Fallback for any other cases
    if (handle === "rotate") return "crosshair";
  }

  // Check if hovering inside a selected layer (not in resize/rotate zones)
  // If so, show move cursor
  if (isHoveringInsideLayer) {
    return "move";
  }

  return "grab";
}