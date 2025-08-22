import type { TransformationState, HoveredHandle, TransformableObject, TransformationConfig } from "../types";

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

const CORNER_TO_ROTATE_CURSOR: Record<string, RotateCursorType> = {
  nw: "swne-rotate",
  ne: "senw-rotate",
  sw: "nwse-rotate",
  se: "nesw-rotate",
};

function getRotateCursor(corner: string, options: CursorOptions = {}): string {
  const { color = "#000" } = options;
  const cursorType = CORNER_TO_ROTATE_CURSOR[corner];

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

function getDirectionalRotateCursor(corner: string): string {
  const color = getThemeAwareCursorColor();
  return getRotateCursor(corner, { color });
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
  if (hoveredHandle && objects.some((obj) => obj.selected)) {
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
  if (isHoveringInsideLayer && config.enableMove !== false) {
    return "move";
  }

  return "grab";
}