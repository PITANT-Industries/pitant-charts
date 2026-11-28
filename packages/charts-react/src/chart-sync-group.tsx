'use client'

import { type ChartLayout, mapDataPointToChartPoint, type NumericRange } from '@pitant/charts'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type SyncMode = 'cursor' | 'xRange' | 'yRange' | 'zoom' | 'series' | 'focus'
export type ChartSyncCursorMode = 'value' | 'relative' | 'none'

export interface ChartSyncCursorOptions {
  /** Defaults to the timestamp value. */
  x?: ChartSyncCursorMode
  /** Off by default so charts in different units share no Y position. */
  y?: ChartSyncCursorMode
}

export interface ChartSyncCursorPosition {
  /** Progress from the lower to the upper X domain bound, following the X scale. */
  xRatio: number
  /** Progress from the upper to the lower Y domain bound, following the Y scale. */
  yRatio: number
  y: number
}

export interface ChartSyncSeriesVisibilityEvent {
  type: 'series'
  source: string
  key: string
  visible: boolean
}

export type ChartSyncEvent =
  | ChartSyncSeriesVisibilityEvent
  | { type: 'focus'; source: string; key: string | null }
  | {
      type: 'cursor'
      source: string
      timestamp: number | null
      position: ChartSyncCursorPosition | null
    }
  | { type: 'xRange' | 'yRange'; source: string; range: NumericRange | null }

export interface ChartSyncFilters {
  publish?: (event: ChartSyncEvent) => boolean
  receive?: (event: ChartSyncEvent, chartKey: string) => boolean
}

export interface SyncState {
  /** Cursor position in data-space (timestamp). */
  cursorTimestamp: number | null
  /** Visible X-axis range in data-space. */
  xRange: [number, number] | null
  /** Source of the latest accepted group event. */
  source: string | null
  cursorPosition?: ChartSyncCursorPosition | null
  yRange?: NumericRange | null
  seriesVisibility?: Readonly<Record<string, ChartSyncSeriesVisibilityEvent>>
  focusedSeriesKey?: string | null
}

export interface ChartSyncGroupProps {
  /** Which behaviours to synchronize. @default ["cursor","xRange"] */
  sync?: readonly SyncMode[]
  cursor?: ChartSyncCursorOptions
  filters?: ChartSyncFilters
  /** Convert a source series key to a key in the receiving chart. */
  mapSeriesKey?: (key: string, source: string, target: string) => string | null
  children: ReactNode
  className?: string
}

interface SyncSnapshot {
  state: SyncState
  events: Partial<Record<ChartSyncEvent['type'], ChartSyncEvent>>
}

interface SyncContextValue extends SyncSnapshot {
  dispatch: (event: ChartSyncEvent) => void
  cursor: ChartSyncCursorOptions
  receive?: ChartSyncFilters['receive']
  mapSeriesKey?: ChartSyncGroupProps['mapSeriesKey']
  syncSeries: boolean
}

const SyncContext = createContext<SyncContextValue | null>(null)
const DEFAULT_CURSOR_OPTIONS: ChartSyncCursorOptions = { x: 'value', y: 'none' }
const DEFAULT_MODES: readonly SyncMode[] = ['cursor', 'xRange']
const DEFAULT_STATE: SyncState = { cursorTimestamp: null, xRange: null, source: null }
const DEFAULT_SNAPSHOT: SyncSnapshot = { state: DEFAULT_STATE, events: {} }

export function ChartSyncGroup({
  sync = DEFAULT_MODES,
  cursor = DEFAULT_CURSOR_OPTIONS,
  filters,
  mapSeriesKey,
  children,
  className,
}: ChartSyncGroupProps) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(DEFAULT_SNAPSHOT)

  const dispatch = useCallback(
    (event: ChartSyncEvent) => {
      const { type, source } = event
      if (!sync.includes(type) && !(type === 'xRange' && sync.includes('zoom'))) return
      if (filters?.publish?.(event) === false) return

      setSnapshot((previous) => {
        const state = { ...previous.state, source }
        if (type === 'cursor') {
          state.cursorTimestamp = event.timestamp
          state.cursorPosition = event.position
        } else if (type === 'xRange') {
          state.xRange = event.range ? [event.range[0], event.range[1]] : null
        } else if (type === 'yRange') {
          state.yRange = event.range
        } else if (type === 'series') {
          state.seriesVisibility = { ...previous.state.seriesVisibility, [event.key]: event }
        } else if (type === 'focus') {
          state.focusedSeriesKey = event.key
        }
        return { state, events: { ...previous.events, [type]: event } }
      })
    },
    [filters?.publish, sync],
  )
  const syncSeries = sync.includes('series')
  const context = useMemo(
    () => ({ ...snapshot, cursor, receive: filters?.receive, dispatch, syncSeries, mapSeriesKey }),
    [cursor, dispatch, filters?.receive, mapSeriesKey, snapshot, syncSeries],
  )

  return (
    <SyncContext.Provider value={context}>
      <div className={className}>{children}</div>
    </SyncContext.Provider>
  )
}

