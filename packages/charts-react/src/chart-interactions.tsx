'use client'

import {
  type ChartLayout,
  type ChartPointerCoordinates,
  clampRangeToBounds,
  mapPointerToChartCoordinates,
  type NumericRange,
  panRangeByPixels,
  panRangeByValue,
  rangesEqual,
  zoomRangeAroundAnchor,
  zoomRangeAroundCenter,
} from '@pitant/charts'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChartContainerRef } from './chart-container.js'

export interface ChartRegionZoomLayerProps {
  containerRef: RefObject<ChartContainerRef | null>
  layout: ChartLayout
  xRange: NumericRange
  yRange: NumericRange
  xOrigin?: number
  fullRange: readonly [number, number]
  onRangeChange: (range: readonly [number, number]) => void
  onHoverChange?: (coordinates: ChartPointerCoordinates | null) => void
  enabled?: boolean
  crosshair?: boolean
  keyboardNavigation?: boolean
  pan?: boolean
  syncedCursorX?: number | null
  touchNavigation?: boolean
  wheelZoom?: boolean
}

type DragMode = 'region-zoom' | 'pan'

interface DragState {
  pointerId: number
  startX: number
  currentX: number
  mode: DragMode
  startedInsidePlot: boolean
  startRange: readonly [number, number]
}

interface TouchPoint {
  plotX: number
  plotY: number
}

interface TouchGesture {
  mode: 'touch-pan' | 'touch-pinch'
  startCenterX: number
  startDistance: number
  startRange: readonly [number, number]
  anchorRatio: number
}

const MIN_DRAG_PX = 6
const KEYBOARD_PAN_RATIO = 0.1
const KEYBOARD_LARGE_PAN_RATIO = 0.5
const KEYBOARD_ZOOM_IN_FACTOR = 0.8
const KEYBOARD_ZOOM_OUT_FACTOR = 1.25
const WHEEL_ZOOM_INTENSITY = 0.002
const WHEEL_LINE_HEIGHT = 16
const WHEEL_PAGE_HEIGHT = 320

const interactionStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'auto',
  touchAction: 'none',
  cursor: 'crosshair',
}

const selectionStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  borderLeft: '1px solid var(--chart-selection-border, rgba(37, 99, 235, 0.75))',
  borderRight: '1px solid var(--chart-selection-border, rgba(37, 99, 235, 0.75))',
  background: 'var(--chart-selection-background, rgba(37, 99, 235, 0.14))',
  pointerEvents: 'none',
}

const crosshairLineStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  background: 'var(--chart-crosshair, rgba(15, 23, 42, 0.62))',
}

