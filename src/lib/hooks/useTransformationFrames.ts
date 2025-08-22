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

        const newLayer = { ...targetObject };

        // Apply resize logic based on handle
        if (handle === "s") {
          newLayer.y = orig.y;
          newLayer.height = Math.abs(currentY - orig.y);
        } else if (handle === "n") {
          const originalBottom = orig.y + orig.height;
          newLayer.y = currentY;
          newLayer.height = Math.abs(originalBottom - currentY);
        } else if (handle === "w") {
          const originalRight = orig.x + orig.width;
          newLayer.width = Math.abs(originalRight - currentX);
          newLayer.x = Math.min(currentX, originalRight);
        } else if (handle === "e") {
          newLayer.x = orig.x;
          newLayer.width = Math.abs(currentX - orig.x);
        } else {
          // Corner handles
          if (handle.includes("n")) {
            newLayer.y = currentY;
            newLayer.height = Math.abs(orig.y + orig.height - currentY);
          } else if (handle.includes("s")) {
            newLayer.y = orig.y;
            newLayer.height = Math.abs(currentY - orig.y);
          }

          if (handle.includes("w")) {
            const originalRight = orig.x + orig.width;
            newLayer.width = Math.abs(originalRight - currentX);
            newLayer.x = Math.min(currentX, originalRight);
          } else if (handle.includes("e")) {
            newLayer.x = orig.x;
            newLayer.width = Math.abs(currentX - orig.x);
          }
        }

        // Maintain aspect ratio when shift is pressed
        if (keyPressed.shift && dragging.originalAspectRatio) {
          const aspectRatio = dragging.originalAspectRatio;
          if (handle.includes("w") || handle.includes("e")) {
            newLayer.height = newLayer.width / aspectRatio;
          } else if (handle.includes("n") || handle.includes("s")) {
            newLayer.width = newLayer.height * aspectRatio;
          }
        }

        // Apply constraints
        newLayer.width = Math.max(config.minWidth, Math.abs(newLayer.width));
        newLayer.height = Math.max(config.minHeight, newLayer.height);

        changes = {
          x: newLayer.x,
          y: newLayer.y,
          width: newLayer.width,
          height: newLayer.height,
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
