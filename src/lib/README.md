# DeckGL Transformation Library

A React hook-based library that adds interactive transformation capabilities (move, resize, rotate) to DeckGL layers. Perfect for building design tools, editors, or any application that needs interactive object manipulation.

## Features

- ✅ **Hook-based integration** - Easy to add to existing DeckGL apps
- ✅ **Move, resize, rotate** - Full transformation support  
- ✅ **BitmapLayer rotation** - Proper matrix-based image rotation
- ✅ **Zoom-independent UI** - Handles and borders stay consistent size
- ✅ **TypeScript support** - Fully typed API
- ✅ **Keyboard shortcuts** - Shift for aspect ratio/rotation snapping
- ✅ **Debug mode** - Visual feedback for interaction zones

## Quick Start

### Basic Integration

```tsx
import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { PolygonLayer } from '@deck.gl/layers';
import { 
  useTransformationFrames, 
  createTransformationPolygonLayers,
  getRotatedPolygon 
} from './lib';

const MyApp = () => {
  const [viewState, setViewState] = useState({
    longitude: 0, latitude: 0, zoom: 8, pitch: 0, bearing: 0
  });
  const [objects, setObjects] = useState([
    {
      id: '1', x: -0.5, y: 0.5, width: 1, height: 0.8,
      selected: false, zIndex: 1, rotation: 0
    }
  ]);
  const [canvasRef, setCanvasRef] = useState(null);

  // Handle object updates
  const handleTransformUpdate = useCallback((object, changes) => {
    setObjects(prev => 
      prev.map(obj => obj.id === object.id ? { ...obj, ...changes } : obj)
    );
  }, []);

  // Handle selection changes
  const handleSelectionChange = useCallback((selectedIds) => {
    setObjects(prev => prev.map(obj => ({
      ...obj, selected: selectedIds.includes(obj.id)
    })));
  }, []);

  // Initialize transformation hook
  const transformation = useTransformationFrames({
    objects, viewState, canvasElement: canvasRef,
    config: {
      onTransformUpdate: handleTransformUpdate,
      onSelectionChange: handleSelectionChange,
    },
  });

  // Create your application layers
  const applicationLayers = [
    new PolygonLayer({
      id: 'my-polygons',
      data: objects,
      getPolygon: (obj) => getRotatedPolygon(obj), // Apply rotation
      getFillColor: [255, 100, 100, 180],
      pickable: true,
    }),
  ];

  // Create transformation UI layers
  const transformationLayersData = transformation.generateLayers();
  const transformationLayers = createTransformationPolygonLayers(
    transformationLayersData, objects, { showDebugZones: false }
  );

  return (
    <div ref={setCanvasRef} style={{ width: '100%', height: '100vh' }}>
      <DeckGL
        initialViewState={viewState}
        controller={{ dragPan: !transformation.dragging, scrollZoom: true }}
        layers={[...applicationLayers, ...transformationLayers]}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        onHover={transformation.onHover}
        onClick={transformation.onClick}
        onDragStart={transformation.onDragStart}
        onDrag={transformation.onDrag}
        onDragEnd={transformation.onDragEnd}
        getCursor={transformation.getCursor}
      />
    </div>
  );
};
```

## Image Rotation with BitmapLayer

For rotating images, use the `createBitmapRotationMatrix` utility:

```tsx
import { BitmapLayer } from '@deck.gl/layers';
import { createBitmapRotationMatrix } from './lib';

const imageObjects = objects.filter(obj => obj.type === 'image');

const imageLayers = imageObjects.map(obj => {
  const modelMatrix = createBitmapRotationMatrix(obj);
  
  return new BitmapLayer({
    id: `image-${obj.id}`,
    image: '/path/to/image.jpg',
    bounds: [obj.x, obj.y, obj.x + obj.width, obj.y + obj.height],
    modelMatrix: modelMatrix, // Apply rotation matrix
    pickable: true,
  });
});

// Handle BitmapLayer clicks specially
onClick={(info) => {
  if (info.layer?.id?.startsWith('image-')) {
    const layerId = info.layer.id.replace('image-', '');
    transformation.onClick({ ...info, object: { layerId } });
  } else {
    transformation.onClick(info);
  }
}}
```

## Configuration Options

```tsx
const transformation = useTransformationFrames({
  objects, viewState, canvasElement: canvasRef,
  config: {
    // Transformation capabilities
    enableResize: true,
    enableRotate: true, 
    enableMove: true,
    
    // Interaction zones (pixels)
    resizeZoneDistance: 12,   // Resize handle proximity
    rotateZoneDistance: 24,   // Rotate handle proximity
    
    // Visual styling  
    borderWidth: 2,           // Border thickness (pixels)
    handleSize: 4,           // Handle size (pixels)
    borderColor: [24, 144, 255],
    handleColor: [70, 130, 255],
    
    // Behavior
    snapRotation: 15,        // Rotation snap angle (degrees)
    minWidth: 0.01,         // Minimum object width
    minHeight: 0.01,        // Minimum object height  
    debugMode: false,       // Show interaction zones
    
    // Callbacks
    onTransformUpdate: (object, changes) => {
      // Handle object transformations
    },
    onSelectionChange: (selectedIds) => {
      // Handle selection changes
    },
  },
});
```

