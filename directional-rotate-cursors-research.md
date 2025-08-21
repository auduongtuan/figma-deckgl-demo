# Directional Rotate Cursors Implementation Research

## Overview
Research and implementation plan for adding directional rotate cursors based on corners, similar to tldraw's approach. The cursors should change based on which corner handle the user is hovering over, providing visual feedback for rotation direction.

## Key Findings from tldraw Source Code

### 1. tldraw's useCursor.ts Implementation
- Location: `packages/editor/src/lib/hooks/useCursor.ts`
- Uses SVG-based cursor generation with dynamic rotation
- Supports corner-specific cursors: `nwse-rotate`, `nesw-rotate`, `nwse-resize`, `nesw-resize`
- Implements trigonometry for cursor rotation: `const a = (-tr - r) * (PI / 180)`
- Color-adaptive cursors (black/white based on dark/light mode)

### 2. Available CSS Cursor Types
- **Standard Corner Resize**: `nw-resize`, `ne-resize`, `sw-resize`, `se-resize`
- **Diagonal Resize**: `nesw-resize`, `nwse-resize`
- **Edge Resize**: `n-resize`, `e-resize`, `s-resize`, `w-resize`
- **Custom SVG Cursors**: For rotation with dynamic angles

### 3. Technical Approach

#### SVG Cursor Generation
```typescript
function getCursorCss(type: CursorType, options: CursorOptions = {}): string {
  const { color = '#000', rotation = 0 } = options;
  const svgCursor = generateRotateCursorSvg(type, color, rotation);
  return `url('data:image/svg+xml;base64,${btoa(svgCursor)}') 12 12, auto`;
}
```

#### Corner-Specific Mapping
```typescript
const cornerToCursor = {
  'nw': 'nwse-rotate',
  'ne': 'nesw-rotate', 
  'sw': 'nesw-rotate',
  'se': 'nwse-rotate',
};
```

## Implementation Components for figma-deckgl-demo

### 1. Cursor Utility Module (`src/utils/cursor.ts`)
- Generate SVG-based cursors with rotation capabilities
- Support corner-specific cursors
- Include dark/light mode support with color adaptation
- Handle cursor rotation calculations using trigonometry

### 2. Corner Handle Components
- `CornerHandle.tsx` - Individual corner handle component with position-specific cursor styling
- `RotationHandles.tsx` - Container for all corner handles
- Each handle manages hover/drag state and cursor updates

### 3. Cursor Management Hook (`src/hooks/useCursor.ts`)
- Manage cursor state based on hover/drag interactions
- Calculate appropriate cursor rotation for each corner
- Handle cursor updates during rotation operations

### 4. Integration Points
- Update existing rotation handles in deckgl demo
- Add cursor management to shape selection/rotation logic
- Implement mouse interaction handlers for rotation

## Cursor Types to Implement

### Corner Rotation Cursors
1. **Northwest (NW)**: `nwse-rotate` - Diagonal cursor indicating NW-SE rotation
2. **Northeast (NE)**: `nesw-rotate` - Diagonal cursor indicating NE-SW rotation  
3. **Southwest (SW)**: `nesw-rotate` - Diagonal cursor indicating NE-SW rotation
4. **Southeast (SE)**: `nwse-rotate` - Diagonal cursor indicating NW-SE rotation

### Edge Rotation Cursors (if needed)
1. **North**: `ns-rotate` - Vertical rotation cursor
2. **East**: `ew-rotate` - Horizontal rotation cursor
3. **South**: `ns-rotate` - Vertical rotation cursor
4. **West**: `ew-rotate` - Horizontal rotation cursor

## SVG Cursor Design

### Base Cursor Shape
- Arrow pointing in rotation direction
- Circular arc to indicate rotation motion
- Small arrow tip showing rotation direction
- Size: 24x24px with 12,12 hotspot

### Dynamic Properties
- **Color**: Adapts to theme (black for light, white for dark)
- **Rotation**: Adjusts based on current shape rotation angle
- **Position**: Calculated relative to handle position

## Implementation Steps

1. **Create cursor utility functions**
   - SVG generation for rotate cursors
   - Corner position to cursor type mapping
   - Rotation calculation helpers

2. **Implement corner handle components**
   - Individual handles with cursor management
   - Container component for handle positioning
   - Mouse interaction handling

3. **Add cursor management hook**
   - State management for active cursor
   - Dynamic cursor updates
   - Theme detection and adaptation

4. **Integrate with existing demo**
   - Update shape selection system
   - Add rotation handles to selected shapes
   - Connect cursor updates to mouse interactions

5. **Testing and refinement**
   - Test cursor behavior across different rotations
   - Verify dark/light mode adaptation
   - Ensure smooth cursor transitions

## References
- [tldraw useCursor.ts](https://github.com/tldraw/tldraw/blob/b4611e27bade3a1a2b5c18683f60cc83538e2277/packages/editor/src/lib/hooks/useCursor.ts#L59)
- [MDN CSS cursor documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor)
- [CSS-Tricks cursor rotation article](https://css-tricks.com/can-you-rotate-the-cursor-in-css/)

## Next Steps
Implement this cursor system in the figma-deckgl-demo project to provide professional-grade visual feedback for rotation operations, matching the behavior seen in tools like tldraw and Figma.