export function ChartRegionZoomLayer({
  containerRef,
  crosshair = true,
  enabled = true,
  fullRange,
  keyboardNavigation = true,
  layout,
  onHoverChange,
  onRangeChange,
  pan = true,
  syncedCursorX = null,
  touchNavigation = true,
  wheelZoom = true,
  xOrigin = 0,
  xRange,
  yRange,
}: ChartRegionZoomLayerProps): React.JSX.Element | null {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hover, setHover] = useState<ChartPointerCoordinates | null>(null)
  const touchPointsRef = useRef<Map<number, TouchPoint>>(new Map())
  const touchGestureRef = useRef<TouchGesture | null>(null)

  const getCoordinates = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = containerRef.current?.canvas?.getBoundingClientRect()
      if (!rect) return null

      return mapPointerToChartCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
        viewport: rect,
        layout,
        xRange,
        yRange,
        xValueOffset: xOrigin,
        clampToPlot: true,
      })
    },
    [containerRef, layout, xOrigin, xRange, yRange],
  )

  const selection = useMemo(() => {
    if (!drag?.startedInsidePlot || drag.mode !== 'region-zoom') return null

    const left = Math.min(drag.startX, drag.currentX)
    const width = Math.abs(drag.currentX - drag.startX)
    return {
      left: layout.plotArea.x + left,
      width,
    }
  }, [drag, layout.plotArea.x])

  const crosshairPosition = useMemo(() => {
    if (!crosshair) return null
    if (hover?.insidePlot) {
      return {
        horizontal: true,
        x: layout.plotArea.x + hover.plotX,
        y: layout.plotArea.y + hover.plotY,
      }
    }
    if (syncedCursorX !== null) {
      return {
        horizontal: false,
        x: syncedCursorX,
        y: layout.plotArea.y,
      }
    }
    return null
  }, [crosshair, hover, layout.plotArea.x, layout.plotArea.y, syncedCursorX])

  const updateHover = useCallback(
    (coordinates: ChartPointerCoordinates | null) => {
      const next = coordinates?.insidePlot ? coordinates : null
      setHover(next)
      onHoverChange?.(next)
    },
    [onHoverChange],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return

      const coordinates = getCoordinates(event)
      if (touchNavigation && event.pointerType === 'touch') {
        if (!coordinates?.insidePlot) {
          updateHover(null)
          return
        }

        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDrag(null)
        updateHover(null)
        touchPointsRef.current.set(event.pointerId, {
          plotX: coordinates.plotX,
          plotY: coordinates.plotY,
        })

        const currentRange: readonly [number, number] = [xOrigin + xRange[0], xOrigin + xRange[1]]
        touchGestureRef.current = buildTouchGesture(
          touchPointsRef.current,
          currentRange,
          layout.plotArea.width,
        )
        return
      }

      if (!coordinates?.insidePlot) return
      updateHover(coordinates)

      const mode: DragMode = pan && event.altKey ? 'pan' : 'region-zoom'
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setDrag({
        pointerId: event.pointerId,
        startX: coordinates.plotX,
        currentX: coordinates.plotX,
        mode,
        startedInsidePlot: true,
        startRange: [xOrigin + xRange[0], xOrigin + xRange[1]],
      })
    },
    [
      enabled,
      getCoordinates,
      layout.plotArea.width,
      pan,
      touchNavigation,
      updateHover,
      xOrigin,
      xRange,
    ],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return

      const coordinates = getCoordinates(event)
      if (touchNavigation && event.pointerType === 'touch') {
        if (!coordinates || !touchPointsRef.current.has(event.pointerId)) return

        event.preventDefault()
        updateHover(null)
        touchPointsRef.current.set(event.pointerId, {
          plotX: coordinates.plotX,
          plotY: coordinates.plotY,
        })

        const currentRange: readonly [number, number] = [xOrigin + xRange[0], xOrigin + xRange[1]]
        const gesture =
          touchGestureRef.current ??
          buildTouchGesture(touchPointsRef.current, currentRange, layout.plotArea.width)
        if (!gesture) return

        const nextRange = rangeFromTouchGesture(
          touchPointsRef.current,
          gesture,
          layout.plotArea.width,
          fullRange,
        )
        if (nextRange && !rangesEqual(nextRange, currentRange)) {
          onRangeChange(nextRange)
        }
        return
      }

      updateHover(coordinates)
      if (!coordinates || !drag || event.pointerId !== drag.pointerId) return

      if (drag.mode === 'pan') {
        event.preventDefault()
        const nextRange = panRangeByPixels({
          range: drag.startRange,
          deltaPixels: drag.startX - coordinates.plotX,
          plotWidth: layout.plotArea.width,
          bounds: fullRange,
        })
        if (!rangesEqual(nextRange, [xOrigin + xRange[0], xOrigin + xRange[1]])) {
          onRangeChange(nextRange)
        }
        return
      }

      setDrag((current) => {
        if (!current || event.pointerId !== current.pointerId) return current
        return { ...current, currentX: coordinates.plotX }
      })
    },
    [
      drag,
      enabled,
      fullRange,
      getCoordinates,
      layout.plotArea.width,
      onRangeChange,
      touchNavigation,
      updateHover,
      xOrigin,
      xRange,
    ],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        touchPointsRef.current.clear()
        touchGestureRef.current = null
        setDrag(null)
        updateHover(null)
        return
      }

      if (!enabled || !drag || event.pointerId !== drag.pointerId) return

      const coordinates = getCoordinates(event)
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      setDrag(null)
      updateHover(coordinates)
      if (!coordinates || !drag.startedInsidePlot) return
      if (drag.mode === 'pan') return

      const dragWidth = Math.abs(coordinates.plotX - drag.startX)
      if (dragWidth < MIN_DRAG_PX) return

      const startRatio = drag.startX / Math.max(Number.EPSILON, layout.plotArea.width)
      const startX = xOrigin + xRange[0] + (xRange[1] - xRange[0]) * startRatio
      const endX = coordinates.dataX
      const nextRange: readonly [number, number] = startX <= endX ? [startX, endX] : [endX, startX]

      if (nextRange[1] - nextRange[0] > Number.EPSILON) {
        onRangeChange(nextRange)
      }
    },
    [
      drag,
      enabled,
      getCoordinates,
      layout.plotArea.width,
      onRangeChange,
      updateHover,
      xOrigin,
      xRange,
    ],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        touchPointsRef.current.clear()
        touchGestureRef.current = null
        setDrag(null)
        updateHover(null)
        return
      }

      if (drag?.pointerId === event.pointerId) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        setDrag(null)
        updateHover(null)
      }
    },
    [drag, updateHover],
  )

  const handlePointerLeave = useCallback(() => {
    updateHover(null)
  }, [updateHover])

  const handleDoubleClick = useCallback(() => {
    if (!enabled || fullRange[0] >= fullRange[1]) return
    onRangeChange(fullRange)
  }, [enabled, fullRange, onRangeChange])

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      if (!enabled || !wheelZoom || fullRange[0] >= fullRange[1]) return

      const coordinates = getCoordinates(event)
      if (!coordinates) return

      const overXAxis = layout.xAxisArea
        ? rectContainsPoint(layout.xAxisArea, coordinates.chartX, coordinates.chartY)
        : false
      if (!coordinates.insidePlot && !overXAxis) return

      const panDelta = pan ? normalizeWheelPanDelta(event) : 0
      if (Math.abs(panDelta) >= Number.EPSILON) {
        event.preventDefault()
        const nextRange = panRangeByPixels({
          range: [xOrigin + xRange[0], xOrigin + xRange[1]],
          deltaPixels: panDelta,
          plotWidth: layout.plotArea.width,
          bounds: fullRange,
        })
        if (!rangesEqual(nextRange, [xOrigin + xRange[0], xOrigin + xRange[1]])) {
          onRangeChange(nextRange)
        }
        return
      }

      const delta = normalizeWheelDelta(event)
      if (Math.abs(delta) < Number.EPSILON) return

      event.preventDefault()

      const fullStart = fullRange[0]
      const fullEnd = fullRange[1]
      const currentStart = xOrigin + xRange[0]
      const currentEnd = xOrigin + xRange[1]
      const currentSpan = currentEnd - currentStart
      const fullSpan = fullEnd - fullStart
      if (currentSpan <= Number.EPSILON || fullSpan <= Number.EPSILON) return

      const zoomFactor = clamp(Math.exp(delta * WHEEL_ZOOM_INTENSITY), 0.1, 10)
      const nextRange = zoomRangeAroundAnchor({
        range: [currentStart, currentEnd],
        anchor: coordinates.dataX,
        factor: zoomFactor,
        bounds: fullRange,
      })

      if (
        Math.abs(nextRange[0] - currentStart) > Number.EPSILON ||
        Math.abs(nextRange[1] - currentEnd) > Number.EPSILON
      ) {
        onRangeChange(nextRange)
      }
    },
    [
      enabled,
      fullRange,
      getCoordinates,
      layout.plotArea.width,
      layout.xAxisArea,
      onRangeChange,
      pan,
      wheelZoom,
      xOrigin,
      xRange,
    ],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!enabled || !keyboardNavigation || fullRange[0] >= fullRange[1]) return
      if (isEditableTarget(event.target)) return

      const currentRange: readonly [number, number] = [xOrigin + xRange[0], xOrigin + xRange[1]]
      const span = currentRange[1] - currentRange[0]
      if (span <= Number.EPSILON) return

      let nextRange: readonly [number, number] | null = null
      const smallPan = span * KEYBOARD_PAN_RATIO
      const largePan = span * KEYBOARD_LARGE_PAN_RATIO

      switch (event.key) {
        case 'ArrowLeft':
          nextRange = panRangeByValue(
            currentRange,
            event.shiftKey ? -largePan : -smallPan,
            fullRange,
          )
          break
        case 'ArrowRight':
          nextRange = panRangeByValue(currentRange, event.shiftKey ? largePan : smallPan, fullRange)
          break
        case 'PageUp':
          nextRange = panRangeByValue(currentRange, -largePan, fullRange)
          break
        case 'PageDown':
          nextRange = panRangeByValue(currentRange, largePan, fullRange)
          break
        case 'Home':
          nextRange = clampRangeToBounds([fullRange[0], fullRange[0] + span], fullRange)
          break
        case 'End':
          nextRange = clampRangeToBounds([fullRange[1] - span, fullRange[1]], fullRange)
          break
        case 'ArrowUp':
        case '+':
        case '=':
          nextRange = zoomRangeAroundCenter(currentRange, KEYBOARD_ZOOM_IN_FACTOR, fullRange)
          break
        case 'ArrowDown':
        case '-':
        case '_':
          nextRange = zoomRangeAroundCenter(currentRange, KEYBOARD_ZOOM_OUT_FACTOR, fullRange)
          break
        case '0':
        case 'Escape':
          nextRange = fullRange
          break
        default:
          return
      }

      event.preventDefault()
      if (nextRange && !rangesEqual(nextRange, currentRange)) {
        onRangeChange(nextRange)
      }
    },
    [enabled, fullRange, keyboardNavigation, onRangeChange, xOrigin, xRange],
  )

  if (!enabled) return null

  return (
    <div
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End + - 0 Escape"
      aria-label="Chart range navigation"
      className="pitant-chart-interaction-region"
      data-testid="chart-region-zoom-layer"
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      role="application"
      style={interactionStyle}
      tabIndex={keyboardNavigation ? 0 : -1}
    >
      {crosshairPosition ? (
        <>
          <div
            className="pitant-chart-crosshair-x"
            data-testid="chart-crosshair-vertical"
            style={{
              ...crosshairLineStyle,
              left: crosshairPosition.x,
              top: layout.plotArea.y,
              width: 'var(--chart-crosshair-width, 1px)',
              height: layout.plotArea.height,
            }}
          />
          {crosshairPosition.horizontal ? (
            <div
              className="pitant-chart-crosshair-y"
              data-testid="chart-crosshair-horizontal"
              style={{
                ...crosshairLineStyle,
                left: layout.plotArea.x,
                top: crosshairPosition.y,
                width: layout.plotArea.width,
                height: 'var(--chart-crosshair-width, 1px)',
              }}
            />
          ) : null}
        </>
      ) : null}
      {selection ? (
        <div
          className="pitant-chart-selection"
          data-testid="chart-region-zoom-selection"
          style={{
            ...selectionStyle,
            left: selection.left,
            width: selection.width,
          }}
        />
      ) : null}
    </div>
  )
}

