import React, { useState, useMemo, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer, BitmapLayer } from "@deck.gl/layers";
import type { ViewStateChangeParameters } from "@deck.gl/core";

import {
  useTransformationFrames,
  createTransformationPolygonLayers,
  createBitmapRotationMatrix,
  getRotatedPolygon,
} from "../lib";
import type { TransformableObject, ViewState } from "../lib";
import "./ResizableLayerDemo.css";

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 8,
  pitch: 0,
  bearing: 0,
};

// Extend TransformableObject to add rendering properties
interface LayerObject extends TransformableObject {
  color: [number, number, number];
  type: "polygon" | "image";
}

const INITIAL_OBJECTS: LayerObject[] = [
  {
    id: "1",
    x: -0.5,
    y: 0.5,
    width: 1,
    height: 0.8,
    color: [255, 100, 100],
    selected: false,
    zIndex: 1,
    rotation: 0,
    type: "polygon",
  },
  {
    id: "2",
    x: 0.8,
    y: -0.3,
    width: 0.8,
    height: 1.2,
    color: [100, 255, 100],
    selected: false,
    zIndex: 2,
    rotation: 0,
    type: "polygon",
  },
  {
    id: "3",
    x: -0.8,
    y: -0.8,
    width: 1.2,
    height: 0.6,
    color: [100, 100, 255],
    selected: false,
    zIndex: 3,
    rotation: 0,
    type: "polygon",
  },
  // Demo image object
  {
    id: "4",
    x: 1.5,
    y: 0.2,
    width: 1,
    height: 0.75,
    color: [200, 200, 200],
    selected: false,
    zIndex: 4,
    rotation: 15, // Shows rotation capability
    type: "image",
  },
];

/**
 * Demo showing hook-based integration with existing DeckGL setup
 * This approach gives full control over DeckGL configuration
 */
