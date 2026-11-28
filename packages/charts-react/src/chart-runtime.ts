'use client'

import {
  type ChartFramePlugin,
  ChartPluginLifecycle,
  type ColumnarData,
  type CommandFrameSvgInput,
  commandFrameToSvg,
  createRenderContext,
  DataSource,
  type RenderContext,
  type RendererType,
  TimeSeriesSampleKind,
} from '@pitant/charts'
import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChartContainerRef } from './chart-container.js'
import type { ChartLegendItem } from './chart-legend.js'
import type { ChartSyncSeriesVisibilityEvent, useChartSync } from './chart-sync-group.js'
import type { ChartTooltipProvenance } from './chart-tooltip.js'
import type {
  ColumnarTooltipProvenanceColumn,
  ColumnarTooltipProvenanceField,
  ColumnarTooltipProvenanceMap,
  ColumnarTooltipProvenanceValue,
} from './chart-tooltip-data.js'
import type { ChartStats, ExportOptions, SeriesConfig } from './use-chart.js'

export const DEFAULT_LEGEND_COLORS = [
  'var(--chart-1, hsl(221 83% 53%))',
  'var(--chart-2, hsl(142 71% 45%))',
  'var(--chart-3, hsl(47 96% 53%))',
  'var(--chart-4, hsl(0 84% 60%))',
  'var(--chart-5, hsl(262 83% 58%))',
  'var(--chart-6, hsl(199 89% 48%))',
  'var(--chart-7, hsl(29 100% 52%))',
  'var(--chart-8, hsl(339 90% 51%))',
] as const

export const EMPTY_STATS: ChartStats = { fps: 0, renderTime: 0, pointCount: 0 }
export const EMPTY_RANGE: readonly [number, number] = [0, 0]

export interface UseRendererOptions {
  containerRef: RefObject<ChartContainerRef | null>
  renderer?: RendererType | 'auto'
  plugins?: readonly Pick<ChartFramePlugin<unknown>, 'mount'>[] | undefined
}

export interface UseRendererReturn {
  context: RenderContext | null
  ready: boolean
  error: Error | null
}

interface RendererSession {
  context: RenderContext
  lifecycle: ChartPluginLifecycle
  containerRef: UseRendererOptions['containerRef']
  renderer: NonNullable<UseRendererOptions['renderer']>
}

export interface ColumnarChartData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  sampleKinds?: Record<string, Uint8Array>
  seriesTimestamps?: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
  provenance?: ColumnarTooltipProvenanceMap
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface ColumnarViewportState<TData extends ColumnarChartData> {
  data: TData
  rawData: TData
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }>
  lodLevel: number
  rawPointCount: number
  returnedPointCount: number
  loading: boolean
  error: Error | null
  appendData: (data: TData) => void
  setData: (data: TData) => void
}

export interface UseColumnarViewportOptions<TData extends ColumnarChartData> {
  data: TData
  fields: readonly string[]
  range?: readonly [number, number]
  targetPixels: number
  enabled?: boolean
}

export interface ResolvedExportOptions {
  width: number
  height: number
  pixelRatio: number
  background?: string
}

export interface ExportImageRenderers {
  renderCanvas?: (context: RenderContext, options: ResolvedExportOptions) => void | Promise<void>
  renderSvg?: (options: ResolvedExportOptions) => string | CommandFrameSvgInput
}

export function useRenderer({
  containerRef,
  plugins,
  renderer = 'auto',
}: UseRendererOptions): UseRendererReturn {
  const [session, setSession] = useState<RendererSession | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const canvas = containerRef.current?.canvas
    if (!canvas) return

    let disposed = false
    let resource: RendererSession | undefined

    async function init(target: HTMLCanvasElement) {
      try {
        const context = await createRenderContext(target, { renderer })
        if (disposed) {
          context.dispose()
          return
        }
        resource = {
          context,
          lifecycle: new ChartPluginLifecycle(context),
          containerRef,
          renderer,
        }
        setSession(resource)
        setError(null)
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    void init(canvas)

    return () => {
      disposed = true
      if (!resource) return
      setSession((current) => (current === resource ? null : current))
      try {
        resource.lifecycle.dispose()
      } finally {
        resource.context.dispose()
      }
    }
  }, [containerRef, renderer])

  const active =
    session?.containerRef === containerRef && session.renderer === renderer ? session : null

  // Update the mounted plugins before subsequent live drawing effects run.
  useEffect(() => {
    active?.lifecycle.update(plugins)
  }, [active, plugins])

  return { context: active?.context ?? null, ready: active !== null, error }
}