function normalizeWheelDelta(event: ReactWheelEvent<HTMLElement>): number {
  if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE_HEIGHT
  if (event.deltaMode === 2) return event.deltaY * WHEEL_PAGE_HEIGHT
  return event.deltaY
}

function normalizeWheelPanDelta(event: ReactWheelEvent<HTMLElement>): number {
  const xDelta = normalizeWheelAxisDelta(event.deltaX, event.deltaMode)
  if (Math.abs(xDelta) >= Number.EPSILON) return xDelta
  if (!event.shiftKey) return 0

  return normalizeWheelAxisDelta(event.deltaY, event.deltaMode)
}

function normalizeWheelAxisDelta(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_HEIGHT
  if (deltaMode === 2) return delta * WHEEL_PAGE_HEIGHT
  return delta
}

function rectContainsPoint(
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height
}

function buildTouchGesture(
  points: Map<number, TouchPoint>,
  currentRange: readonly [number, number],
  plotWidth: number,
): TouchGesture | null {
  const [first, second] = firstTwoTouchPoints(points)
  if (!first) return null

  if (second) {
    const centerX = (first.plotX + second.plotX) / 2
    return {
      mode: 'touch-pinch',
      startCenterX: centerX,
      startDistance: touchDistance(first, second),
      startRange: currentRange,
      anchorRatio: clamp(centerX / Math.max(Number.EPSILON, plotWidth), 0, 1),
    }
  }

  return {
    mode: 'touch-pan',
    startCenterX: first.plotX,
    startDistance: 0,
    startRange: currentRange,
    anchorRatio: clamp(first.plotX / Math.max(Number.EPSILON, plotWidth), 0, 1),
  }
}

