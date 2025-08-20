import React, { useState, useCallback, useMemo, useRef } from 'react'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, PolygonLayer } from '@deck.gl/layers'
import type { ViewStateChangeParameters } from '@deck.gl/core'
import './ResizableLayerDemo.css'

export interface LayerObject {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: [number, number, number]
  selected: boolean
  zIndex: number
  rotation: number
}

interface ResizeHandle {
  type: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'
  x: number
  y: number
}

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 0,
  zoom: 8,
  pitch: 0,
  bearing: 0
}

export const ResizableLayerDemo: React.FC = () => {
  const [showDebugZones, setShowDebugZones] = useState<boolean>(true)
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [layers, setLayers] = useState<LayerObject[]>([
    { id: '1', x: -0.5, y: 0.5, width: 1, height: 0.8, color: [255, 100, 100], selected: false, zIndex: 1, rotation: 0 },
    { id: '2', x: 0.8, y: -0.3, width: 0.8, height: 1.2, color: [100, 255, 100], selected: false, zIndex: 2, rotation: 0 },
    { id: '3', x: -0.8, y: -0.8, width: 1.2, height: 0.6, color: [100, 100, 255], selected: false, zIndex: 3, rotation: 0 }
  ])
  const [dragging, setDragging] = useState<{ 
    layerId: string; 
    startX: number; 
    startY: number; 
    type: 'move' | 'resize' | 'rotate'; 
    handle?: string;
    startRotation?: number;
    originalAspectRatio?: number;
  } | null>(null)
  const [keyPressed, setKeyPressed] = useState<{ shift: boolean }>({ shift: false })
  const [hoveredHandle, setHoveredHandle] = useState<{ layerId: string; handleType: string } | null>(null)
  const hoveredHandleRef = useRef<{ layerId: string; handleType: string } | null>(null)
  const [canvasRef, setCanvasRef] = useState<HTMLDivElement | null>(null)

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldPos: [number, number]) => {
    if (!canvasRef) return null
    
    const rect = canvasRef.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Simple linear projection that matches DeckGL at zoom level 8
    const scale = Math.pow(2, viewState.zoom - 8) * 400
    const x = centerX + (worldPos[0] - viewState.longitude) * scale
    const y = centerY - (worldPos[1] - viewState.latitude) * scale
    
    return { x, y }
  }, [canvasRef, viewState])

  // Keyboard event listeners
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setKeyPressed(prev => ({ ...prev, shift: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setKeyPressed(prev => ({ ...prev, shift: false }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Check if a point is inside a rotated rectangle
  const isPointInsideLayer = useCallback((layer: LayerObject, worldX: number, worldY: number) => {
    const centerX = layer.x + layer.width / 2
    const centerY = layer.y + layer.height / 2
    const rad = -(layer.rotation * Math.PI) / 180 // Negative for inverse rotation

    // Rotate the point back to local coordinates
    const dx = worldX - centerX
    const dy = worldY - centerY
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY

    // Check if point is inside the unrotated rectangle
    return localX >= layer.x && 
           localX <= layer.x + layer.width && 
           localY >= layer.y && 
           localY <= layer.y + layer.height
  }, [])

  const getRotatedPolygon = useCallback((layer: LayerObject) => {
    const centerX = layer.x + layer.width / 2
    const centerY = layer.y + layer.height / 2
    const rad = (layer.rotation * Math.PI) / 180

    const corners = [
      [layer.x, layer.y],
      [layer.x + layer.width, layer.y],
      [layer.x + layer.width, layer.y + layer.height],
      [layer.x, layer.y + layer.height]
    ]

    return corners.map(([x, y]) => {
      const dx = x - centerX
      const dy = y - centerY
      const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
      const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY
      return [rotatedX, rotatedY]
    })
  }, [])

  // Detect hover zone based on pixel distance from layer edges
  const getHoverZone = useCallback((layer: LayerObject, worldX: number, worldY: number) => {
    if (!layer.selected) return null

    // Get layer corners in world coordinates
    const corners = getRotatedPolygon(layer)
    const screenCorners = corners.map(([x, y]) => worldToScreen([x, y])).filter(Boolean) as Array<{x: number, y: number}>
    
    if (screenCorners.length !== 4) return null

    // Get mouse position in screen coordinates
    const mouseScreen = worldToScreen([worldX, worldY])
    if (!mouseScreen) return null

    // Check distance to each edge and corner
    const [topLeft, topRight, bottomRight, bottomLeft] = screenCorners
    
    // Helper function to get distance from point to line segment
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
        xx = x1
        yy = y1
      } else if (param > 1) {
        xx = x2
        yy = y2
      } else {
        xx = x1 + param * C
        yy = y1 + param * D
      }

      const dx = px - xx
      const dy = py - yy
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Check distance to each edge
    const edges = [
      { name: 's', x1: topLeft.x, y1: topLeft.y, x2: topRight.x, y2: topRight.y },      // Visual bottom edge
      { name: 'e', x1: topRight.x, y1: topRight.y, x2: bottomRight.x, y2: bottomRight.y }, // Visual right edge  
      { name: 'n', x1: bottomRight.x, y1: bottomRight.y, x2: bottomLeft.x, y2: bottomLeft.y }, // Visual top edge
      { name: 'w', x1: bottomLeft.x, y1: bottomLeft.y, x2: topLeft.x, y2: topLeft.y }     // Visual left edge
    ]

    // Check corners first for corner resize zones (±6px from corners)
    // Flipped mapping to match screen coordinates where Y increases downward
    const corners_screen = [
      { name: 'sw', x: topLeft.x, y: topLeft.y },
      { name: 'se', x: topRight.x, y: topRight.y },
      { name: 'ne', x: bottomRight.x, y: bottomRight.y },
      { name: 'nw', x: bottomLeft.x, y: bottomLeft.y }
    ]

    for (const corner of corners_screen) {
      const dx = mouseScreen.x - corner.x
      const dy = mouseScreen.y - corner.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= 12) {
        return { type: 'resize', handle: corner.name }
      }
    }

    // Check edges for resize zones (±12px)
    for (const edge of edges) {
      const distance = distanceToLineSegment(mouseScreen.x, mouseScreen.y, edge.x1, edge.y1, edge.x2, edge.y2)
      if (distance <= 12) {
        return { type: 'resize', handle: edge.name }
      }
    }

    // Check corners for rotate zones (12-24px from corners, outside resize zone)
    for (const corner of corners_screen) {
      const dx = mouseScreen.x - corner.x
      const dy = mouseScreen.y - corner.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > 12 && distance <= 24) {
        return { type: 'rotate', handle: 'rotate' }
      }
    }

    return null
  }, [getRotatedPolygon, worldToScreen])

  const handleClick = useCallback((info: any) => {
    if (!info.object) {
      // Clicked on empty area, deselect all
      setLayers(prev => prev.map(layer => ({ ...layer, selected: false })))
      return
    }

    const clickedLayer = layers.find(layer => layer.id === info.object.layerId)
    if (!clickedLayer) return

    // Select the layer and bring it to front
    const maxZIndex = Math.max(...layers.map(l => l.zIndex))
    setLayers(prev => prev.map(layer => ({
      ...layer,
      selected: layer.id === clickedLayer.id,
      zIndex: layer.id === clickedLayer.id ? maxZIndex + 1 : layer.zIndex
    })))
  }, [layers])

  const handleDragStart = useCallback((info: any) => {
    if (!info.coordinate) return

    const coordinate = info.coordinate
    const [worldX, worldY] = coordinate
    
    // Always check for hover zones first, regardless of what was clicked
    for (const layer of layers) {
      if (layer.selected) {
        const zone = getHoverZone(layer, worldX, worldY)
        if (zone) {
          if (zone.type === 'resize') {
            setDragging({
              layerId: layer.id,
              startX: coordinate[0],
              startY: coordinate[1],
              type: 'resize',
              handle: zone.handle,
              originalAspectRatio: layer.width / layer.height
            })
            return
          } else if (zone.type === 'rotate') {
            setDragging({
              layerId: layer.id,
              startX: coordinate[0],
              startY: coordinate[1],
              type: 'rotate',
              handle: 'rotate',
              startRotation: layer.rotation
            })
            return
          }
        }
      }
    }
    
    // If no hover zone detected, check for regular layer clicks
    if (info.object) {
      const clickedLayer = layers.find(layer => layer.id === info.object.layerId)
      if (clickedLayer) {
        const isInside = isPointInsideLayer(clickedLayer, worldX, worldY)
        if (isInside) {
          // Inside layer = move
          setDragging({
            layerId: clickedLayer.id,
            startX: coordinate[0],
            startY: coordinate[1],
            type: 'move'
          })
        }
      }
    }
  }, [layers, getHoverZone, isPointInsideLayer])

  const handleDrag = useCallback((info: any) => {
    if (!dragging || !info.coordinate) return

    const [currentX, currentY] = info.coordinate
    const deltaX = currentX - dragging.startX
    const deltaY = currentY - dragging.startY

    setLayers(prev => prev.map(layer => {
      if (layer.id !== dragging.layerId) return layer

      if (dragging.type === 'move') {
        return {
          ...layer,
          x: layer.x + deltaX,
          y: layer.y + deltaY
        }
      } else if (dragging.type === 'rotate') {
        const centerX = layer.x + layer.width / 2
        const centerY = layer.y + layer.height / 2
        
        // Calculate current angle from center to mouse position
        const currentAngle = Math.atan2(currentY - centerY, currentX - centerX)
        const startAngle = Math.atan2(dragging.startY - centerY, dragging.startX - centerX)
        
        // Calculate rotation difference in radians, then convert to degrees
        let angleDiff = currentAngle - startAngle
        
        // Normalize angle difference to prevent jumps
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
        
        // Convert to degrees and add to starting rotation
        const rotationChange = angleDiff * (180 / Math.PI)
        let newRotation = (dragging.startRotation || 0) + rotationChange
        
        // Normalize to 0-360 range
        newRotation = ((newRotation % 360) + 360) % 360
        
        // Snap to 15-degree increments if shift is pressed
        if (keyPressed.shift) {
          newRotation = Math.round(newRotation / 15) * 15
          if (newRotation >= 360) newRotation = 0
        }
        
        return {
          ...layer,
          rotation: newRotation
        }
      } else if (dragging.type === 'resize' && dragging.handle) {
        const newLayer = { ...layer }
        const handle = dragging.handle

        if (handle.includes('w')) {
          newLayer.width -= deltaX
          newLayer.x += deltaX
        }
        if (handle.includes('e')) {
          newLayer.width += deltaX
        }
        if (handle.includes('n')) {
          newLayer.height += deltaY
        }
        if (handle.includes('s')) {
          newLayer.height -= deltaY
          newLayer.y += deltaY
        }

        // Maintain aspect ratio when shift is pressed
        if (keyPressed.shift && dragging.originalAspectRatio) {
          const aspectRatio = dragging.originalAspectRatio
          if (handle.includes('w') || handle.includes('e')) {
            newLayer.height = newLayer.width / aspectRatio
          } else if (handle.includes('n') || handle.includes('s')) {
            newLayer.width = newLayer.height * aspectRatio
          }
          
          // For corner handles, use the larger change
          if (handle.includes('w') && handle.includes('n')) {
            const widthChange = Math.abs(deltaX)
            const heightChange = Math.abs(deltaY)
            if (widthChange > heightChange) {
              newLayer.height = newLayer.width / aspectRatio
            } else {
              newLayer.width = newLayer.height * aspectRatio
            }
          }
          if (handle.includes('e') && handle.includes('n')) {
            const widthChange = Math.abs(deltaX)
            const heightChange = Math.abs(deltaY)
            if (widthChange > heightChange) {
              newLayer.height = newLayer.width / aspectRatio
            } else {
              newLayer.width = newLayer.height * aspectRatio
            }
          }
          if (handle.includes('w') && handle.includes('s')) {
            const widthChange = Math.abs(deltaX)
            const heightChange = Math.abs(deltaY)
            if (widthChange > heightChange) {
              newLayer.height = newLayer.width / aspectRatio
              newLayer.y = layer.y + layer.height - newLayer.height
            } else {
              newLayer.width = newLayer.height * aspectRatio
              newLayer.x = layer.x + layer.width - newLayer.width
            }
          }
          if (handle.includes('e') && handle.includes('s')) {
            const widthChange = Math.abs(deltaX)
            const heightChange = Math.abs(deltaY)
            if (widthChange > heightChange) {
              newLayer.height = newLayer.width / aspectRatio
              newLayer.y = layer.y + layer.height - newLayer.height
            } else {
              newLayer.width = newLayer.height * aspectRatio
            }
          }
        }

        newLayer.width = Math.max(0.1, newLayer.width)
        newLayer.height = Math.max(0.1, newLayer.height)

        return newLayer
      }

      return layer
    }))

    // Don't update startX/startY during drag for rotation - it breaks the calculation!
    if (dragging.type === 'rotate') {
      return // Keep original start coordinates for accurate rotation calculation
    }
    
    setDragging(prev => prev ? { ...prev, startX: currentX, startY: currentY } : null)
  }, [dragging, keyPressed.shift])

  const handleDragEnd = useCallback(() => {
    setDragging(null)
  }, [])

  const handleHover = useCallback((info: any) => {
    let newHoveredHandle = null
    
    if (info.coordinate) {
      const [worldX, worldY] = info.coordinate
      
      // Check all selected layers for hover zones
      for (const layer of layers) {
        if (layer.selected) {
          const zone = getHoverZone(layer, worldX, worldY)
          if (zone) {
            newHoveredHandle = { layerId: layer.id, handleType: zone.handle }
            break
          }
        }
      }
    }
    
    // Only update if different from current
    const current = hoveredHandleRef.current
    const isDifferent = !current && newHoveredHandle 
      || current && !newHoveredHandle
      || (current && newHoveredHandle && (current.layerId !== newHoveredHandle.layerId || current.handleType !== newHoveredHandle.handleType))
    
    if (isDifferent) {
      hoveredHandleRef.current = newHoveredHandle
      setHoveredHandle(newHoveredHandle)
    }
  }, [layers, getHoverZone])

  const handleViewStateChange = useCallback(({ viewState }: ViewStateChangeParameters) => {
    setViewState(viewState)
  }, [])

  const getCursor = useCallback(() => {
    if (dragging) {
      if (dragging.type === 'resize' && dragging.handle) {
        const handle = dragging.handle
        if (handle === 'nw') return 'nw-resize'
        if (handle === 'ne') return 'ne-resize'  
        if (handle === 'se') return 'se-resize'
        if (handle === 'sw') return 'sw-resize'
        if (handle === 'n' || handle === 's') return 'ns-resize'
        if (handle === 'e' || handle === 'w') return 'ew-resize'
      }
      if (dragging.type === 'rotate') return 'grabbing'
      if (dragging.type === 'move') return 'grabbing'
      return 'grab'
    }
    
    // Only show cursor hints when hovering over a selected layer
    if (hoveredHandle && layers.some(layer => layer.selected)) {
      const handle = hoveredHandle.handleType
      if (handle === 'rotate') return 'crosshair'
      if (handle === 'nw') return 'nw-resize'
      if (handle === 'ne') return 'ne-resize'
      if (handle === 'se') return 'se-resize'
      if (handle === 'sw') return 'sw-resize'
      if (handle === 'n' || handle === 's') return 'ns-resize'
      if (handle === 'e' || handle === 'w') return 'ew-resize'
    }
    
    return 'grab'
  }, [dragging, hoveredHandle, layers])

  const polygonData = useMemo(() => {
    return [...layers]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(layer => ({
        polygon: getRotatedPolygon(layer),
        color: layer.color,
        layerId: layer.id
      }))
  }, [layers, getRotatedPolygon])

  // Create resize zone (12px buffer) for selected layers
  const resizeZoneData = useMemo(() => {
    if (!canvasRef || !showDebugZones) return []
    
    const data: any[] = []
    
    layers.forEach(layer => {
      if (layer.selected) {
        // Calculate 12px buffer in world coordinates
        const scale = Math.pow(2, viewState.zoom - 8) * 400
        const bufferWorld = 12 / scale
        
        // Create extended layer dimensions for resize zone
        const extendedLayer = {
          x: layer.x - bufferWorld,
          y: layer.y - bufferWorld,
          width: layer.width + (2 * bufferWorld),
          height: layer.height + (2 * bufferWorld),
          rotation: layer.rotation
        }
        
        // Calculate rotated polygon for extended layer
        const centerX = extendedLayer.x + extendedLayer.width / 2
        const centerY = extendedLayer.y + extendedLayer.height / 2
        const rad = (extendedLayer.rotation * Math.PI) / 180

        const corners = [
          [extendedLayer.x, extendedLayer.y],
          [extendedLayer.x + extendedLayer.width, extendedLayer.y],
          [extendedLayer.x + extendedLayer.width, extendedLayer.y + extendedLayer.height],
          [extendedLayer.x, extendedLayer.y + extendedLayer.height]
        ]

        const rotatedCorners = corners.map(([x, y]) => {
          const dx = x - centerX
          const dy = y - centerY
          const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
          const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY
          return [rotatedX, rotatedY]
        })
        
        data.push({
          polygon: rotatedCorners,
          layerId: layer.id,
          zoneType: 'resize'
        })
      }
    })
    
    return data
  }, [layers, canvasRef, viewState, showDebugZones])

  // Create rotate zone (24px buffer) for selected layers  
  const rotateZoneData = useMemo(() => {
    if (!canvasRef || !showDebugZones) return []
    
    const data: any[] = []
    
    layers.forEach(layer => {
      if (layer.selected) {
        // Calculate 24px buffer in world coordinates for rotate zone
        const scale = Math.pow(2, viewState.zoom - 8) * 400
        const bufferWorld = 24 / scale
        
        // Create extended layer dimensions for rotate zone
        const extendedLayer = {
          x: layer.x - bufferWorld,
          y: layer.y - bufferWorld,
          width: layer.width + (2 * bufferWorld),
          height: layer.height + (2 * bufferWorld),
          rotation: layer.rotation
        }
        
        // Calculate rotated polygon for extended layer
        const centerX = extendedLayer.x + extendedLayer.width / 2
        const centerY = extendedLayer.y + extendedLayer.height / 2
        const rad = (extendedLayer.rotation * Math.PI) / 180

        const corners = [
          [extendedLayer.x, extendedLayer.y],
          [extendedLayer.x + extendedLayer.width, extendedLayer.y],
          [extendedLayer.x + extendedLayer.width, extendedLayer.y + extendedLayer.height],
          [extendedLayer.x, extendedLayer.y + extendedLayer.height]
        ]

        const rotatedCorners = corners.map(([x, y]) => {
          const dx = x - centerX
          const dy = y - centerY
          const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
          const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY
          return [rotatedX, rotatedY]
        })
        
        data.push({
          polygon: rotatedCorners,
          layerId: layer.id,
          zoneType: 'rotate'
        })
      }
    })
    
    return data
  }, [layers, canvasRef, viewState, showDebugZones])

  const borderData = useMemo(() => {
    const data: any[] = []

    layers.forEach(layer => {
      if (layer.selected) {
        // Selection border outline with rotation support
        const borderWidth = 0.005
        const centerX = layer.x + layer.width / 2
        const centerY = layer.y + layer.height / 2
        const rad = (layer.rotation * Math.PI) / 180

        const rotatePoint = (x: number, y: number) => {
          const dx = x - centerX
          const dy = y - centerY
          const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
          const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY
          return [rotatedX, rotatedY]
        }

        const outerBorder = [
          rotatePoint(layer.x - borderWidth, layer.y - borderWidth),
          rotatePoint(layer.x + layer.width + borderWidth, layer.y - borderWidth),
          rotatePoint(layer.x + layer.width + borderWidth, layer.y + layer.height + borderWidth),
          rotatePoint(layer.x - borderWidth, layer.y + layer.height + borderWidth)
        ]
        const innerBorder = getRotatedPolygon(layer)

        data.push({
          polygon: [outerBorder, innerBorder],
          color: [24, 144, 255],
          layerId: layer.id,
          type: 'border'
        })
      }
    })

    return data
  }, [layers, getRotatedPolygon])

  const handleData = useMemo(() => {
    const handles: any[] = []
    
    layers.forEach(layer => {
      if (layer.selected) {
        const corners = getRotatedPolygon(layer)
        const [nw, ne, se, sw] = corners
        
        // Calculate midpoints of edges
        const n = [(nw[0] + ne[0]) / 2, (nw[1] + ne[1]) / 2]
        const e = [(ne[0] + se[0]) / 2, (ne[1] + se[1]) / 2]
        const s = [(sw[0] + se[0]) / 2, (sw[1] + se[1]) / 2]
        const w = [(sw[0] + nw[0]) / 2, (sw[1] + nw[1]) / 2]
        
        const handlePositions = [
          { position: nw, type: 'nw' },
          { position: n, type: 'n' },
          { position: ne, type: 'ne' },
          { position: e, type: 'e' },
          { position: se, type: 'se' },
          { position: s, type: 's' },
          { position: sw, type: 'sw' },
          { position: w, type: 'w' }
        ]
        
        handlePositions.forEach(({ position, type }) => {
          handles.push({
            position,
            handleType: type,
            layerId: layer.id,
            size: 8,
            color: [70, 130, 255] // Blue handles
          })
        })
      }
    })
    
    return handles
  }, [layers, getRotatedPolygon])

  const polygonLayer = new PolygonLayer({
    id: 'layer-polygons',
    data: polygonData,
    getPolygon: (d: any) => d.polygon,
    getFillColor: (d: any) => [...d.color, 180],
    getLineColor: [0, 0, 0, 0],
    pickable: true,
    onClick: handleClick,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd
  })

  const resizeZoneLayer = new PolygonLayer({
    id: 'resize-zones',
    data: resizeZoneData,
    getPolygon: (d: any) => d.polygon,
    getFillColor: [0, 255, 0, 30], // Semi-transparent green for resize zones
    getLineColor: [0, 255, 0, 80], // Green border for resize zones
    getLineWidth: 1,
    pickable: true,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd
  })

  const rotateZoneLayer = new PolygonLayer({
    id: 'rotate-zones',
    data: rotateZoneData,
    getPolygon: (d: any) => d.polygon,
    getFillColor: [0, 0, 255, 20], // Semi-transparent blue for rotate zones
    getLineColor: [0, 0, 255, 60], // Blue border for rotate zones
    getLineWidth: 1,
    pickable: true,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd
  })

  const borderLayer = new PolygonLayer({
    id: 'selection-borders',
    data: borderData,
    getPolygon: (d: any) => d.polygon,
    getFillColor: (d: any) => [...d.color, 255],
    getLineColor: [0, 0, 0, 0],
    pickable: false
  })

  const handleLayer = new ScatterplotLayer({
    id: 'resize-handles',
    data: handleData,
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => d.size,
    getFillColor: (d: any) => d.color,
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 2,
    pickable: false,
    radiusScale: 0.001,
    radiusMinPixels: 4,
    radiusMaxPixels: 8
  })

  return (
    <div className="resizable-layer-demo">
      <div className="canvas-container" ref={setCanvasRef} style={{ position: 'relative' }}>
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={{
            dragPan: !dragging,
            dragRotate: false,
            scrollZoom: true,
            touchZoom: true,
            touchRotate: false,
            keyboard: false
          }}
          layers={[
            polygonLayer, 
            ...(showDebugZones ? [rotateZoneLayer, resizeZoneLayer] : []), 
            borderLayer, 
            handleLayer
          ]}
          onViewStateChange={handleViewStateChange}
          onHover={handleHover}
          getCursor={getCursor}
        />
        {dragging?.type === 'rotate' && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none',
              zIndex: 20
            }}
          >
            {Math.round(layers.find(l => l.id === dragging.layerId)?.rotation || 0)}° 
            {keyPressed.shift && ' (snapped)'}
          </div>
        )}
      </div>
      <div className="controls">
        <h3>Layers</h3>
        <div style={{ marginBottom: '15px' }}>
          <button 
            onClick={() => setShowDebugZones(!showDebugZones)}
            style={{
              padding: '8px 12px',
              backgroundColor: showDebugZones ? '#4CAF50' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginBottom: '10px'
            }}
          >
            Debug Zones: {showDebugZones ? 'ON' : 'OFF'}
          </button>
        </div>
        <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
          <div>• Click layers to select</div>
          <div>• Drag inside: move</div>
          <div>• Hover ±12px from edges: resize</div>
          <div>• Hover 12-24px from corners: rotate</div>
          <div>• Hold Shift: keep ratio/15° snap</div>
          {showDebugZones && (
            <>
              <div style={{ color: '#0f0', fontStyle: 'italic' }}>• Green zones = 12px resize areas</div>
              <div style={{ color: '#00f', fontStyle: 'italic' }}>• Blue zones = 12-24px rotate areas</div>
            </>
          )}
        </div>
        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map(layer => (
          <div
            key={layer.id}
            className={`layer-item ${layer.selected ? 'selected' : ''}`}
            onClick={() => {
              const maxZIndex = Math.max(...layers.map(l => l.zIndex))
              setLayers(prev => prev.map(l => ({ 
                ...l, 
                selected: l.id === layer.id,
                zIndex: l.id === layer.id ? maxZIndex + 1 : l.zIndex
              })))
            }}
            style={{ backgroundColor: `rgb(${layer.color.join(',')})` }}
          >
            <div className="layer-info">
              <span>Layer {layer.id}</span>
              <span className="z-index">z: {layer.zIndex} | {Math.round(layer.rotation)}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}