export function useColumnarViewport<TData extends ColumnarChartData>(
  options: UseColumnarViewportOptions<TData>,
): ColumnarViewportState<TData> {
  const { data, enabled = true, fields, range, targetPixels } = options
  const dataSourceRef = useRef<DataSource | null>(null)
  const externalDataRef = useRef<TData>(data)
  const rawDataRef = useRef<TData>(data)
  const loadDataRef = useRef<TData>(data)
  const [loadVersion, setLoadVersion] = useState(0)
  const [rawData, setRawData] = useState<TData>(data)
  const [sourceVersion, setSourceVersion] = useState(0)
  const [state, setState] = useState<ColumnarViewportState<TData>>(() => ({
    data,
    rawData: data,
    gaps: data.gaps ?? [],
    lodLevel: 0,
    rawPointCount: data.timestamps.length,
    returnedPointCount: data.timestamps.length,
    loading: false,
    error: null,
    appendData: () => undefined,
    setData: () => undefined,
  }))
  const fieldKey = useMemo(() => stableFieldKey(fields), [fields])
  const selectedFields = useMemo(() => parseFieldKey(fieldKey), [fieldKey])
  const exact = requiresExactCoordinates(rawData)
  const useLod = enabled && !exact
  const exactWindow = useMemo(
    () => (enabled && exact ? selectExactWindow(rawData, selectedFields, range) : undefined),
    [enabled, exact, rawData, range, selectedFields],
  )

  const replaceData = useCallback((nextData: TData) => {
    rawDataRef.current = nextData
    loadDataRef.current = nextData
    setRawData(nextData)
    setLoadVersion((version) => version + 1)
  }, [])

  const appendData = useCallback(
    (nextData: TData) => {
      const current = rawDataRef.current
      const merged = concatColumnarChartData(current, nextData) as TData
      rawDataRef.current = merged
      setRawData(merged)

      const source = dataSourceRef.current
      if (
        !enabled ||
        requiresExactCoordinates(merged) ||
        !source ||
        hasNewColumn(current, nextData)
      ) {
        loadDataRef.current = merged
        setLoadVersion((version) => version + 1)
        return
      }

      const appendInput = normalizeAppendData(current, nextData)
      setState((previous) => ({
        ...previous,
        rawData: merged,
        rawPointCount: merged.timestamps.length,
        loading: true,
        error: null,
      }))

      async function appendToSource(activeSource: DataSource) {
        try {
          await activeSource.append(toDataSourceInput(appendInput))
          if (dataSourceRef.current === activeSource) {
            setSourceVersion((version) => version + 1)
          }
        } catch {
          if (dataSourceRef.current === activeSource) {
            loadDataRef.current = merged
            setLoadVersion((version) => version + 1)
          }
        }
      }

      void appendToSource(source)
    },
    [enabled],
  )

  useEffect(() => {
    if (externalDataRef.current === data) return
    externalDataRef.current = data
    replaceData(data)
  }, [data, replaceData])

  useEffect(() => {
    void loadVersion

    const sourceData = loadDataRef.current

    if (!useLod) {
      dataSourceRef.current?.destroy()
      dataSourceRef.current = null
      setState({
        data: sourceData,
        rawData: sourceData,
        gaps: sourceData.gaps ?? [],
        lodLevel: 0,
        rawPointCount: sourceData.timestamps.length,
        returnedPointCount: sourceData.timestamps.length,
        loading: false,
        error: null,
        appendData,
        setData: replaceData,
      })
      return
    }

    let cancelled = false
    const source = new DataSource({ strict: false })
    dataSourceRef.current?.destroy()
    dataSourceRef.current = source
    setState((previous) => ({
      ...previous,
      data: sourceData,
      rawData: sourceData,
      gaps: sourceData.gaps ?? [],
      rawPointCount: sourceData.timestamps.length,
      returnedPointCount: sourceData.timestamps.length,
      loading: true,
      error: null,
      appendData,
      setData: replaceData,
    }))

    async function loadSource() {
      try {
        await source.load(toDataSourceInput(sourceData))
        if (!cancelled) {
          setSourceVersion((version) => version + 1)
        }
      } catch (err) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            data: sourceData,
            rawData: sourceData,
            gaps: sourceData.gaps ?? [],
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            appendData,
            setData: replaceData,
          }))
        }
      }
    }

    void loadSource()

    return () => {
      cancelled = true
      if (dataSourceRef.current === source) {
        dataSourceRef.current = null
      }
      source.destroy()
    }
  }, [appendData, loadVersion, replaceData, useLod])

  useEffect(() => {
    const source = dataSourceRef.current
    if (!useLod || !source || selectedFields.length === 0) return

    void sourceVersion

    const activeRawData = rawDataRef.current
    const queryRange = range ?? rangeFromTimestamps(activeRawData.timestamps)
    if (!queryRange || queryRange[0] > queryRange[1]) return
    const activeSource = source
    const activeRange = queryRange

    let cancelled = false

    async function queryViewport() {
      try {
        const result = await activeSource.query({
          start: activeRange[0],
          end: activeRange[1],
          targetPixels: Math.max(1, Math.round(targetPixels)),
          columns: selectedFields,
        })

        if (!cancelled) {
          const viewportData: ColumnarChartData = {
            timestamps: result.timestamps,
            columns: result.columns,
            gaps: result.gaps,
          }
          if (result.quality) {
            viewportData.quality = result.quality
          }

          setState({
            data: viewportData as TData,
            rawData: activeRawData,
            gaps: result.gaps,
            lodLevel: result.lodLevel,
            rawPointCount: result.rawPointCount,
            returnedPointCount: result.returnedPointCount,
            loading: false,
            error: null,
            appendData,
            setData: replaceData,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            rawData: activeRawData,
            gaps: previous.gaps,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            appendData,
            setData: replaceData,
          }))
        }
      }
    }

    void queryViewport()

    return () => {
      cancelled = true
    }
  }, [appendData, range, replaceData, selectedFields, sourceVersion, targetPixels, useLod])

  return useMemo(
    () => ({
      ...state,
      ...(exactWindow && {
        data: exactWindow,
        gaps: exactWindow.gaps ?? [],
        lodLevel: 0,
        rawPointCount: countWindowPoints(rawData),
        returnedPointCount: countWindowPoints(exactWindow),
        loading: false,
        error: null,
      }),
      rawData,
      appendData,
      setData: replaceData,
    }),
    [appendData, exactWindow, rawData, replaceData, state],
  )
}