function rangeFromTouchGesture(
  points: Map<number, TouchPoint>,
  gesture: TouchGesture,
  plotWidth: number,
  bounds: readonly [number, number],
): readonly [number, number] | null {
  const [first, second] = firstTwoTouchPoints(points)
  if (!first) return null

  if (gesture.mode === 'touch-pinch' && second && gesture.startDistance > Number.EPSILON) {
    const distance = touchDistance(first, second)
    if (distance <= Number.EPSILON) return null

    const startSpan = gesture.startRange[1] - gesture.startRange[0]
    const boundsSpan = bounds[1] - bounds[0]
    if (startSpan <= Number.EPSILON || boundsSpan <= Number.EPSILON) return null

    const nextSpan = clamp(
      startSpan * (gesture.startDistance / distance),
      Math.max(Number.EPSILON, boundsSpan * 1e-9),
      boundsSpan,
    )
    const centerX = (first.plotX + second.plotX) / 2
    const centerDelta =
      ((gesture.startCenterX - centerX) / Math.max(Number.EPSILON, plotWidth)) * startSpan
    const anchor = gesture.startRange[0] + startSpan * gesture.anchorRatio + centerDelta

    return clampRangeToBounds(
      [anchor - nextSpan * gesture.anchorRatio, anchor + nextSpan * (1 - gesture.anchorRatio)],
      bounds,
    )
  }

  return panRangeByPixels({
    range: gesture.startRange,
    deltaPixels: gesture.startCenterX - first.plotX,
    plotWidth,
    bounds,
  })
}

function firstTwoTouchPoints(
  points: Map<number, TouchPoint>,
): [TouchPoint | null, TouchPoint | null] {
  let first: TouchPoint | null = null
  let second: TouchPoint | null = null

  for (const point of points.values()) {
    if (!first) {
      first = point
      continue
    }
    second = point
    break
  }

  return [first, second]
}

function touchDistance(first: TouchPoint, second: TouchPoint): number {
  return Math.hypot(second.plotX - first.plotX, second.plotY - first.plotY)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.getAttribute('role') === 'textbox'
  )
}
