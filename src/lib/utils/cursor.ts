import type { TransformationState, HoveredHandle, TransformableObject, TransformationConfig } from "../types";

// Note: Coordinate system configuration is now passed via TransformationConfig.invertedYCoordinates

// ===== CURSOR UTILITIES (merged from cursor.ts) =====

// Cursor utility for generating SVG-based directional rotate cursors
// Based on tldraw's approach: https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCursor.ts

export type RotateCursorType =
  | "nwse-rotate"
  | "nesw-rotate"
  | "senw-rotate"
  | "swne-rotate";

interface CursorOptions {
  color?: string;
  rotation?: number;
}

// SVG path for rotate cursor based on tldraw's implementation
const ROTATE_CORNER_SVG = `<path d="M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223Z" fill="none" stroke="white" stroke-width="1.2"/>`;

function getCursorCss(
  svgContent: string,
  rotation: number = 0,
  flipX: boolean = false,
  color: string = "#000"
): string {
  const r = rotation;
  const tr = 0;
  const dx = 1;
  const dy = 1;
  const hotspotX = 16;
  const hotspotY = 16;

  const completeSvg = `<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: ${color};'>
    <defs>
      <filter id='shadow' x='-50%' y='-50%' width='200%' height='200%' color-interpolation-filters='sRGB'>
        <feDropShadow dx='${dx}' dy='${dy}' stdDeviation='1' flood-color='black' flood-opacity='0.3'/>
      </filter>
    </defs>
    <g transform='rotate(${r + tr} 16 16)${flipX ? " scale(-1,-1) translate(0, -32)" : ""}'>
      <g filter='url(#shadow)'>
        ${svgContent.replaceAll('"', "'")}
      </g>
    </g>
  </svg>`;

  const encodedSvg = encodeURIComponent(completeSvg);
  return `url("data:image/svg+xml,${encodedSvg}") ${hotspotX} ${hotspotY}, pointer`;
}

const ROTATION_CURSORS: Record<RotateCursorType, (color?: string) => string> = {
  "nwse-rotate": (color = "#000") => getCursorCss(ROTATE_CORNER_SVG, 0, false, color),
  "nesw-rotate": (color = "#000") => getCursorCss(ROTATE_CORNER_SVG, 90, false, color),
  "senw-rotate": (color = "#000") => getCursorCss(ROTATE_CORNER_SVG, 180, false, color),
  "swne-rotate": (color = "#000") => getCursorCss(ROTATE_CORNER_SVG, 270, false, color),
};

function getCornerToRotateCursor(invertedY: boolean): Record<string, RotateCursorType> {
  return invertedY ? {
    // Inverted Y coordinate system (like DeckGL with certain projections)
    nw: "swne-rotate",
    ne: "senw-rotate", 
    sw: "nwse-rotate",
    se: "nesw-rotate",
  } : {
    // Standard coordinate system
    nw: "nwse-rotate",
    ne: "nesw-rotate",
    sw: "nesw-rotate", 
    se: "nwse-rotate",
  };
}


function getRotateCursor(corner: string, invertedY: boolean, options: CursorOptions = {}): string {
  const { color = "#000" } = options;
  const cornerToCursor = getCornerToRotateCursor(invertedY);
  const cursorType = cornerToCursor[corner];

  if (!cursorType) {
    return "crosshair";
  }

  return ROTATION_CURSORS[cursorType](color);
}

function getThemeAwareCursorColor(): string {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#fff" : "#000";
  }
  return "#000";
}

function getDirectionalRotateCursor(corner: string, invertedY: boolean): string {
  const color = getThemeAwareCursorColor();
  return getRotateCursor(corner, invertedY, { color });
}

// ===== ROTATION-AWARE CURSOR HELPERS =====

/**
 * Adjust handle direction based on object rotation
 * For a 90° rotation: n->e, e->s, s->w, w->n
 */