export function useSeriesVisibility(series: readonly SeriesConfig[]): {
  visibilityMap: Record<string, boolean>
  toggleSeries: (key: string) => void
  setSeriesVisible: (key: string, visible: boolean) => void
} {
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() =>
    initialVisibility(series),
  )

  useEffect(() => {
    setVisibilityMap((previous) => {
      const next: Record<string, boolean> = {}
      for (const item of series) {
        next[item.key] = previous[item.key] ?? item.visible !== false
      }
      return sameVisibility(previous, next) ? previous : next
    })
  }, [series])

  const toggleSeries = useCallback((key: string) => {
    setVisibilityMap((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? true),
    }))
  }, [])

  const setSeriesVisible = useCallback((key: string, visible: boolean) => {
    setVisibilityMap((previous) =>
      !Object.hasOwn(previous, key) || previous[key] === visible
        ? previous
        : { ...previous, [key]: visible },
    )
  }, [])

  return { visibilityMap, toggleSeries, setSeriesVisible }
}

export function useSyncedSeriesVisibility(
  series: readonly SeriesConfig[],
  sync: ReturnType<typeof useChartSync>,
): {
  visibilityMap: Record<string, boolean>
  toggleSeries: (key: string, visible?: boolean) => void
} {
  const { visibilityMap, toggleSeries: toggleLocal, setSeriesVisible } = useSeriesVisibility(series)
  const seen = useRef<Readonly<Record<string, ChartSyncSeriesVisibilityEvent>>>({})

  useEffect(() => {
    const updates = sync.syncState.seriesVisibility
    if (!updates) return
    for (const event of Object.values(updates)) {
      if (seen.current[event.key] === event || !sync.acceptsEvent(event)) continue
      const key = sync.resolveSeriesKey(event.key, event.source)
      if (key !== null) setSeriesVisible(key, event.visible)
    }
    seen.current = updates
  }, [setSeriesVisible, sync.acceptsEvent, sync.resolveSeriesKey, sync.syncState.seriesVisibility])

  const toggleSeries = useCallback(
    (key: string, visible?: boolean) => {
      if (!sync.syncSeries && visible === undefined) {
        toggleLocal(key)
        return
      }
      if (!Object.hasOwn(visibilityMap, key)) return
      const next = visible ?? !visibilityMap[key]
      setSeriesVisible(key, next)
      sync.updateSeriesVisibility(key, next)
    },
    [setSeriesVisible, sync.syncSeries, sync.updateSeriesVisibility, toggleLocal, visibilityMap],
  )

  return { visibilityMap, toggleSeries }
}

