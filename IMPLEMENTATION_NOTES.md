# Figma-like DeckGL Layer Interaction System

## Overview
This project implements a Figma-like interaction system for DeckGL layers, providing precise hover detection, visual resize handles, and intuitive resize/rotate functionality with pixel-perfect accuracy.

## Key Architecture Decisions

### 1. Dual Layer System for Interaction Zones
**Problem**: DeckGL drag events only trigger when clicking directly on pickable polygon geometry. Hover detection can work in buffer zones (±6px around edges), but drag events don't.

**Solution**: Implemented a dual-layer system:
- **Main Polygon Layer**: Visible layers with actual content
- **Invisible Interaction Layer**: Transparent layers with 6px buffer zones around selected layers

```typescript
const polygonLayer = new PolygonLayer({
  id: 'layer-polygons',
  pickable: true,
  onDragStart: handleDragStart,
  onDrag: handleDrag,
  onDragEnd: handleDragEnd
})

const interactionLayer = new PolygonLayer({
  id: 'interaction-zones',
  getFillColor: [0, 0, 0, 0], // Completely transparent
  pickable: true,
  onDragStart: handleDragStart, // Same handlers
  onDrag: handleDrag,
  onDragEnd: handleDragEnd
})
```

### 2. Coordinate System Mapping
**Challenge**: DeckGL world coordinates vs screen coordinates vs visual orientation.

**Key Findings**:
- DeckGL uses mathematical coordinate system (Y increases upward)
- Screen coordinates have Y increasing downward
- Corner/edge mapping must account for this difference:

```typescript
// Visual to logical mapping (flipped for coordinate system)
const corners_screen = [
  { name: 'sw', x: topLeft.x, y: topLeft.y },     // Visual bottom-left
  { name: 'se', x: topRight.x, y: topRight.y },   // Visual bottom-right  
  { name: 'ne', x: bottomRight.x, y: bottomRight.y }, // Visual top-right
  { name: 'nw', x: bottomLeft.x, y: bottomLeft.y }    // Visual top-left
]

const edges = [
  { name: 's', x1: topLeft.x, y1: topLeft.y, x2: topRight.x, y2: topRight.y },      // Visual bottom
  { name: 'e', x1: topRight.x, y1: topRight.y, x2: bottomRight.x, y2: bottomRight.y }, // Visual right  
  { name: 'n', x1: bottomRight.x, y1: bottomRight.y, x2: bottomLeft.x, y2: bottomLeft.y }, // Visual top
  { name: 'w', x1: bottomLeft.x, y1: bottomLeft.y, x2: topLeft.x, y2: topLeft.y }     // Visual left
]
```

### 3. Precise Pixel-Based Hover Detection
**Implementation**: Uses world-to-screen coordinate conversion for exact 6px measurements:

```typescript
const worldToScreen = useCallback((worldPos: [number, number]) => {
  if (!canvasRef) return null
  const rect = canvasRef.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const scale = viewState.zoom ? Math.pow(2, viewState.zoom) : 1
  
  const screenX = centerX + (worldPos[0] - viewState.longitude) * scale * 100
  const screenY = centerY - (worldPos[1] - viewState.latitude) * scale * 100
  
  return { x: screenX, y: screenY }
}, [canvasRef, viewState])
```

### 4. Zoom-Aware Buffer Calculations
**Challenge**: 6px buffer must remain consistent regardless of zoom level.

**Solution**: Dynamic buffer calculation based on current zoom:

```typescript
const bufferWorld = 6 / (scale * 100) // Convert 6px to world units
```

## Interaction Zone Priorities

1. **Corner resize zones** (±6px from corners) - highest priority
2. **Edge resize zones** (±6px from edges) - medium priority  
3. **Rotation zones** (6-10px from corners) - low priority
4. **Move zones** (inside layer) - lowest priority

## Cursor Mapping System

Each handle type maps to its specific resize cursor:
- `nw` → `nw-resize`
- `ne` → `ne-resize` 
- `se` → `se-resize`
- `sw` → `sw-resize`
- `n`/`s` → `ns-resize`
- `e`/`w` → `ew-resize`
- `rotate` → `crosshair`

## Controller Configuration

```typescript
controller={{
  dragPan: !dragging,    // Disable pan when dragging layers
  dragRotate: false,     // Disable map rotation
  scrollZoom: true,      // Keep zoom functionality
  touchZoom: true,
  touchRotate: false,
  keyboard: false
}}
```

## Distance Calculation Algorithms

### Distance to Line Segment (for edges)
```typescript
const distanceToLineSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq

  let xx, yy
  if (param < 0) {
    xx = x1; yy = y1
  } else if (param > 1) {
    xx = x2; yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}
```

### Distance to Point (for corners)
```typescript
const distance = Math.sqrt(dx * dx + dy * dy)
```

## Rotation Implementation

Handles smooth rotation with proper angle calculations:

```typescript
const currentAngle = Math.atan2(currentY - centerY, currentX - centerX)
const startAngle = Math.atan2(dragging.startY - centerY, dragging.startX - centerX)

let angleDiff = currentAngle - startAngle
// Normalize to prevent jumps
while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

const rotationChange = angleDiff * (180 / Math.PI)
let newRotation = (dragging.startRotation || 0) + rotationChange
newRotation = ((newRotation % 360) + 360) % 360 // Normalize to 0-360
```

## Layer Rendering Order

Critical for proper interaction:
1. `polygonLayer` - Main visible content
2. `interactionLayer` - Invisible interaction zones (must be after main layer)
3. `borderLayer` - Selection borders
4. `handleLayer` - Visual resize handles

## Common Pitfalls & Solutions

### 1. Event Bubbling Issues
**Problem**: Events not being handled correctly between layers
**Solution**: Ensure proper layer ordering and return `true` from event handlers when needed

### 2. Coordinate System Confusion  
**Problem**: Cursor directions not matching visual directions
**Solution**: Carefully map coordinate systems and test thoroughly

### 3. Zoom-Dependent Buffer Sizes
**Problem**: Buffer zones changing size with zoom
**Solution**: Recalculate buffer in world coordinates based on current zoom level

### 4. Performance Considerations
**Problem**: Complex calculations on every hover/drag
**Solution**: Use `useCallback` and `useMemo` appropriately, avoid unnecessary recalculations

## Dependencies

- `@deck.gl/react` - Core DeckGL React integration
- `@deck.gl/layers` - PolygonLayer and ScatterplotLayer
- `@deck.gl/core` - ViewState and event types

## Future Improvements

1. **Multi-selection support**: Handle multiple selected layers simultaneously
2. **Snapping**: Add grid/object snapping during resize/move operations  
3. **Keyboard shortcuts**: Implement Figma-like keyboard shortcuts
4. **Undo/Redo**: Add action history management
5. **Performance optimization**: Optimize for large numbers of layers

## Testing Recommendations

1. Test at different zoom levels to ensure consistent 6px buffer zones
2. Test rotation at various angles to verify cursor accuracy
3. Test edge cases (very small/large layers, extreme rotations)
4. Test on different screen sizes and resolutions
5. Performance test with many layers selected simultaneously

## Browser Compatibility

Tested and working on:
- Chrome 120+
- Firefox 115+  
- Safari 16+
- Edge 120+

Note: Relies on modern JavaScript features (ES2020+) and Canvas APIs.