export const HookBasedDemo: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [objects, setObjects] = useState<LayerObject[]>(INITIAL_OBJECTS);
  const [showDebugZones, setShowDebugZones] = useState<boolean>(false);
  const [canvasRef, setCanvasRef] = useState<HTMLDivElement | null>(null);

  // Handle individual object transformation updates
  const handleTransformUpdate = useCallback(
    (object: TransformableObject, changes: Partial<TransformableObject>) => {
      setObjects((prev) =>
        prev.map((obj) => (obj.id === object.id ? { ...obj, ...changes } : obj))
      );
    },
    []
  );

  // Handle object selection - bring to front like original
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setObjects((prev) => {
      const maxZIndex = Math.max(...prev.map((obj) => obj.zIndex || 0));
      return prev.map((obj) => ({
        ...obj,
        selected: selectedIds.includes(obj.id),
        zIndex: selectedIds.includes(obj.id) ? maxZIndex + 1 : obj.zIndex,
      }));
    });
  }, []);

  // Use the transformation hook
  const transformation = useTransformationFrames({
    objects,
    viewState,
    canvasElement: canvasRef,
    config: {
      enableResize: true,
      enableRotate: true,
      enableMove: true,
      debugMode: showDebugZones,
      snapRotation: 15,
      onTransformUpdate: handleTransformUpdate,
      onSelectionChange: handleSelectionChange,
    },
  });

  // Handle view state changes
  const handleViewStateChange = useCallback(
    ({ viewState }: ViewStateChangeParameters) => {
      setViewState(viewState);
    },
    []
  );

  // Create application layers (your existing content)
  const polygonObjects = useMemo(
    () => objects.filter((obj) => obj.type === "polygon"),
    [objects]
  );
  const imageObjects = useMemo(
    () => objects.filter((obj) => obj.type === "image"),
    [objects]
  );

  const applicationLayers = useMemo(() => {
    const layers: (PolygonLayer | BitmapLayer)[] = [];

    // Add polygon layers with rotation support
    if (polygonObjects.length > 0) {
      const polygonData = polygonObjects.map((obj) => ({
        polygon: getRotatedPolygon(obj), // Use rotated polygon
        color: obj.color,
        layerId: obj.id,
      }));

      layers.push(
        new PolygonLayer({
          id: "app-polygons",
          data: polygonData,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) =>
            [d.color[0], d.color[1], d.color[2], 180] as [
              number,
              number,
              number,
              number
            ],
          getLineColor: [0, 0, 0, 0],
          pickable: true,
        })
      );
    }

    // Add image layers with matrix-based rotation support
    imageObjects.forEach((obj) => {
      const imageSrc = `/assets/demo.jpg`;
      const bounds = [obj.x, obj.y, obj.x + obj.width, obj.y + obj.height] as [
        number,
        number,
        number,
        number
      ];

      // Create rotation matrix using the same center point as transformation system
      const modelMatrix = createBitmapRotationMatrix(obj);

      layers.push(
        new BitmapLayer({
          id: `image-${obj.id}`,
          image: imageSrc,
          bounds: bounds,
          modelMatrix: modelMatrix, // Apply rotation using transformation matrix
          pickable: true,
          opacity: 1,
          visible: true,
          // BitmapLayer doesn't have a data prop like other layers
          // Instead, we need to handle the click properly in the onClick handler
        })
      );
    });

    return layers;
  }, [polygonObjects, imageObjects]);

  // Get transformation layers from the hook
  const transformationLayersData = transformation.generateLayers();

  // Create DeckGL transformation layers using library utility
  const transformationLayers = useMemo(() => {
    return createTransformationPolygonLayers(
      transformationLayersData,
      objects,
      { showDebugZones }
    );
  }, [transformationLayersData, objects, showDebugZones]);

  // Combine all layers
  const allLayers = useMemo(
    () => [...applicationLayers, ...transformationLayers],
    [applicationLayers, transformationLayers]
  );

  return (
    <div className="resizable-layer-demo">
      <div className="page-title">DeckGL Transform Controls</div>
      
      <div
        ref={setCanvasRef}
        className="canvas-container"
      >
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={{
            dragPan: !transformation.dragging,
            dragRotate: false,
            scrollZoom: true,
            touchZoom: true,
            touchRotate: false,
            keyboard: false,
          }}
          layers={allLayers}
          onViewStateChange={handleViewStateChange}
          onHover={transformation.onHover}
          onClick={(info) => {
            // Handle image layer clicks specially
            if (
              info.layer &&
              info.layer.id &&
              info.layer.id.startsWith("image-")
            ) {
              const layerId = info.layer.id.replace("image-", "");
              // Create a synthetic info object that the transformation system expects
              const syntheticInfo = {
                ...info,
                object: { layerId: layerId },
              };
              transformation.onClick(syntheticInfo);
            } else {
              transformation.onClick(info);
            }
          }}
          onDragStart={(info) => {
            // Handle image layer drag start specially
            if (
              info.layer &&
              info.layer.id &&
              info.layer.id.startsWith("image-")
            ) {
              const layerId = info.layer.id.replace("image-", "");
              const syntheticInfo = {
                ...info,
                object: { layerId: layerId },
              };
              transformation.onDragStart(syntheticInfo);
            } else {
              transformation.onDragStart(info);
            }
          }}
          onDrag={transformation.onDrag}
          onDragEnd={transformation.onDragEnd}
          getCursor={transformation.getCursor}
        />

        {/* Rotation indicator */}
        {transformation.dragging?.type === "rotate" && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(12px)",
              color: "white",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "500",
              pointerEvents: "none",
              zIndex: 20,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            }}
          >
            {Math.round(
              objects.find((obj) => obj.id === transformation.dragging?.layerId)
                ?.rotation || 0
            )}°
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls">        
        {/* Debug Toggle */}
        <div className="debug-toggle-container">
          <span className="debug-toggle-label">Debug Zones</span>
          <button
            className={`toggle-switch ${showDebugZones ? 'active' : ''}`}
            onClick={() => setShowDebugZones(!showDebugZones)}
          />
        </div>

        {/* Info Section */}
        <div className="info-section">
          <div>• Move, resize & rotate objects</div>
          <div>• Rotation-aware interactions</div>
          <div>• 🔸 = Polygons | 📷 = Images</div>
          {showDebugZones && (
            <div className="debug-info">
              <div style={{ color: "#10b981" }}>• Green zones = resize areas</div>
              <div style={{ color: "#3b82f6" }}>• Blue zones = rotate areas</div>
            </div>
          )}
        </div>

        {[...objects]
          .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
          .map((layer) => (
            <div
              key={layer.id}
              className={`layer-item ${layer.selected ? "selected" : ""}`}
              onClick={() => {
                const maxZIndex = Math.max(
                  ...objects.map((l) => l.zIndex || 0)
                );
                setObjects((prev) =>
                  prev.map((l) => ({
                    ...l,
                    selected: l.id === layer.id,
                    zIndex: l.id === layer.id ? maxZIndex + 1 : l.zIndex,
                  }))
                );
              }}
            >
              <div 
                className="layer-color-indicator"
                style={{ backgroundColor: `rgb(${layer.color.join(",")})` }}
              />
              <div className="layer-info">
                <span>
                  Layer {layer.id} {layer.type === "image" ? "📷" : "🔸"}
                </span>
                <span className="z-index">
                  z: {layer.zIndex} | {Math.round(layer.rotation || 0)}°
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