export function useLegendItems(
  series: readonly SeriesConfig[],
  visibilityMap: Record<string, boolean>,
): readonly ChartLegendItem[] {
  return useMemo(
    () =>
      series.map((item, index) => ({
        key: item.key,
        label: item.label,
        color:
          item.color ?? (DEFAULT_LEGEND_COLORS[index % DEFAULT_LEGEND_COLORS.length] as string),
        visible: visibilityMap[item.key] ?? item.visible !== false,
      })),
    [series, visibilityMap],
  )
}

export function exportCanvasImage(
  containerRef: RefObject<ChartContainerRef | null>,
  format: 'png' | 'svg',
  options?: ExportOptions,
  renderers: ExportImageRenderers = {},
): Promise<Blob> {
  const container = containerRef.current
  if (!container) {
    return Promise.reject(new Error('Chart canvas is not available. Is the container mounted?'))
  }

  const resolved = resolveExportOptions(container, options)

  if (format === 'svg') {
    if (!renderers.renderSvg) {
      return Promise.reject(
        new Error('SVG export requires a vector renderer for this chart surface.'),
      )
    }
    const result = renderers.renderSvg(resolved)
    const svg =
      typeof result === 'string'
        ? result
        : commandFrameToSvg(result, svgExportOptions(resolved.background))
    return Promise.resolve(new Blob([svg], { type: 'image/svg+xml' }))
  }

  const canvas = container.canvas
  if (!canvas && !renderers.renderCanvas) {
    return Promise.reject(new Error('Chart canvas is not available. Is the container mounted?'))
  }

  return renderers.renderCanvas
    ? exportRenderedCanvasImage(renderers.renderCanvas, resolved)
    : exportMountedCanvasImage(canvas as HTMLCanvasElement, resolved)
}

export function resolveExportOptions(
  container: ChartContainerRef,
  options: ExportOptions = {},
): ResolvedExportOptions {
  const dpr = normalizePixelRatio(options.pixelRatio ?? 2)
  const dimensions = container.dimensions
  const canvas = container.canvas
  const width =
    options.width ??
    (dimensions.width > 0
      ? dimensions.width
      : canvas?.clientWidth || (canvas ? canvas.width / Math.max(1, dimensions.dpr) : 0))
  const height =
    options.height ??
    (dimensions.height > 0
      ? dimensions.height
      : canvas?.clientHeight || (canvas ? canvas.height / Math.max(1, dimensions.dpr) : 0))

  const resolved: ResolvedExportOptions = {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    pixelRatio: dpr,
  }
  if (options.background !== undefined) {
    resolved.background = options.background
  }
  return resolved
}

async function exportRenderedCanvasImage(
  renderCanvas: (context: RenderContext, options: ResolvedExportOptions) => void | Promise<void>,
  options: ResolvedExportOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const context = await createRenderContext(canvas, { renderer: 'canvas2d' })
  try {
    context.resize(options.width, options.height, options.pixelRatio)
    await renderCanvas(context, options)
    paintBackgroundBehind(canvas, options)
    return await canvasToBlob(canvas, 'image/png')
  } finally {
    context.dispose()
  }
}

