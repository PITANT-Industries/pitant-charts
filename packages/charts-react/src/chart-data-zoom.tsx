'use client'

import type { ChartLayout } from '@pitant/charts'
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useState,
} from 'react'

export interface ChartDataZoomProps {
  layout: ChartLayout
  fullRange: readonly [number, number]
  visibleRange: readonly [number, number]
  onRangeChange: (range: readonly [number, number]) => void
  timestamps: Float64Array
  values?: Float64Array | undefined
  color?: string | undefined
  enabled?: boolean
  maxSampleCount?: number
}

type DataZoomDragMode = 'pan' | 'resize-start' | 'resize-end'

interface DataZoomDragState {
  pointerId: number
  mode: DataZoomDragMode
  startRatio: number
  startRange: readonly [number, number]
}

const DEFAULT_SAMPLE_COUNT = 180
const HANDLE_HIT_PX = 8
const MIN_WINDOW_RATIO = 1e-6

const shellStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'auto',
  touchAction: 'none',
  zIndex: 2,
}

const trackStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  border: '1px solid var(--chart-datazoom-border, rgba(100, 116, 139, 0.38))',
  background: 'var(--chart-datazoom-background, rgba(248, 250, 252, 0.9))',
}

const windowStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  borderLeft: '2px solid var(--chart-datazoom-window-border, rgba(37, 99, 235, 0.95))',
  borderRight: '2px solid var(--chart-datazoom-window-border, rgba(37, 99, 235, 0.95))',
  background: 'var(--chart-datazoom-window, rgba(37, 99, 235, 0.16))',
  cursor: 'grab',
}

const handleStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 8,
  background: 'var(--chart-datazoom-handle, rgba(37, 99, 235, 0.82))',
}

