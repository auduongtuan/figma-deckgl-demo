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
// Dual-path approach: black fill first, then white outline for contrast
const ROTATE_CORNER_SVG = `<path d="M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223Z" fill="none" stroke="white" stroke-width="1.2"/>`;

function getCursorCss(
  svgContent: string,
  rotation: number = 0,
  flipX: boolean = false,
  color: string = "#000"
): string {
  const r = rotation;
  const tr = 0; // Additional transform rotation
  const dx = 1; // Shadow offset x
  const dy = 1; // Shadow offset y
  const hotspotX = 16;
  const hotspotY = 16;

  // Build the complete SVG following tldraw's exact structure
  const completeSvg = `<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: ${color};'>
    <defs>
      <filter id='shadow' x='-50%' y='-50%' width='200%' height='200%' color-interpolation-filters='sRGB'>
        <feDropShadow dx='${dx}' dy='${dy}' stdDeviation='1' flood-color='black' flood-opacity='0.3'/>
      </filter>
    </defs>
    <g transform='rotate(${r + tr} 16 16)${
    flipX ? " scale(-1,-1) translate(0, -32)" : ""
  }'>
      <g filter='url(#shadow)'>
        ${svgContent.replaceAll('"', "'")}
      </g>
    </g>
  </svg>`;

  // Debug: Log the SVG to console
  console.log("Generated SVG for cursor:", completeSvg);

  // Use encodeURIComponent for proper encoding
  const encodedSvg = encodeURIComponent(completeSvg);

  // Debug: Log the final cursor CSS
  const finalCursor = `url("data:image/svg+xml,${encodedSvg}") ${hotspotX} ${hotspotY}, pointer`;
  console.log("Final cursor CSS:", finalCursor);

  // Return cursor with proper hotspot
  return finalCursor;
}

// Cursor mapping for different rotation handles
const ROTATION_CURSORS: Record<RotateCursorType, (color?: string) => string> = {
  "nwse-rotate": (color = "#000") =>
    getCursorCss(ROTATE_CORNER_SVG, 0, false, color),
  "nesw-rotate": (color = "#000") =>
    getCursorCss(ROTATE_CORNER_SVG, 90, false, color),
  "senw-rotate": (color = "#000") =>
    getCursorCss(ROTATE_CORNER_SVG, 180, false, color),
  "swne-rotate": (color = "#000") =>
    getCursorCss(ROTATE_CORNER_SVG, 270, false, color),
};

// Corner handle to cursor type mapping (only reversed nw and ne)
export const CORNER_TO_ROTATE_CURSOR: Record<string, RotateCursorType> = {
  nw: "swne-rotate", // Reversed from nwse-rotate
  ne: "senw-rotate", // Reversed from nesw-rotate
  sw: "nwse-rotate", // Kept as it was (working)
  se: "nesw-rotate", // Kept as it was (working)
};

export function getRotateCursor(
  corner: string,
  options: CursorOptions = {}
): string {
  const { color = "#000" } = options;
  const cursorType = CORNER_TO_ROTATE_CURSOR[corner];

  if (!cursorType) {
    return "crosshair"; // fallback
  }

  return ROTATION_CURSORS[cursorType](color);
}

// Detect if user prefers dark mode for cursor color
export function getThemeAwareCursorColor(): string {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "#fff"
      : "#000";
  }
  return "#000";
}

export function getDirectionalRotateCursor(corner: string): string {
  const color = getThemeAwareCursorColor();
  return getRotateCursor(corner, { color });
}