## Core Types

Objects must implement the `TransformableObject` interface:

```tsx
interface TransformableObject {
  id: string;
  x: number;        // World X coordinate
  y: number;        // World Y coordinate  
  width: number;    // World width
  height: number;   // World height
  selected: boolean; // Selection state
  zIndex?: number;  // Layer order
  rotation?: number; // Rotation in degrees
}
```

Extend it for your custom objects:

```tsx
interface MyObject extends TransformableObject {
  color: [number, number, number];
  type: 'polygon' | 'image';
  customProperty: any;
}
```

## Key Integration Points

### 1. Layer Order
Transformation layers must render **on top**:
```tsx
layers={[...applicationLayers, ...transformationLayers]}
```

### 2. Controller Configuration  
Disable drag pan when transforming:
```tsx
controller={{ dragPan: !transformation.dragging }}
```

### 3. Event Handling
Connect all transformation events:
```tsx
<DeckGL
  onHover={transformation.onHover}
  onClick={transformation.onClick}
  onDragStart={transformation.onDragStart}
  onDrag={transformation.onDrag}
  onDragEnd={transformation.onDragEnd}
  getCursor={transformation.getCursor}
/>
```

### 4. Canvas Reference
Pass the container element:
```tsx
<div ref={setCanvasRef}>
  <DeckGL ... />
</div>
```

## Keyboard Shortcuts

- **Shift + Drag**: Maintain aspect ratio during resize
- **Shift + Rotate**: Snap rotation to configured angle (default: 15°)

## Visual Feedback

The library provides contextual cursors:
- Directional resize cursors (`nw-resize`, `ne-resize`, etc.)
- Custom SVG rotation cursors for corners
- Move cursor when hovering inside objects
- Default cursor when idle

Enable debug mode to see interaction zones:
```tsx
config: { debugMode: true }
```

## Performance Tips

1. **Selective rendering**: Only generate transformation layers for selected objects
2. **Memoization**: Use `useMemo` for expensive computations  
3. **Layer limits**: Consider virtualizing for 100+ objects
4. **Update batching**: Debounce rapid transform updates

## Common Patterns

### Selection Management
```tsx
const handleSelectionChange = useCallback((selectedIds) => {
  setObjects(prev => {
    const maxZIndex = Math.max(...prev.map(obj => obj.zIndex || 0));
    return prev.map(obj => ({
      ...obj,
      selected: selectedIds.includes(obj.id),
      zIndex: selectedIds.includes(obj.id) ? maxZIndex + 1 : obj.zIndex,
    }));
  });
}, []);
```

### Custom Layer Types
For layers without standard `data` properties, create synthetic picking info:
```tsx
onClick={(info) => {
  let processedInfo = info;
  
  // Handle special layer types
  if (info.layer?.id?.startsWith('custom-')) {
    processedInfo = {
      ...info,
      object: { layerId: extractIdFromLayer(info.layer) }
    };
  }
  
  transformation.onClick(processedInfo);
}}
```

### State Synchronization
Keep transformation state in sync with your application state:
```tsx
const handleTransformUpdate = useCallback((object, changes) => {
  // Update local state
  setObjects(prev => updateObject(prev, object.id, changes));
  
  // Sync with external state management
  dispatch(updateObjectAction(object.id, changes));
  
  // Save to backend
  saveObjectToServer(object.id, { ...object, ...changes });
}, []);
```

## Library Structure

```
src/lib/
├── hooks/
│   └── useTransformationFrames.ts    # Main hook
├── utils/
│   ├── layerFactories.ts            # Layer creation
│   ├── matrixUtils.ts               # Matrix transformations  
│   ├── coordinates.ts               # Coordinate utilities
│   └── ...
├── types/index.ts                   # TypeScript definitions
├── index.ts                         # Main exports
└── README.md                        # This documentation
```

## Exports

The library exports everything you need:

```tsx
import { 
  // Main hook
  useTransformationFrames,
  
  // Layer utilities  
  createTransformationPolygonLayers,
  
  // Transformation utilities
  getRotatedPolygon,
  createBitmapRotationMatrix,
  
  // Types
  type TransformableObject,
  type ViewState,
  type TransformationConfig,
  type UseTransformationFramesReturn,
} from './lib';
```

## Demo

See the complete working demo in the parent directory at `/src/components/HookBasedDemo.tsx` for examples with:
- Polygon layers with rotation support
- BitmapLayer with matrix-based image rotation
- Selection management and z-index handling
- Custom object types and properties
- Debug mode for development
- All transformation features integrated