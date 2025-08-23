import type { TransformableObject } from "../types";

export class Vec {
  public x: number;
  public y: number;
  
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static fromArray(arr: [number, number]): Vec {
    return new Vec(arr[0], arr[1]);
  }

  static add(a: Vec, b: Vec): Vec {
    return new Vec(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vec, b: Vec): Vec {
    return new Vec(a.x - b.x, a.y - b.y);
  }

  static rot(vec: Vec, angle: number): Vec {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec(
      vec.x * cos - vec.y * sin,
      vec.x * sin + vec.y * cos
    );
  }

  static rotWith(point: Vec, origin: Vec, angle: number): Vec {
    const translated = Vec.sub(point, origin);
    const rotated = Vec.rot(translated, angle);
    return Vec.add(rotated, origin);
  }

  add(other: Vec): Vec {
    return Vec.add(this, other);
  }

  sub(other: Vec): Vec {
    return Vec.sub(this, other);
  }

  rot(angle: number): Vec {
    return Vec.rot(this, angle);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }
}

export interface ResizeInfo {
  newPoint: Vec;
  handle: string;
  initialBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function getScaleOrigin(handle: string, bounds: { x: number; y: number; width: number; height: number }): Vec {
  const { x, y, width, height } = bounds;
  
  switch (handle) {
    case 'nw': return new Vec(x + width, y + height);  // opposite corner
    case 'ne': return new Vec(x, y + height);
    case 'sw': return new Vec(x + width, y);
    case 'se': return new Vec(x, y);
    case 'n': return new Vec(x + width / 2, y + height);  // opposite edge
    case 's': return new Vec(x + width / 2, y);
    case 'w': return new Vec(x + width, y + height / 2);
    case 'e': return new Vec(x, y + height / 2);
    default: return new Vec(x + width / 2, y + height / 2);  // center
  }
}

export function resizeRotatedObject(
  _object: TransformableObject,
  info: ResizeInfo
): Partial<TransformableObject> {
  const { handle, initialBounds, rotation, scaleX, scaleY } = info;
  const rotationRad = (rotation || 0) * (Math.PI / 180);

  // Calculate new dimensions - ensure they're positive
  const newWidth = Math.max(0.01, Math.abs(initialBounds.width * scaleX));
  const newHeight = Math.max(0.01, Math.abs(initialBounds.height * scaleY));

  // Simple approach: calculate offset based on handle and rotation
  const offset = new Vec(0, 0);

  // Handle the offset calculations similar to tldraw's resizeBox
  if (scaleX < 0) {
    switch (handle) {
      case 'nw': case 'w': case 'sw':
        offset.x = newWidth - initialBounds.width;
        break;
      case 'n': case 's':
        offset.x = (newWidth - initialBounds.width) / 2;
        break;
    }
  }

  if (scaleY < 0) {
    switch (handle) {
      case 'nw': case 'n': case 'ne':
        offset.y = newHeight - initialBounds.height;
        break;
      case 'w': case 'e':
        offset.y = (newHeight - initialBounds.height) / 2;
        break;
    }
  }

  // Apply rotation to offset like tldraw does: offset.rot(rotation).add(newPoint)
  const rotatedOffset = Vec.rot(offset, rotationRad);
  
  // Calculate new position
  const newX = initialBounds.x + rotatedOffset.x;
  const newY = initialBounds.y + rotatedOffset.y;

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

// Map handle names to tldraw-style names
export function mapHandleToTldrawStyle(handle: string): string {
  switch (handle) {
    case 'nw': return 'top_left';
    case 'ne': return 'top_right';  
    case 'sw': return 'bottom_left';
    case 'se': return 'bottom_right';
    case 'n': return 'top';
    case 's': return 'bottom';
    case 'w': return 'left';
    case 'e': return 'right';
    default: return handle;
  }
}

// Get rotation-aware cursor for resize handles
export function getRotationAwareCursor(handle: string, rotation: number = 0): string {
  // For now, let's use a simpler approach that actually works
  // We'll rotate the cursor based on the object's rotation
  
  const baseCursors: Record<string, string> = {
    'n': 'ns-resize',
    's': 'ns-resize', 
    'e': 'ew-resize',
    'w': 'ew-resize',
    'nw': 'nw-resize',
    'ne': 'ne-resize', 
    'sw': 'sw-resize',
    'se': 'se-resize',
  };

  // If no rotation or very small rotation, use base cursors
  if (Math.abs(rotation) < 10) {
    return baseCursors[handle] || 'default';
  }

  // For 90 degree rotations, swap the cursors
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  
  if (normalizedRotation >= 80 && normalizedRotation <= 100) {
    // 90 degrees - swap horizontal/vertical
    const rotated90: Record<string, string> = {
      'n': 'ew-resize',
      's': 'ew-resize',
      'e': 'ns-resize', 
      'w': 'ns-resize',
      'nw': 'ne-resize',
      'ne': 'se-resize',
      'sw': 'nw-resize',
      'se': 'sw-resize',
    };
    return rotated90[handle] || 'default';
  }
  
  if (normalizedRotation >= 170 && normalizedRotation <= 190) {
    // 180 degrees - reverse directions
    const rotated180: Record<string, string> = {
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize', 
      'nw': 'se-resize',
      'ne': 'sw-resize',
      'sw': 'ne-resize',
      'se': 'nw-resize',
    };
    return rotated180[handle] || 'default';
  }
  
  if (normalizedRotation >= 260 && normalizedRotation <= 280) {
    // 270 degrees  
    const rotated270: Record<string, string> = {
      'n': 'ew-resize',
      's': 'ew-resize',
      'e': 'ns-resize',
      'w': 'ns-resize',
      'nw': 'sw-resize', 
      'ne': 'nw-resize',
      'sw': 'se-resize',
      'se': 'ne-resize',
    };
    return rotated270[handle] || 'default';
  }

  // For other angles, use base cursors as fallback
  return baseCursors[handle] || 'default';
}