import React, { useState, useCallback, useRef, useMemo } from "react";
import type {
  TransformableObject,
  TransformationConfig,
  TransformationState,
  HoveredHandle,
  DeckGLPickingInfo,
  ViewState,
  BorderData,
  ZoneData,
  HandleData,
} from "../types";
import { isPointInsideLayer } from "../utils/coordinates";
import { getHoverZone } from "../utils/hoverDetection";
import { getCursor } from "../utils/cursor";
import {
  generateBorderData,
  generateResizeZoneData,
  generateRotateZoneData,
  generateHandleData,
} from "../utils/dataGeneration";
import { Vec } from "../utils/rotationAware";

// Default configuration
const DEFAULT_CONFIG: Required<TransformationConfig> = {
  resizeZoneDistance: 6,
  rotateZoneDistance: 16,
  handleSize: 6,
  borderWidth: 2,
  enableResize: true,
  enableRotate: true,
  enableMove: true,
  maintainAspectRatio: false,
  snapRotation: 15,
  minWidth: 0.01,
  minHeight: 0.01,
  invertedYCoordinates: true,
  debugMode: false,
  theme: "light",
  borderColor: [24, 144, 255],
  handleColor: [70, 130, 255],
  resizeZoneColor: [0, 255, 0],
  rotateZoneColor: [0, 0, 255],
  onTransformStart: () => {},
  onTransformUpdate: () => {},
  onTransformEnd: () => {},
  onSelectionChange: () => {},
};


export interface UseTransformationFramesProps {
  objects: TransformableObject[];
  viewState: ViewState;
  canvasElement: HTMLDivElement | null;
  config?: Partial<TransformationConfig>;
}

export interface UseTransformationFramesReturn {
  // Event handlers for DeckGL
  onClick: (info: DeckGLPickingInfo) => void;
  onDragStart: (info: DeckGLPickingInfo) => void;
  onDrag: (info: DeckGLPickingInfo) => void;
  onDragEnd: () => void;
  onHover: (info: DeckGLPickingInfo) => void;

  // Cursor management
  getCursor: () => string;

  // State
  dragging: TransformationState | null;
  hoveredHandle: HoveredHandle | null;

  // Layer data generators
  generateLayers: () => {
    borders: BorderData[];
    resizeZones: ZoneData[];
    rotateZones: ZoneData[];
    handles: HandleData[];
  };

  // Configuration
  config: Required<TransformationConfig>;
}