function exportMountedCanvasImage(
  sourceCanvas: HTMLCanvasElement,
  options: ResolvedExportOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const pixelWidth = Math.max(1, Math.round(options.width * options.pixelRatio))
  const pixelHeight = Math.max(1, Math.round(options.height * options.pixelRatio))
  canvas.width = pixelWidth
  canvas.height = pixelHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas2D context is not available for export.'))

  if (options.background) {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, pixelWidth, pixelHeight)
  }
  ctx.drawImage(sourceCanvas, 0, 0, pixelWidth, pixelHeight)
  return canvasToBlob(canvas, 'image/png')
}

function paintBackgroundBehind(canvas: HTMLCanvasElement, options: ResolvedExportOptions): void {
  if (!options.background) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0)
  ctx.fillStyle = options.background
  ctx.fillRect(0, 0, options.width, options.height)
  ctx.restore()
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas toBlob returned null'))
          }
        },
        mimeType,
        1.0,
      )
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

function normalizePixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function svgExportOptions(background: string | undefined) {
  return background === undefined ? {} : { background }
}

export function concatFloat64Columns(
  current: Record<string, Float64Array>,
  next: Record<string, Float64Array>,
  currentLength: number,
  nextLength: number,
): Record<string, Float64Array> {
  const fields = new Set([...Object.keys(current), ...Object.keys(next)])
  const columns: Record<string, Float64Array> = {}

  for (const field of fields) {
    const left = current[field] ?? filledFloat64(currentLength, Number.NaN)
    const right = next[field] ?? filledFloat64(nextLength, Number.NaN)
    columns[field] = concatFloat64(left, right)
  }

  return columns
}

export function concatFloat64(left: Float64Array, right: Float64Array): Float64Array {
  const merged = new Float64Array(left.length + right.length)
  merged.set(left, 0)
  merged.set(right, left.length)
  return merged
}

export function liveEdgeRange(
  current: Float64Array,
  next: Float64Array,
  windowSize?: number,
): readonly [number, number] {
  const totalLength = current.length + next.length
  if (totalLength === 0) return EMPTY_RANGE

  const end = lastTimestamp(next) ?? lastTimestamp(current)
  if (end === undefined) return EMPTY_RANGE

  if (windowSize === undefined || windowSize <= 0 || windowSize >= totalLength) {
    const start = firstTimestamp(current) ?? firstTimestamp(next) ?? end
    return [start, end]
  }

  const startIndex = Math.max(0, totalLength - Math.floor(windowSize))
  const start =
    startIndex < current.length ? current[startIndex] : next[startIndex - current.length]

  return [start ?? end, end]
}

function toDataSourceInput(data: ColumnarChartData): ColumnarData {
  // DataSource owns worker transfers and its cache. Supplying the original
  // views avoids redundant copies and keeps quality available for decimation.
  return {
    timestamps: data.timestamps,
    columns: data.columns,
    ...(data.quality && { quality: data.quality }),
  }
}

function requiresExactCoordinates(data: ColumnarChartData): boolean {
  // Dense LOD combines samples by shared X buckets. Structural holes and
  // independent X arrays must instead retain their per-sample semantics.
  return data.sampleKinds !== undefined || data.seriesTimestamps !== undefined
}

function countWindowPoints(data: ColumnarChartData): number {
  let count = data.timestamps.length
  for (const grid of Object.values(data.seriesTimestamps ?? {})) {
    count = Math.max(count, grid.length)
  }
  return count
}