export function ChartDataZoom({
  color = 'var(--chart-1, #2563eb)',
  enabled = true,
  fullRange,
  layout,
  maxSampleCount = DEFAULT_SAMPLE_COUNT,
  onRangeChange,
  timestamps,
  values,
  visibleRange,
}: ChartDataZoomProps): React.JSX.Element | null {
  const area = useMemo(() => getDataZoomArea(layout), [layout])
  const [drag, setDrag] = useState<DataZoomDragState | null>(null)
  const fullSpan = fullRange[1] - fullRange[0]

  const currentRange = useMemo(
    () => clampVisibleRange(visibleRange, fullRange),
    [fullRange, visibleRange],
  )

  const path = useMemo(
    () => buildMinimapPath(timestamps, values, area.width, area.height, maxSampleCount),
    [area.height, area.width, maxSampleCount, timestamps, values],
  )

  const windowPosition = useMemo(() => {
    if (fullSpan <= Number.EPSILON) return { left: 0, width: area.width }

    const startRatio = clamp((currentRange[0] - fullRange[0]) / fullSpan, 0, 1)
    const endRatio = clamp((currentRange[1] - fullRange[0]) / fullSpan, 0, 1)
    const left = startRatio * area.width
    const width = Math.max(4, (endRatio - startRatio) * area.width)
    return { left, width }
  }, [area.width, currentRange, fullRange, fullSpan])

  const publishRange = useCallback(
    (range: readonly [number, number]) => {
      const nextRange = clampVisibleRange(range, fullRange)
      if (!rangesEqual(nextRange, currentRange)) {
        onRangeChange(nextRange)
      }
    },
    [currentRange, fullRange, onRangeChange],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || fullSpan <= Number.EPSILON) return

      const ratio = ratioFromPointer(event)
      const mode = resolveDragMode(ratio, currentRange, fullRange, area.width)
      const startRange =
        mode === 'pan' && !ratioInRange(ratio, currentRange, fullRange)
          ? centerRangeAtRatio(currentRange, fullRange, ratio)
          : currentRange

      if (!rangesEqual(startRange, currentRange)) {
        onRangeChange(startRange)
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
      setDrag({
        pointerId: event.pointerId,
        mode,
        startRatio: ratio,
        startRange,
      })
    },
    [area.width, currentRange, enabled, fullRange, fullSpan, onRangeChange],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !drag || event.pointerId !== drag.pointerId || fullSpan <= Number.EPSILON) {
        return
      }

      event.preventDefault()
      const ratio = ratioFromPointer(event)
      const value = fullRange[0] + ratio * fullSpan
      const minSpan = Math.max(Number.EPSILON, fullSpan * MIN_WINDOW_RATIO)

      if (drag.mode === 'resize-start') {
        publishRange([clamp(value, fullRange[0], drag.startRange[1] - minSpan), drag.startRange[1]])
        return
      }
      if (drag.mode === 'resize-end') {
        publishRange([drag.startRange[0], clamp(value, drag.startRange[0] + minSpan, fullRange[1])])
        return
      }

      const delta = (ratio - drag.startRatio) * fullSpan
      publishRange([drag.startRange[0] + delta, drag.startRange[1] + delta])
    },
    [drag, enabled, fullRange, fullSpan, publishRange],
  )

  const clearDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setDrag(null)
  }, [])

  if (!enabled || fullSpan <= Number.EPSILON || area.width < 24 || area.height < 12) return null

  return (
    <div
      aria-label="Chart DataZoom range"
      aria-valuemax={fullRange[1]}
      aria-valuemin={fullRange[0]}
      aria-valuenow={(currentRange[0] + currentRange[1]) / 2}
      aria-valuetext={`${currentRange[0]} to ${currentRange[1]}`}
      className="pitant-chart-datazoom"
      data-testid="chart-data-zoom"
      onPointerCancel={clearDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearDrag}
      role="slider"
      style={{
        ...shellStyle,
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
      }}
      tabIndex={0}
    >
      <div aria-hidden className="pitant-chart-datazoom-track" style={trackStyle}>
        <svg
          aria-hidden
          focusable={false}
          height="100%"
          preserveAspectRatio="none"
          viewBox={`0 0 ${area.width} ${area.height}`}
          width="100%"
        >
          <title>DataZoom overview</title>
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.72}
              strokeWidth={1.25}
            />
          ) : (
            <line
              stroke={color}
              strokeOpacity={0.5}
              strokeWidth={1}
              x1={0}
              x2={area.width}
              y1={area.height / 2}
              y2={area.height / 2}
            />
          )}
        </svg>
        <div
          className="pitant-chart-datazoom-window"
          data-testid="chart-data-zoom-window"
          style={{
            ...windowStyle,
            left: windowPosition.left,
            width: windowPosition.width,
          }}
        >
          <span
            aria-hidden
            className="pitant-chart-datazoom-handle-start"
            data-testid="chart-data-zoom-handle-start"
            style={{ ...handleStyle, left: -4, cursor: 'ew-resize' }}
          />
          <span
            aria-hidden
            className="pitant-chart-datazoom-handle-end"
            data-testid="chart-data-zoom-handle-end"
            style={{ ...handleStyle, right: -4, cursor: 'ew-resize' }}
          />
        </div>
      </div>
    </div>
  )
}

function getDataZoomArea(layout: ChartLayout): {
  x: number
  y: number
  width: number
  height: number
} {
  const axis = layout.xAxisArea
  const height = axis ? Math.max(12, Math.min(22, axis.height - 8)) : 16
  const y = axis
    ? axis.y + Math.max(4, axis.height - height - 4)
    : layout.plotArea.y + layout.plotArea.height - height - 4

  return {
    x: layout.plotArea.x,
    y,
    width: layout.plotArea.width,
    height,
  }
}