export function useTransformationFrames({
  objects,
  viewState,
  canvasElement,
  config: userConfig = {},
}: UseTransformationFramesProps): UseTransformationFramesReturn {
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...userConfig }),
    [userConfig]
  );

  const [dragging, setDragging] = useState<TransformationState | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(
    null
  );
  const hoveredHandleRef = useRef<HoveredHandle | null>(null);
  const [isHoveringInsideLayer, setIsHoveringInsideLayer] =
    useState<boolean>(false);
  const [keyPressed, setKeyPressed] = useState<{ shift: boolean }>({
    shift: false,
  });

  // Keyboard event listeners for aspect ratio and snap
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
        const selectedIds: string[] = [];
        config.onSelectionChange(selectedIds);
        return;
      }

      const clickedObject = objects.find(
        (obj) => obj.id === info.object?.layerId
      );
      if (!clickedObject) return;

      // Select the object
      const selectedIds = [clickedObject.id];
      config.onSelectionChange(selectedIds);
    },
    [objects, config]
  );

  const handleDragStart = useCallback(
    (info: DeckGLPickingInfo) => {
      if (!info.coordinate) return;

      const coordinate = info.coordinate;
      const [worldX, worldY] = coordinate.slice(0, 2) as [number, number];

      // Check for hover zones first
      for (const obj of objects) {
        if (obj.selected) {
          const zone = getHoverZone(
            obj,
            worldX,
            worldY,
            viewState,
            canvasElement,
            config
          );
          if (zone) {
            const transformState: TransformationState = {
              layerId: obj.id,
              startX: coordinate[0],
              startY: coordinate[1],
              type: zone.type,
              handle: zone.handle,
              originalAspectRatio: obj.width / obj.height,
              originalBounds: {
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
              },
            };

            if (zone.type === "rotate") {
              transformState.startRotation = obj.rotation || 0;
            }

            setDragging(transformState);
            config.onTransformStart(obj, zone.type);
            return;
          }
        }
      }

      // If no hover zone detected, check for regular object clicks
      if (info.object && config.enableMove) {
        const clickedObject = objects.find(
          (obj) => obj.id === info.object?.layerId
        );
        if (clickedObject) {
          const isInside = isPointInsideLayer(clickedObject, worldX, worldY);
          if (isInside) {
            setDragging({
              layerId: clickedObject.id,
              startX: coordinate[0],
              startY: coordinate[1],
              type: "move",
            });
            config.onTransformStart(clickedObject, "move");
          }
        }
      }
    },
    [objects, viewState, canvasElement, config]
  );

  const handleDrag = useCallback(
    (info: DeckGLPickingInfo) => {
      if (!dragging || !info.coordinate) return;

      const [currentX, currentY] = info.coordinate.slice(0, 2) as [
        number,
        number
      ];
      const deltaX = currentX - dragging.startX;
      const deltaY = currentY - dragging.startY;

      const targetObject = objects.find((obj) => obj.id === dragging.layerId);
      if (!targetObject) return;

      let changes: Partial<TransformableObject> = {};

      if (dragging.type === "move") {
        changes = {
          x: targetObject.x + deltaX,
          y: targetObject.y + deltaY,
        };
      } else if (dragging.type === "rotate") {
        const centerX = targetObject.x + targetObject.width / 2;
        const centerY = targetObject.y + targetObject.height / 2;

        const currentAngle = Math.atan2(currentY - centerY, currentX - centerX);
        const startAngle = Math.atan2(
          dragging.startY - centerY,
          dragging.startX - centerX
        );

        let angleDiff = currentAngle - startAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const rotationChange = angleDiff * (180 / Math.PI);
        let newRotation = (dragging.startRotation || 0) + rotationChange;
        newRotation = ((newRotation % 360) + 360) % 360;

        if (keyPressed.shift) {
          newRotation =
            Math.round(newRotation / config.snapRotation) * config.snapRotation;
          if (newRotation >= 360) newRotation = 0;
        }

        changes = { rotation: newRotation };
      } else if (
        dragging.type === "resize" &&
        dragging.handle &&
        config.enableResize
      ) {
        const handle = dragging.handle;
        const orig = dragging.originalBounds;

        if (!orig) return;

        const rotation = targetObject.rotation || 0;

        // Follow tldraw's approach exactly
        const rotationRad = rotation * (Math.PI / 180);
        
        // Get the scale origin point (opposite corner/edge that stays fixed)
        const scaleOriginLocal = getScaleOriginPoint(handle, orig);
        
        // Get the object center
        const objectCenter = new Vec(orig.x + orig.width / 2, orig.y + orig.height / 2);
        
        // Rotate the scale origin around the object center to get world coordinates
        const scaleOriginWorld = Vec.rotWith(scaleOriginLocal, objectCenter, rotationRad);
        
        // Get current and start points
        const currentPoint = new Vec(currentX, currentY);
        const startPoint = new Vec(dragging.startX, dragging.startY);
        
        // Calculate distances from scale origin, rotated to object's local space
        const currentDistance = Vec.sub(currentPoint, scaleOriginWorld).rot(-rotationRad);
        const startDistance = Vec.sub(startPoint, scaleOriginWorld).rot(-rotationRad);
        
        // Calculate scale factors
        let scaleX = startDistance.x !== 0 ? currentDistance.x / startDistance.x : 1;
        let scaleY = startDistance.y !== 0 ? currentDistance.y / startDistance.y : 1;
        
        // Handle edge cases
        if (!Number.isFinite(scaleX)) scaleX = 1;
        if (!Number.isFinite(scaleY)) scaleY = 1;
        
        // Lock axes for edge handles
        const isXLocked = handle === 'n' || handle === 's';
        const isYLocked = handle === 'w' || handle === 'e';
        
        if (isXLocked) scaleX = 1;
        if (isYLocked) scaleY = 1;
        
        // Aspect ratio constraint
        if (keyPressed.shift) {
          if (isYLocked) {
            scaleY = Math.abs(scaleX);
          } else if (isXLocked) {
            scaleX = Math.abs(scaleY);
          } else if (Math.abs(scaleX) > Math.abs(scaleY)) {
            scaleY = Math.abs(scaleX) * (scaleY < 0 ? -1 : 1);
          } else {
            scaleX = Math.abs(scaleY) * (scaleX < 0 ? -1 : 1);
          }
        }
        
        // Apply constraints
        const minScaleX = config.minWidth / orig.width;
        const minScaleY = config.minHeight / orig.height;
        
        if (Math.abs(scaleX) < minScaleX) {
          scaleX = minScaleX * (scaleX < 0 ? -1 : 1);
        }
        if (Math.abs(scaleY) < minScaleY) {
          scaleY = minScaleY * (scaleY < 0 ? -1 : 1);
        }
        
        // Now apply the scale to get new bounds
        const newBounds = applyScaleToObject(orig, scaleX, scaleY, scaleOriginWorld, rotationRad);
        
        changes = {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.width,
          height: newBounds.height,
        };
      }

      config.onTransformUpdate(targetObject, changes);

      // Don't update startX/startY during drag for rotation or resize
      if (dragging.type === "rotate" || dragging.type === "resize") {
        return;
      }

      // Update drag start position for move operations to prevent accumulation
      setDragging((prev) =>
        prev ? { ...prev, startX: currentX, startY: currentY } : null
      );
    },
    [dragging, keyPressed.shift, objects, config]
  );

  const handleDragEnd = useCallback(() => {
    if (dragging) {
      const targetObject = objects.find((obj) => obj.id === dragging.layerId);
      if (targetObject) {
        config.onTransformEnd(targetObject);
      }
    }
    setDragging(null);
  }, [dragging, objects, config]);

  const handleHover = useCallback(
    (info: DeckGLPickingInfo) => {
      let newHoveredHandle: HoveredHandle | null = null;
      let hoveringInsideLayer = false;

      if (info.coordinate) {
        const [worldX, worldY] = info.coordinate.slice(0, 2) as [
          number,
          number
        ];

        for (const obj of objects) {
          if (obj.selected) {
            const zone = getHoverZone(
              obj,
              worldX,
              worldY,
              viewState,
              canvasElement,
              config
            );
            if (zone) {
              newHoveredHandle = {
                layerId: obj.id,
                handleType: zone.handle,
                zoneType: zone.zoneType,
              };
              break;
            }

            if (!zone && isPointInsideLayer(obj, worldX, worldY)) {
              hoveringInsideLayer = true;
            }
          }
        }
      }

      setIsHoveringInsideLayer(hoveringInsideLayer);

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
    [objects, viewState, canvasElement, config]
  );

  const getCursorStyle = useCallback(() => {
    return getCursor(
      dragging,
      hoveredHandle,
      objects,
      isHoveringInsideLayer,
      config
    );
  }, [dragging, hoveredHandle, objects, isHoveringInsideLayer, config]);

  const generateLayers = useCallback(() => {
    
    return {
      borders: generateBorderData(objects, viewState, canvasElement, config),
      resizeZones: generateResizeZoneData(
        objects,
        viewState,
        canvasElement,
        config
      ),
      rotateZones: generateRotateZoneData(
        objects,
        viewState,
        canvasElement,
        config
      ),
      handles: generateHandleData(objects, viewState, canvasElement, config),
    };
  }, [objects, viewState, canvasElement, config]);

  return {
    onClick: handleClick,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    onHover: handleHover,
    getCursor: getCursorStyle,
    dragging,
    hoveredHandle,
    generateLayers,
    config,
  };
}

// Helper functions for tldraw-style resize
function getScaleOriginPoint(handle: string, bounds: { x: number; y: number; width: number; height: number }): Vec {
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

function applyScaleToObject(
  bounds: { x: number; y: number; width: number; height: number },
  scaleX: number,
  scaleY: number,
  scaleOriginWorld: Vec,
  rotationRad: number
): { x: number; y: number; width: number; height: number } {
  // Calculate new dimensions
  const newWidth = bounds.width * Math.abs(scaleX);
  const newHeight = bounds.height * Math.abs(scaleY);
  
  // Calculate new center position using the working demo's approach
  const oldCenter = new Vec(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  
  // Calculate the vector from scale origin to old center in object's local space
  const centerOffset = Vec.sub(oldCenter, scaleOriginWorld).rot(-rotationRad);
  
  // Scale this offset
  const scaledOffset = new Vec(centerOffset.x * scaleX, centerOffset.y * scaleY);
  
  // Rotate back and add to scale origin to get new center
  const newCenter = Vec.add(scaleOriginWorld, scaledOffset.rot(rotationRad));
  
  // Calculate new top-left position
  const newX = newCenter.x - newWidth / 2;
  const newY = newCenter.y - newHeight / 2;
  
  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight
  };
}