function selectExactWindow<TData extends ColumnarChartData>(
  data: TData,
  fields: readonly string[],
  range: readonly [number, number] | undefined,
): TData {
  if (!range) return data

  const [start, end] = windowIndices(data.timestamps, range)
  const window: ColumnarChartData = {
    timestamps: data.timestamps.subarray(start, end),
    columns: {},
  }
  for (const field of fields) {
    const values = data.columns[field]
    if (values === undefined) continue
    const grid = data.seriesTimestamps?.[field]
    const [fieldStart, fieldEnd] = grid ? windowIndices(grid, range) : [start, end]
    window.columns[field] = values.subarray(fieldStart, fieldEnd)
    if (grid) {
      window.seriesTimestamps ??= {}
      window.seriesTimestamps[field] = grid.subarray(fieldStart, fieldEnd)
    }
    const kinds = data.sampleKinds?.[field]
    if (kinds) {
      window.sampleKinds ??= {}
      window.sampleKinds[field] = kinds.subarray(fieldStart, fieldEnd)
    }
    const quality = data.quality?.[field]
    if (quality) {
      window.quality ??= {}
      window.quality[field] = quality.subarray(fieldStart, fieldEnd)
    }
  }
  if (data.gaps && end > start) {
    window.gaps = data.gaps
      .filter((gap) => gap.startIndex < end && gap.endIndex >= start)
      .map((gap) => ({
        startIndex: Math.max(0, gap.startIndex - start),
        endIndex: Math.min(end - 1, gap.endIndex) - start,
      }))
  }
  return window as TData
}

function windowIndices(timestamps: Float64Array, [min, max]: readonly [number, number]) {
  const start = timestampBoundary(timestamps, min, false)
  const end = Math.max(start, timestampBoundary(timestamps, max, true))
  return [start, end] as const
}

function timestampBoundary(timestamps: Float64Array, target: number, inclusive: boolean): number {
  let low = 0
  let high = timestamps.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const timestamp = timestamps[middle] as number
    if (timestamp < target || (inclusive && timestamp === target)) low = middle + 1
    else high = middle
  }
  return low
}

function filledFloat64(length: number, value: number): Float64Array {
  const values = new Float64Array(length)
  values.fill(value)
  return values
}

function concatColumnarChartData(
  current: ColumnarChartData,
  next: ColumnarChartData,
): ColumnarChartData {
  const facets = new Set([
    ...Object.keys(current.seriesTimestamps ?? {}),
    ...Object.keys(next.seriesTimestamps ?? {}),
  ])
  const merged: ColumnarChartData = {
    timestamps: concatFloat64(current.timestamps, next.timestamps),
    columns: {},
  }

  if (facets.size === 0) {
    merged.columns = concatFloat64Columns(
      current.columns,
      next.columns,
      current.timestamps.length,
      next.timestamps.length,
    )
  } else {
    merged.seriesTimestamps = {}
    const fields = new Set([...Object.keys(current.columns), ...Object.keys(next.columns)])
    for (const field of fields) {
      const independent = facets.has(field)
      const left = coordinatesForField(current, field, independent)
      const right = coordinatesForField(next, field, independent)
      if (independent) merged.seriesTimestamps[field] = concatFloat64(left, right)
      merged.columns[field] = concatFloat64(
        current.columns[field] ?? filledFloat64(left.length, Number.NaN),
        next.columns[field] ?? filledFloat64(right.length, Number.NaN),
      )
    }
  }

  const quality = concatQualityColumns(current, next, facets)
  if (quality) merged.quality = quality
  const provenance = concatProvenanceColumns(current, next, facets)
  if (provenance) merged.provenance = provenance
  const sampleKinds = concatSampleKinds(current, next, facets)
  if (sampleKinds) merged.sampleKinds = sampleKinds
  if (current.gaps || next.gaps) {
    const offset = current.timestamps.length
    merged.gaps = [
      ...(current.gaps ?? []),
      ...(next.gaps ?? []).map(({ startIndex, endIndex }) => ({
        startIndex: startIndex + offset,
        endIndex: endIndex + offset,
      })),
    ]
  }
  return merged
}

const EMPTY_TIMESTAMPS = new Float64Array()

function coordinatesForField(
  data: ColumnarChartData,
  field: string,
  independent: boolean,
): Float64Array {
  if (!independent) return data.timestamps
  if (!Object.hasOwn(data.columns, field)) return EMPTY_TIMESTAMPS
  return data.seriesTimestamps?.[field] ?? data.timestamps
}