ChartSyncGroup.displayName = 'ChartSyncGroup'

/** Participate in a group's chart-by-chart synchronization. */
export function useChartSync(chartKey: string) {
  const ctx = useContext(SyncContext)
  const dispatch = ctx?.dispatch
  const events = ctx?.events
  const receive = ctx?.receive
  const mapSeriesKey = ctx?.mapSeriesKey

  const updateCursor = useCallback(
    (timestamp: number | null, position: ChartSyncCursorPosition | null = null) =>
      dispatch?.({ type: 'cursor', source: chartKey, timestamp, position }),
    [dispatch, chartKey],
  )
  const updateXRange = useCallback(
    (range: NumericRange | null) => dispatch?.({ type: 'xRange', source: chartKey, range }),
    [dispatch, chartKey],
  )
  const updateYRange = useCallback(
    (range: NumericRange | null) => dispatch?.({ type: 'yRange', source: chartKey, range }),
    [dispatch, chartKey],
  )
  const updateSeriesVisibility = useCallback(
    (key: string, visible: boolean) =>
      dispatch?.({ type: 'series', source: chartKey, key, visible }),
    [dispatch, chartKey],
  )
  const updateSeriesFocus = useCallback(
    (key: string | null) => dispatch?.({ type: 'focus', source: chartKey, key }),
    [dispatch, chartKey],
  )
  const acceptsEvent = useCallback(
    (event: ChartSyncEvent) => event.source !== chartKey && receive?.(event, chartKey) !== false,
    [chartKey, receive],
  )
  const canReceive = useCallback(
    (type: ChartSyncEvent['type']) => {
      const event = events?.[type]
      return event !== undefined && acceptsEvent(event)
    },
    [acceptsEvent, events],
  )
  const resolveSeriesKey = useCallback(
    (key: string, source: string) => (mapSeriesKey ? mapSeriesKey(key, source, chartKey) : key),
    [chartKey, mapSeriesKey],
  )

  return {
    syncState: ctx?.state ?? DEFAULT_STATE,
    cursorOptions: ctx?.cursor ?? DEFAULT_CURSOR_OPTIONS,
    canReceive,
    acceptsEvent,
    resolveSeriesKey,
    focusSource: events?.focus?.source,
    syncSeries: ctx?.syncSeries === true,
    updateSeriesVisibility,
    updateSeriesFocus,
    updateCursor,
    updateXRange,
    updateYRange,
    isSynced: ctx !== null,
  }
}

/** Resolve a received cursor using the target plot's scale and dimensions. */
export function resolveSyncedCursor(
  state: SyncState,
  options: ChartSyncCursorOptions,
  viewport: { layout: ChartLayout; xRange: NumericRange; yRange: NumericRange; xOrigin: number },
): { timestamp: number | null; x: number | null; y: number | null } {
  const { layout, xRange, yRange, xOrigin } = viewport
  const position = state.cursorPosition
  const { plotArea } = layout
  const xMode = options.x ?? 'value'
  const yMode = options.y ?? 'none'
  let timestamp = xMode === 'none' ? null : state.cursorTimestamp
  if (timestamp !== null && xMode === 'relative') {
    const ratio = position?.xRatio
    timestamp =
      ratio === undefined
        ? null
        : xOrigin +
          (layout.xProjection?.fromRatio(ratio) ?? xRange[0] + ratio * (xRange[1] - xRange[0]))
  }
  if (
    timestamp !== null &&
    (!Number.isFinite(timestamp) ||
      timestamp < xOrigin + xRange[0] ||
      timestamp > xOrigin + xRange[1])
  ) {
    timestamp = null
  }
  const point = mapDataPointToChartPoint({
    x: timestamp ?? xRange[0] + xOrigin,
    y: position?.y ?? (yRange[0] + yRange[1]) / 2,
    xRange,
    yRange,
    layout,
    xValueOffset: xOrigin,
  })
  const rotated = layout.orientation === 'rotated'
  const timePixel = rotated ? point.y : point.x
  const visibleTime = timestamp !== null && Number.isFinite(timePixel) ? timePixel : null
  let visibleValue: number | null = null
  if (position && yMode !== 'none' && state.cursorTimestamp !== null) {
    const start = rotated ? plotArea.x : plotArea.y
    const length = rotated ? plotArea.width : plotArea.height
    const relative = rotated ? 1 - position.yRatio : position.yRatio
    const pixel = yMode === 'relative' ? start + relative * length : rotated ? point.x : point.y
    if (pixel >= start && pixel <= start + length) visibleValue = pixel
  }
  return rotated
    ? { timestamp, x: visibleValue, y: visibleTime }
    : { timestamp, x: visibleTime, y: visibleValue }
}
