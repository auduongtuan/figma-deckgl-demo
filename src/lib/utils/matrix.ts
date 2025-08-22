/**
 * Matrix transformation utilities for rotating BitmapLayers
 */

/**
 * Create a rotation matrix for rotating around the Z-axis (2D rotation)
 * @param angleInDegrees - Rotation angle in degrees
 * @param centerX - Center X coordinate for rotation
 * @param centerY - Center Y coordinate for rotation
 * @returns 4x4 transformation matrix
 */
export function createRotationMatrix(
  angleInDegrees: number,
  centerX: number = 0,
  centerY: number = 0
): [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  const cos = Math.cos(angleInRadians);
  const sin = Math.sin(angleInRadians);

  // DeckGL expects column-major order matrix
  // Column 1: [cos, sin, 0, 0]
  // Column 2: [-sin, cos, 0, 0] 
  // Column 3: [0, 0, 1, 0]
  // Column 4: [tx, ty, 0, 1] where tx, ty are translation components
  
  const tx = centerX - centerX * cos + centerY * sin;
  const ty = centerY - centerX * sin - centerY * cos;
  
  return [
    cos, sin, 0, 0,
    -sin, cos, 0, 0,
    0, 0, 1, 0,
    tx, ty, 0, 1
  ] as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
}

/**
 * Create a rotation matrix for a BitmapLayer using the same center calculation as transformation system
 * @param obj - TransformableObject to match transformation system center
 * @param rotation - Rotation angle in degrees (optional, uses obj.rotation if not provided)
 * @returns 4x4 transformation matrix compatible with DeckGL
 */
export function createBitmapRotationMatrix(
  obj: { x: number; y: number; width: number; height: number; rotation?: number },
  rotation?: number
): [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] {
  const actualRotation = rotation ?? obj.rotation ?? 0;
  
  if (!actualRotation || actualRotation === 0) {
    // Identity matrix for no rotation
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ] as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  }

  // Use the EXACT same center calculation as the transformation system
  const centerX = obj.x + obj.width / 2;
  const centerY = obj.y + obj.height / 2;

  const matrix = createRotationMatrix(actualRotation, centerX, centerY);
  return matrix as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
}

/**
 * Multiply two 4x4 matrices
 * @param a - First matrix
 * @param b - Second matrix
 * @returns Resulting matrix
 */
export function multiplyMatrix4(a: number[], b: number[]): number[] {
  const result = new Array(16);
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] = 
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  
  return result;
}

/**
 * Create a translation matrix
 * @param x - X translation
 * @param y - Y translation
 * @param z - Z translation
 * @returns 4x4 translation matrix
 */
export function createTranslationMatrix(x: number, y: number, z: number = 0): number[] {
  return [
    1, 0, 0, x,
    0, 1, 0, y,
    0, 0, 1, z,
    0, 0, 0, 1
  ];
}