function concatSampleKinds(
  current: ColumnarChartData,
  next: ColumnarChartData,
  facets: ReadonlySet<string>,
): Record<string, Uint8Array> | undefined {
  if (!current.sampleKinds && !next.sampleKinds) return undefined

  const kinds: Record<string, Uint8Array> = {}
  const fields = new Set([...Object.keys(current.columns), ...Object.keys(next.columns)])
  for (const field of fields) {
    const independent = facets.has(field)
    const left = current.sampleKinds?.[field] ?? defaultSampleKinds(current, field, independent)
    const right = next.sampleKinds?.[field] ?? defaultSampleKinds(next, field, independent)
    kinds[field] = concatUint8(left, right)
  }
  return kinds
}

function defaultSampleKinds(data: ColumnarChartData, field: string, independent: boolean) {
  const count = coordinatesForField(data, field, independent).length
  return filledUint8(
    count,
    Object.hasOwn(data.columns, field)
      ? TimeSeriesSampleKind.Observed
      : TimeSeriesSampleKind.AlignmentHole,
  )
}

function normalizeAppendData(
  current: ColumnarChartData,
  next: ColumnarChartData,
): ColumnarChartData {
  const columns: Record<string, Float64Array> = {}
  for (const field of Object.keys(current.columns)) {
    columns[field] = next.columns[field] ?? filledFloat64(next.timestamps.length, Number.NaN)
  }

  const normalized: ColumnarChartData = {
    timestamps: next.timestamps,
    columns,
  }
  const quality = normalizeAppendQuality(current, next)
  if (quality) {
    normalized.quality = quality
  }
  return normalized
}

function hasNewColumn(current: ColumnarChartData, next: ColumnarChartData): boolean {
  for (const field of Object.keys(next.columns)) {
    if (!Object.hasOwn(current.columns, field)) return true
  }
  return false
}

function firstTimestamp(timestamps: Float64Array): number | undefined {
  return timestamps[0]
}

function lastTimestamp(timestamps: Float64Array): number | undefined {
  return timestamps[timestamps.length - 1]
}

function concatQualityColumns(
  current: ColumnarChartData,
  next: ColumnarChartData,
  facets: ReadonlySet<string>,
): Record<string, Uint8Array> | undefined {
  if (!current.quality && !next.quality) return undefined

  const quality: Record<string, Uint8Array> = {}
  const fields = new Set([...Object.keys(current.columns), ...Object.keys(next.columns)])
  for (const field of fields) {
    const independent = facets.has(field)
    const left =
      current.quality?.[field] ??
      filledUint8(coordinatesForField(current, field, independent).length, 0)
    const right =
      next.quality?.[field] ?? filledUint8(coordinatesForField(next, field, independent).length, 0)
    quality[field] = concatUint8(left, right)
  }
  return quality
}

function normalizeAppendQuality(
  current: ColumnarChartData,
  next: ColumnarChartData,
): Record<string, Uint8Array> | undefined {
  if (!current.quality && !next.quality) return undefined

  const quality: Record<string, Uint8Array> = {}
  for (const field of Object.keys(current.columns)) {
    quality[field] = next.quality?.[field] ?? filledUint8(next.timestamps.length, 0)
  }
  return quality
}

function concatProvenanceColumns(
  current: ColumnarChartData,
  next: ColumnarChartData,
  facets: ReadonlySet<string>,
): ColumnarTooltipProvenanceMap | undefined {
  if (!current.provenance && !next.provenance) return undefined

  const provenance: ColumnarTooltipProvenanceMap = {}
  const fields = new Set([
    ...Object.keys(current.provenance ?? {}),
    ...Object.keys(next.provenance ?? {}),
  ])
  for (const field of fields) {
    const independent = facets.has(field)
    const merged = concatProvenanceField(
      current.provenance?.[field],
      coordinatesForField(current, field, independent).length,
      next.provenance?.[field],
      coordinatesForField(next, field, independent).length,
    )
    if (merged !== undefined) provenance[field] = merged
  }

  return Object.keys(provenance).length > 0 ? provenance : undefined
}

