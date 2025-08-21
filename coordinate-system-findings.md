# Coordinate System Findings and Behaviors

## Overview
This document captures critical findings about the coordinate system used in the Figma DeckGL demo, specifically related to resize and interaction behaviors.

## Coordinate System Characteristics

### World Coordinates
- **X-axis**: Standard left-to-right, positive values move right
- **Y-axis**: **INVERTED** compared to typical screen coordinates
  - Positive Y values move **UP** (north)
  - Negative Y values move **DOWN** (south)
  - This is opposite to typical screen/DOM coordinates where Y increases downward

### Screen Coordinates
- **X-axis**: Standard left-to-right
- **Y-axis**: Standard top-to-bottom (positive Y moves down)
- Used for pixel-based calculations (hover zones, cursor positioning)

## Critical Edge Mapping Discovery

### Problem Identified
The initial edge mapping was **inverted**, causing confusing resize behavior:
- Dragging the visual top edge triggered "south" (s) resize logic
- Dragging the visual bottom edge triggered "north" (n) resize logic

### Solution Applied
Corrected the edge-to-coordinate mapping in `getHoverZone()`:

```typescript
const edges = [
  {
    name: "n",           // North (top)
    x1: topLeft.x,       // Uses topLeft to topRight
    y1: topLeft.y,
    x2: topRight.x,
    y2: topRight.y,
  }, // Visual top edge
  {
    name: "s",           // South (bottom)  
    x1: bottomRight.x,   // Uses bottomRight to bottomLeft
    y1: bottomRight.y,
    x2: bottomLeft.x,
    y2: bottomLeft.y,
  }, // Visual bottom edge
];
```

## Resize Logic Implementation

### Edge Resize Behavior
- **South (bottom) resize**: Top edge stays fixed, bottom edge follows cursor
- **North (top) resize**: Bottom edge stays fixed, top edge follows cursor
- **East (right) resize**: Left edge stays fixed, right edge follows cursor
- **West (left) resize**: Right edge stays fixed, left edge follows cursor

### Key Implementation Details

#### Bottom Edge Resize (South)
```typescript
if (handle.includes("s") && !handle.includes("n")) {
  newLayer.y = orig.y; // Top edge stays at original position
  newLayer.height = Math.abs(currentY - orig.y); // Height from top to cursor
}
```

#### Top Edge Resize (North)
```typescript
if (handle.includes("n") && !handle.includes("s")) {
  const originalBottom = orig.y + orig.height;
  newLayer.y = currentY; // Top edge follows cursor
  newLayer.height = Math.abs(originalBottom - currentY); // Distance from cursor to fixed bottom
}
```

### Corner Resize Behavior
- Corner handles allow diagonal resizing
- Both width and height change simultaneously
- Coordinate flipping logic applies only to corners to handle negative dimensions

## Screen-to-World Coordinate Conversion

### Critical Transform Function
```typescript
const worldToScreen = (worldPos: [number, number]) => {
  const scale = Math.pow(2, viewState.zoom - 8) * 400;
  const x = centerX + (worldPos[0] - viewState.longitude) * scale;
  const y = centerY - (worldPos[1] - viewState.latitude) * scale; // Note the minus sign!
  return { x, y };
};
```

**Key Point**: The minus sign in the Y calculation is what creates the inverted Y-axis behavior.

## Hover Zone Detection

### Pixel-Based Zones
- **Resize zones**: 0-12 pixels from edges/corners
- **Rotate zones**: 12-24 pixels from corners only
- Uses screen coordinates for pixel-perfect detection
- Converts world coordinates to screen for distance calculations

### Zone Priority
1. Corner resize zones (12px radius around corners)
2. Edge resize zones (12px from edge lines)  
3. Corner rotate zones (12-24px radius around corners)

## Debug Mode Behavior

### Zone Visibility
- **Debug ON**: Zones visible with colored fills and borders
  - Green zones = resize areas (0-12px)
  - Blue zones = rotate areas (12-24px)
- **Debug OFF**: Zones transparent but still functional for interaction

### Implementation
```typescript
getFillColor: showDebugZones ? [0, 255, 0, 30] : [0, 0, 0, 0], // Green when debug, transparent when not
```

## Directional Rotate Cursors

### Corner-to-Cursor Mapping
- **NW corner**: `nwse-rotate` cursor
- **NE corner**: `nesw-rotate` cursor  
- **SE corner**: `senw-rotate` cursor
- **SW corner**: `swne-rotate` cursor

### SVG Cursor Implementation
- Custom SVG cursors generated with black fill and white stroke outline
- Proper encoding with `encodeURIComponent()` for data URLs
- Drop shadow effects using SVG filters

## Common Pitfalls and Solutions

### 1. Edge Mapping Confusion
**Problem**: Visual edges not matching logical directions
**Solution**: Always verify edge mapping by testing actual drag behavior

### 2. Coordinate System Assumptions  
**Problem**: Assuming Y increases downward (screen coordinates)
**Solution**: Remember Y increases upward in world coordinates

### 3. Delta vs Absolute Positioning
**Problem**: Using delta calculations causes drift during resize
**Solution**: Use absolute positioning based on stored original bounds

### 4. Corner vs Edge Logic Interference
**Problem**: Corner coordinate flipping affecting edge resizes
**Solution**: Apply coordinate flipping only to corner handles

### 5. Debug Zone Functionality
**Problem**: Zones disappearing when debug mode off
**Solution**: Make zones transparent, not non-existent

## Best Practices

1. **Always store original bounds** when starting resize operations
2. **Use absolute positioning** rather than delta calculations for resize
3. **Test edge mapping** by dragging each visual edge and verifying behavior
4. **Separate corner and edge logic** to avoid interference
5. **Maintain zone functionality** regardless of debug visibility
6. **Consider coordinate system** when implementing any position-based features

## Testing Scenarios

### Resize Testing
1. Drag each visual edge and verify opposite edge stays fixed
2. Drag corners and verify diagonal resize behavior
3. Test with different zoom levels to ensure scale-independent behavior
4. Verify minimum size constraints don't interfere with small resizes

### Coordinate System Testing
1. Log world coordinates during drag operations
2. Verify screen-to-world coordinate conversion accuracy
3. Test hover zone detection at different zoom levels
4. Validate edge detection around rotated objects

This documentation should be referenced whenever making changes to coordinate-dependent functionality in the demo.