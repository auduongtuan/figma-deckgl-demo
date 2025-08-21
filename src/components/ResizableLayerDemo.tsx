import React, { useState, useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import type { ViewStateChangeParameters } from "@deck.gl/core";
import type { 
  LayerObject, 
  DraggingState, 
  HoveredHandle, 
  DeckGLPickingInfo,
  PolygonData,
  ZoneData,
  BorderData,
  HandleData
} from "../types/layer";
import type { ViewState } from "../utils/coordinates";
import { isPointInsideLayer } from "../utils/coordinates";
import { getHoverZone } from "../utils/hoverDetection";
import { getCursor } from "../utils/cursorUtils";
import { 
  generatePolygonData, 
  generateResizeZoneData, 
  generateRotateZoneData, 
  generateBorderData, 
  generateHandleData 
} from "../utils/dataGeneration";
import "./ResizableLayerDemo.css";

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 8,
  pitch: 0,
  bearing: 0,
};

export const ResizableLayerDemo: React.FC = () => {
  const [showDebugZones, setShowDebugZones] = useState<boolean>(true);
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [layers, setLayers] = useState<LayerObject[]>([
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
    },
  ]);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [keyPressed, setKeyPressed] = useState<{ shift: boolean }>({
    shift: false,
  });
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(null);
  const hoveredHandleRef = useRef<HoveredHandle | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLDivElement | null>(null);
  const [isHoveringInsideLayer, setIsHoveringInsideLayer] = useState<boolean>(false);

  // Keyboard event listeners
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setKeyPressed((prev) => ({ ...prev, shift: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setKeyPressed((prev) => ({ ...prev, shift: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleClick = useCallback(
    (info: DeckGLPickingInfo) => {
      if (!info.object) {
        // Clicked on empty area, deselect all
        setLayers((prev) =>
          prev.map((layer) => ({ ...layer, selected: false }))
        );
        return;
      }

      const clickedLayer = layers.find(
        (layer) => layer.id === info.object?.layerId
      );
      if (!clickedLayer) return;

      // Select the layer and bring it to front
      const maxZIndex = Math.max(...layers.map((l) => l.zIndex));
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          selected: layer.id === clickedLayer.id,
          zIndex: layer.id === clickedLayer.id ? maxZIndex + 1 : layer.zIndex,
        }))
      );
    },
    [layers]
  );

  const handleDragStart = useCallback(
    (info: DeckGLPickingInfo) => {
      if (!info.coordinate) return;

      const coordinate = info.coordinate;
      const [worldX, worldY] = coordinate as [number, number];

      // Always check for hover zones first, regardless of what was clicked
      for (const layer of layers) {
        if (layer.selected) {
          const zone = getHoverZone(layer, worldX, worldY, viewState, canvasRef);
          if (zone) {
            if (zone.type === "resize") {
              setDragging({
                layerId: layer.id,
                startX: coordinate[0],
                startY: coordinate[1],
                type: "resize",
                handle: zone.handle,
                originalAspectRatio: layer.width / layer.height,
                originalBounds: {
                  x: layer.x,
                  y: layer.y,
                  width: layer.width,
                  height: layer.height,
                },
              });
              return;
            } else if (zone.type === "rotate") {
              setDragging({
                layerId: layer.id,
                startX: coordinate[0],
                startY: coordinate[1],
                type: "rotate",
                handle: zone.handle,
                startRotation: layer.rotation,
              });
              return;
            }
          }
        }
      }

      // If no hover zone detected, check for regular layer clicks
      if (info.object) {
        const clickedLayer = layers.find(
          (layer) => layer.id === info.object?.layerId
        );
        if (clickedLayer) {
          const isInside = isPointInsideLayer(clickedLayer, worldX, worldY);
          if (isInside) {
            // Inside layer = move
            setDragging({
              layerId: clickedLayer.id,
              startX: coordinate[0],
              startY: coordinate[1],
              type: "move",
            });
          }
        }
      }
    },
    [layers, viewState, canvasRef]
  );

  const handleDrag = useCallback(
    (info: DeckGLPickingInfo) => {
      if (!dragging || !info.coordinate) return;

      const [currentX, currentY] = info.coordinate as [number, number];
      const deltaX = currentX - dragging.startX;
      const deltaY = currentY - dragging.startY;

      setLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== dragging.layerId) return layer;

          if (dragging.type === "move") {
            return {
              ...layer,
              x: layer.x + deltaX,
              y: layer.y + deltaY,
            };
          } else if (dragging.type === "rotate") {
            const centerX = layer.x + layer.width / 2;
            const centerY = layer.y + layer.height / 2;

            // Calculate current angle from center to mouse position
            const currentAngle = Math.atan2(
              currentY - centerY,
              currentX - centerX
            );
            const startAngle = Math.atan2(
              dragging.startY - centerY,
              dragging.startX - centerX
            );

            // Calculate rotation difference in radians, then convert to degrees
            let angleDiff = currentAngle - startAngle;

            // Normalize angle difference to prevent jumps
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            // Convert to degrees and add to starting rotation
            const rotationChange = angleDiff * (180 / Math.PI);
            let newRotation = (dragging.startRotation || 0) + rotationChange;

            // Normalize to 0-360 range
            newRotation = ((newRotation % 360) + 360) % 360;

            // Snap to 15-degree increments if shift is pressed
            if (keyPressed.shift) {
              newRotation = Math.round(newRotation / 15) * 15;
              if (newRotation >= 360) newRotation = 0;
            }

            return {
              ...layer,
              rotation: newRotation,
            };
          } else if (dragging.type === "resize" && dragging.handle) {
            const newLayer = { ...layer };
            const handle = dragging.handle;

            // Use the original bounds stored when drag started
            if (!dragging.originalBounds) return layer;

            const orig = dragging.originalBounds;
            
            // Calculate new dimensions based on handle type
            if (handle === "s") {
              // Pure south (bottom) resize - bottom edge follows cursor, top edge stays fixed
              newLayer.y = orig.y;
              newLayer.height = Math.abs(currentY - orig.y);
            } else if (handle === "n") {
              // Pure north (top) resize - top edge follows cursor, bottom edge stays fixed
              const originalBottom = orig.y + orig.height;
              newLayer.y = currentY;
              newLayer.height = Math.abs(originalBottom - currentY);
            } else if (handle === "w") {
              // Pure west (left) resize - keep original right fixed
              const originalRight = orig.x + orig.width;
              newLayer.width = Math.abs(originalRight - currentX);
              newLayer.x = Math.min(currentX, originalRight);
            } else if (handle === "e") {
              // Pure east (right) resize - keep original left fixed
              newLayer.x = orig.x;
              newLayer.width = Math.abs(currentX - orig.x);
            } else {
              // Corner handles
              if (handle.includes("n")) {
                // North corners - top edge moves, bottom edge stays fixed
                newLayer.y = currentY;
                newLayer.height = Math.abs((orig.y + orig.height) - currentY);
              } else if (handle.includes("s")) {
                // South corners - bottom edge follows cursor, top edge stays fixed
                newLayer.y = orig.y;
                newLayer.height = Math.abs(currentY - orig.y);
              }
              
              if (handle.includes("w")) {
                // West corners - left edge moves, right edge stays fixed
                const originalRight = orig.x + orig.width;
                newLayer.width = Math.abs(originalRight - currentX);
                newLayer.x = Math.min(currentX, originalRight);
              } else if (handle.includes("e")) {
                // East corners - right edge moves, left edge stays fixed
                newLayer.x = orig.x;
                newLayer.width = Math.abs(currentX - orig.x);
              }
            }

            // Maintain aspect ratio when shift is pressed
            if (keyPressed.shift && dragging.originalAspectRatio) {
              const aspectRatio = dragging.originalAspectRatio;
              // Simplified aspect ratio maintenance for corner handles
              if (handle.includes("w") || handle.includes("e")) {
                newLayer.height = newLayer.width / aspectRatio;
              } else if (handle.includes("n") || handle.includes("s")) {
                newLayer.width = newLayer.height * aspectRatio;
              }
            }

            // Prevent negative dimensions and maintain minimum size
            newLayer.width = Math.max(0.01, Math.abs(newLayer.width));
            newLayer.height = Math.max(0.01, newLayer.height);

            return newLayer;
          }

          return layer;
        })
      );

      // Don't update startX/startY during drag for rotation or resize
      if (dragging.type === "rotate" || dragging.type === "resize") {
        return;
      }

      setDragging((prev) =>
        prev ? { ...prev, startX: currentX, startY: currentY } : null
      );
    },
    [dragging, keyPressed.shift]
  );

  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

  const handleHover = useCallback(
    (info: DeckGLPickingInfo) => {
      let newHoveredHandle: HoveredHandle | null = null;
      let hoveringInsideLayer = false;

      if (info.coordinate) {
        const [worldX, worldY] = info.coordinate as [number, number];

        // Check all selected layers for hover zones and inside detection
        for (const layer of layers) {
          if (layer.selected) {
            const zone = getHoverZone(layer, worldX, worldY, viewState, canvasRef);
            if (zone) {
              newHoveredHandle = {
                layerId: layer.id,
                handleType: zone.handle,
                zoneType: zone.zoneType,
              };
              break;
            }
            
            // If no hover zone but still inside the layer, set hovering inside layer
            if (!zone && isPointInsideLayer(layer, worldX, worldY)) {
              hoveringInsideLayer = true;
            }
          }
        }
      }

      // Update the hovering inside layer state
      setIsHoveringInsideLayer(hoveringInsideLayer);

      // Only update if different from current
      const current = hoveredHandleRef.current;
      const isDifferent =
        (!current && newHoveredHandle) ||
        (current && !newHoveredHandle) ||
        (current &&
          newHoveredHandle &&
          (current.layerId !== newHoveredHandle.layerId ||
            current.handleType !== newHoveredHandle.handleType ||
            current.zoneType !== newHoveredHandle.zoneType));

      if (isDifferent) {
        hoveredHandleRef.current = newHoveredHandle;
        setHoveredHandle(newHoveredHandle);
      }
    },
    [layers, viewState, canvasRef]
  );

  const handleViewStateChange = useCallback(
    ({ viewState }: ViewStateChangeParameters) => {
      setViewState(viewState);
    },
    []
  );

  const cursorStyle = getCursor(dragging, hoveredHandle, layers, isHoveringInsideLayer);

  // Generate data for DeckGL layers
  const polygonData = useMemo(() => generatePolygonData(layers), [layers]);
  
  const resizeZoneData = useMemo(
    () => generateResizeZoneData(layers, viewState, canvasRef),
    [layers, canvasRef, viewState]
  );

  const rotateZoneData = useMemo(
    () => generateRotateZoneData(layers, viewState, canvasRef),
    [layers, canvasRef, viewState]
  );

  const borderData = useMemo(() => generateBorderData(layers), [layers]);

  const handleData = useMemo(() => generateHandleData(layers), [layers]);

  // Create DeckGL layers
  const polygonLayer = new PolygonLayer<PolygonData>({
    id: "layer-polygons",
    data: polygonData,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => [...d.color, 180] as [number, number, number, number],
    getLineColor: [0, 0, 0, 0],
    pickable: true,
    onClick: handleClick,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  const resizeZoneLayer = new PolygonLayer<ZoneData>({
    id: "resize-zones",
    data: resizeZoneData,
    getPolygon: (d) => d.polygon,
    getFillColor: showDebugZones ? [0, 255, 0, 30] : [0, 0, 0, 0],
    getLineColor: showDebugZones ? [0, 255, 0, 80] : [0, 0, 0, 0],
    getLineWidth: showDebugZones ? 1 : 0,
    pickable: true,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  const rotateZoneLayer = new PolygonLayer<ZoneData>({
    id: "rotate-zones",
    data: rotateZoneData,
    getPolygon: (d) => d.polygon,
    getFillColor: showDebugZones ? [0, 0, 255, 20] : [0, 0, 0, 0],
    getLineColor: showDebugZones ? [0, 0, 255, 60] : [0, 0, 0, 0],
    getLineWidth: showDebugZones ? 1 : 0,
    pickable: true,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  const borderLayer = new PolygonLayer<BorderData>({
    id: "selection-borders",
    data: borderData,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => [...d.color, 255] as [number, number, number, number],
    getLineColor: [0, 0, 0, 0],
    pickable: false,
  });

  const handleLayer = new ScatterplotLayer<HandleData>({
    id: "resize-handles",
    data: handleData,
    getPosition: (d) => d.position,
    getRadius: (d) => d.size,
    getFillColor: (d) => d.color,
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 2,
    pickable: false,
    radiusScale: 0.001,
    radiusMinPixels: 4,
    radiusMaxPixels: 8,
  });

  return (
    <div className="resizable-layer-demo">
      <div
        className="canvas-container"
        ref={setCanvasRef}
        style={{ position: "relative" }}
      >
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={{
            dragPan: !dragging,
            dragRotate: false,
            scrollZoom: true,
            touchZoom: true,
            touchRotate: false,
            keyboard: false,
          }}
          layers={[
            polygonLayer,
            rotateZoneLayer,
            resizeZoneLayer,
            borderLayer,
            handleLayer,
          ]}
          onViewStateChange={handleViewStateChange}
          onHover={handleHover}
          getCursor={() => cursorStyle}
        />
        {dragging?.type === "rotate" && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0, 0, 0, 0.8)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            {Math.round(
              layers.find((l) => l.id === dragging.layerId)?.rotation || 0
            )}
            °{keyPressed.shift && " (snapped)"}
          </div>
        )}
      </div>
      <div className="controls">
        <h3>Layers</h3>
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={() => setShowDebugZones(!showDebugZones)}
            style={{
              padding: "8px 12px",
              backgroundColor: showDebugZones ? "#4CAF50" : "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              marginBottom: "10px",
            }}
          >
            Debug Zones: {showDebugZones ? "ON" : "OFF"}
          </button>
        </div>
        <div style={{ marginBottom: "15px", fontSize: "12px", color: "#666" }}>
          <div>• Click layers to select</div>
          <div>• Drag inside: move</div>
          <div>• Hover ±12px from edges: resize</div>
          <div>• Hover 12-24px from corners: rotate</div>
          <div>• Hold Shift: keep ratio/15° snap</div>
          {showDebugZones && (
            <>
              <div style={{ color: "#0f0", fontStyle: "italic" }}>
                • Green zones = 12px resize areas
              </div>
              <div style={{ color: "#00f", fontStyle: "italic" }}>
                • Blue zones = 12-24px rotate areas
              </div>
            </>
          )}
        </div>
        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => (
            <div
              key={layer.id}
              className={`layer-item ${layer.selected ? "selected" : ""}`}
              onClick={() => {
                const maxZIndex = Math.max(...layers.map((l) => l.zIndex));
                setLayers((prev) =>
                  prev.map((l) => ({
                    ...l,
                    selected: l.id === layer.id,
                    zIndex: l.id === layer.id ? maxZIndex + 1 : l.zIndex,
                  }))
                );
              }}
              style={{ backgroundColor: `rgb(${layer.color.join(",")})` }}
            >
              <div className="layer-info">
                <span>Layer {layer.id}</span>
                <span className="z-index">
                  z: {layer.zIndex} | {Math.round(layer.rotation)}°
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};