function concatProvenanceField(
  left: ColumnarTooltipProvenanceField | undefined,
  leftLength: number,
  right: ColumnarTooltipProvenanceField | undefined,
  rightLength: number,
): ColumnarTooltipProvenanceField | undefined {
  if (left === undefined && right === undefined) return undefined
  if (typeof left === 'string' && typeof right === 'string' && left === right) return left
  if (isCodedProvenanceColumn(left) && isCodedProvenanceColumn(right)) {
    const codes = concatMatchingProvenanceCodes(left, right)
    if (codes) return { labels: left.labels, codes }
  }

  const values = new Array<ColumnarTooltipProvenanceValue | null>(leftLength + rightLength)
  for (let index = 0; index < leftLength; index++) {
    values[index] = provenanceValueAt(left, index)
  }
  for (let index = 0; index < rightLength; index++) {
    values[leftLength + index] = provenanceValueAt(right, index)
  }
  return values
}

function provenanceValueAt(
  field: ColumnarTooltipProvenanceField | undefined,
  index: number,
): ColumnarTooltipProvenanceValue | null {
  if (field === undefined) return null
  if (typeof field === 'string' || isTooltipProvenance(field)) return field
  if (isCodedProvenanceColumn(field)) {
    const code = field.codes[index]
    if (code === undefined) return null
    const label = field.labels[code]
    return label ? { label } : null
  }

  const value = field[index]
  return value ?? null
}

function concatMatchingProvenanceCodes(
  left: ColumnarTooltipProvenanceColumn,
  right: ColumnarTooltipProvenanceColumn,
): Uint8Array | Uint16Array | Uint32Array | null {
  if (!sameLabels(left.labels, right.labels)) return null
  if (left.codes instanceof Uint8Array && right.codes instanceof Uint8Array) {
    const merged = new Uint8Array(left.codes.length + right.codes.length)
    merged.set(left.codes, 0)
    merged.set(right.codes, left.codes.length)
    return merged
  }
  if (left.codes instanceof Uint16Array && right.codes instanceof Uint16Array) {
    const merged = new Uint16Array(left.codes.length + right.codes.length)
    merged.set(left.codes, 0)
    merged.set(right.codes, left.codes.length)
    return merged
  }
  if (left.codes instanceof Uint32Array && right.codes instanceof Uint32Array) {
    const merged = new Uint32Array(left.codes.length + right.codes.length)
    merged.set(left.codes, 0)
    merged.set(right.codes, left.codes.length)
    return merged
  }
  return null
}

function sameLabels(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function isTooltipProvenance(value: unknown): value is ChartTooltipProvenance {
  return typeof value === 'object' && value !== null && 'label' in value
}

function isCodedProvenanceColumn(value: unknown): value is ColumnarTooltipProvenanceColumn {
  return (
    typeof value === 'object' &&
    value !== null &&
    'labels' in value &&
    'codes' in value &&
    ((value as { codes: unknown }).codes instanceof Uint8Array ||
      (value as { codes: unknown }).codes instanceof Uint16Array ||
      (value as { codes: unknown }).codes instanceof Uint32Array)
  )
}

function concatUint8(left: Uint8Array, right: Uint8Array): Uint8Array {
  const merged = new Uint8Array(left.length + right.length)
  merged.set(left, 0)
  merged.set(right, left.length)
  return merged
}

function filledUint8(length: number, value: number): Uint8Array {
  const values = new Uint8Array(length)
  values.fill(value)
  return values
}

function initialVisibility(series: readonly SeriesConfig[]): Record<string, boolean> {
  const visibility: Record<string, boolean> = {}
  for (const item of series) {
    visibility[item.key] = item.visible !== false
  }
  return visibility
}

function sameVisibility(left: Record<string, boolean>, right: Record<string, boolean>): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false
  }

  return true
}

function stableFieldKey(fields: readonly string[]): string {
  return Array.from(new Set(fields)).sort().join('\u0000')
}

function parseFieldKey(fieldKey: string): string[] {
  return fieldKey.length === 0 ? [] : fieldKey.split('\u0000')
}

function rangeFromTimestamps(timestamps: Float64Array): readonly [number, number] | null {
  if (timestamps.length === 0) return null

  const start = timestamps[0]
  const end = timestamps[timestamps.length - 1]
  if (start === undefined || end === undefined) return null

  return [start, end]
}