function getRotatedHandle(handle: string, rotation: number): string {
  // Normalize rotation to 0-360
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  
  // Calculate 90-degree steps
  const steps = Math.round(normalizedRotation / 90) % 4;
  
  if (steps === 0) return handle; // No rotation
  
  // Handle mapping for 90-degree rotations
  const handleMap: Record<string, string[]> = {
    'n': ['n', 'e', 's', 'w'],    // north rotates to east, south, west
    'e': ['e', 's', 'w', 'n'],    // east rotates to south, west, north
    's': ['s', 'w', 'n', 'e'],    // south rotates to west, north, east  
    'w': ['w', 'n', 'e', 's'],    // west rotates to north, east, south
    'nw': ['nw', 'ne', 'se', 'sw'], // northwest rotates clockwise
    'ne': ['ne', 'se', 'sw', 'nw'], // northeast rotates clockwise
    'se': ['se', 'sw', 'nw', 'ne'], // southeast rotates clockwise
    'sw': ['sw', 'nw', 'ne', 'se'], // southwest rotates clockwise
  };
  
  return handleMap[handle]?.[steps] || handle;
}

/**
 * Get rotation-aware resize cursor
 */
function getRotationAwareResizeCursor(handle: string, rotation: number, invertedY: boolean): string {
  const rotatedHandle = getRotatedHandle(handle, rotation);
  
  // Apply cursor mappings based on coordinate system configuration
  if (invertedY) {
    // Inverted Y coordinate system (like DeckGL with certain projections)
    if (rotatedHandle === "nw") return "nesw-resize";
    if (rotatedHandle === "ne") return "nwse-resize";
    if (rotatedHandle === "sw") return "nwse-resize";
    if (rotatedHandle === "se") return "nesw-resize";
  } else {
    // Standard coordinate system
    if (rotatedHandle === "nw") return "nwse-resize";
    if (rotatedHandle === "ne") return "nesw-resize";
    if (rotatedHandle === "sw") return "nesw-resize";
    if (rotatedHandle === "se") return "nwse-resize";
  }
  
  if (rotatedHandle === "n" || rotatedHandle === "s") return "ns-resize";
  if (rotatedHandle === "e" || rotatedHandle === "w") return "ew-resize";
  
  return "default";
}

/**
 * Get rotation-aware rotate cursor
 */
function getRotationAwareRotateCursor(handle: string, rotation: number, invertedY: boolean): string {
  const rotatedHandle = getRotatedHandle(handle, rotation);
  return getDirectionalRotateCursor(rotatedHandle, invertedY);
}

// ===== MAIN CURSOR LOGIC =====


/**
 * Get the appropriate cursor based on current state
 */
export function getCursor(
  dragging: TransformationState | null,
  hoveredHandle: HoveredHandle | null,
  objects: TransformableObject[],
  isHoveringInsideLayer: boolean,
  config: Partial<TransformationConfig> = {}
): string {
  // Helper to find object rotation
  const getObjectRotation = (layerId: string): number => {
    const obj = objects.find(o => o.id === layerId);
    return obj?.rotation || 0;
  };

  const invertedY = config.invertedYCoordinates ?? false;

  if (dragging) {
    const rotation = getObjectRotation(dragging.layerId);
    
    if (dragging.type === "resize" && dragging.handle) {
      return getRotationAwareResizeCursor(dragging.handle, rotation, invertedY);
    }
    if (dragging.type === "rotate" && dragging.handle) {
      // Use rotation-aware directional rotate cursor during drag
      const handle = dragging.handle;
      if (
        handle === "nw" ||
        handle === "ne" ||
        handle === "se" ||
        handle === "sw"
      ) {
        return getRotationAwareRotateCursor(handle, rotation, invertedY);
      }
      return "grabbing";
    }
    if (dragging.type === "move") return "move";
    return "grab";
  }

  // Only show cursor hints when hovering over a selected layer
  if (hoveredHandle && objects.some((obj) => obj.selected)) {
    const handle = hoveredHandle.handleType;
    const rotation = getObjectRotation(hoveredHandle.layerId);

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
        // Use rotation-aware directional rotate cursor for corner rotate zones
        return getRotationAwareRotateCursor(handle, rotation, invertedY);
      } else if (zoneType === "resize") {
        // Use rotation-aware resize cursors for hover
        return getRotationAwareResizeCursor(handle, rotation, invertedY);
      }
    }

    // Fallback for any other cases
    if (handle === "rotate") return "crosshair";
  }

  // Check if hovering inside a selected layer (not in resize/rotate zones)
  // If so, show move cursor
  if (isHoveringInsideLayer && config.enableMove !== false) {
    return "move";
  }

  return "grab";
}