function buildMinimapPath(
  timestamps: Float64Array,
  values: Float64Array | undefined,
  width: number,
  height: number,
  maxSampleCount: number,
): string {
  const pointCount = Math.min(timestamps.length, values?.length ?? 0)
  if (!values || pointCount < 2 || width <= 0 || height <= 0) return ''

  const step = Math.max(1, Math.floor(pointCount / Math.max(2, maxSampleCount)))
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let index = 0; index < pointCount; index += step) {
    const value = values[index]
    if (value === undefined || !Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return ''
  const ySpan = Math.max(Number.EPSILON, max - min)
  const xDenominator = Math.max(1, pointCount - 1)
  let path = ''

  for (let index = 0; index < pointCount; index += step) {
    const value = values[index]
    if (value === undefined || !Number.isFinite(value)) continue

    const x = (index / xDenominator) * width
    const y = height - ((value - min) / ySpan) * height
    path += `${path ? ' L' : 'M'}${roundPathNumber(x)} ${roundPathNumber(y)}`
  }

  const lastIndex = pointCount - 1
  if (lastIndex % step !== 0) {
    const value = values[lastIndex]
    if (value !== undefined && Number.isFinite(value)) {
      const y = height - ((value - min) / ySpan) * height
      path += ` L${roundPathNumber(width)} ${roundPathNumber(y)}`
    }
  }

  return path
}

function ratioFromPointer(event: ReactPointerEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  return clamp((event.clientX - rect.left) / Math.max(Number.EPSILON, rect.width), 0, 1)
}

function resolveDragMode(
  ratio: number,
  range: readonly [number, number],
  fullRange: readonly [number, number],
  width: number,
): DataZoomDragMode {
  const fullSpan = fullRange[1] - fullRange[0]
  const startRatio = (range[0] - fullRange[0]) / fullSpan
  const endRatio = (range[1] - fullRange[0]) / fullSpan
  const handleRatio = HANDLE_HIT_PX / Math.max(1, width)

  if (Math.abs(ratio - startRatio) <= handleRatio) return 'resize-start'
  if (Math.abs(ratio - endRatio) <= handleRatio) return 'resize-end'
  return 'pan'
}

function ratioInRange(
  ratio: number,
  range: readonly [number, number],
  fullRange: readonly [number, number],
): boolean {
  const fullSpan = fullRange[1] - fullRange[0]
  const startRatio = (range[0] - fullRange[0]) / fullSpan
  const endRatio = (range[1] - fullRange[0]) / fullSpan
  return ratio >= startRatio && ratio <= endRatio
}

function centerRangeAtRatio(
  range: readonly [number, number],
  fullRange: readonly [number, number],
  ratio: number,
): readonly [number, number] {
  const span = range[1] - range[0]
  const fullSpan = fullRange[1] - fullRange[0]
  const center = fullRange[0] + ratio * fullSpan
  return clampVisibleRange([center - span / 2, center + span / 2], fullRange)
}

function clampVisibleRange(
  range: readonly [number, number],
  fullRange: readonly [number, number],
): readonly [number, number] {
  const fullSpan = fullRange[1] - fullRange[0]
  if (fullSpan <= Number.EPSILON) return fullRange

  const start = Number.isFinite(range[0]) ? range[0] : fullRange[0]
  const end = Number.isFinite(range[1]) ? range[1] : fullRange[1]
  const normalized: readonly [number, number] = start <= end ? [start, end] : [end, start]
  const span = Math.min(Math.max(Number.EPSILON, normalized[1] - normalized[0]), fullSpan)

  if (span >= fullSpan) return fullRange
  if (normalized[0] < fullRange[0]) return [fullRange[0], fullRange[0] + span]
  if (normalized[1] > fullRange[1]) return [fullRange[1] - span, fullRange[1]]
  return normalized
}

function rangesEqual(left: readonly [number, number], right: readonly [number, number]): boolean {
  return (
    Math.abs(left[0] - right[0]) <= Number.EPSILON && Math.abs(left[1] - right[1]) <= Number.EPSILON
  )
}

function roundPathNumber(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
