'use client'

import {
  addTimeSeriesDerivedColumns,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  type ChartLayout,
  type ChartPointerCoordinates,
  type TimeSeriesAnnotation as CoreTimeSeriesAnnotation,
  type TimeSeriesBand as CoreTimeSeriesBand,
  type TimeSeriesDerivedColumn as CoreTimeSeriesDerivedColumn,
  type TimeSeriesEventMarker as CoreTimeSeriesEventMarker,
  type TimeSeriesSeries as CoreTimeSeriesSeries,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  mapDataPointToChartPoint,
  type RgbaColor,
  renderTimeSeriesPlan,
  type TimeSeriesDerivedColumnKind,
  type TimeSeriesEventMarkerPlacement,
  type TimeSeriesEventMarkerType,
  type TimeSeriesInterpolation,
  type TimeSeriesRenderOptions,
  type TimeSeriesRenderPlan,
} from '@pitant/charts'
import {
  type JSX,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChartContainerProps, ChartContainerRef } from './chart-container.js'
import { ChartContainer } from './chart-container.js'
import { ChartDataZoom } from './chart-data-zoom.js'
import { ChartRegionZoomLayer } from './chart-interactions.js'
import type { ChartLegendItem } from './chart-legend.js'
import {
  EMPTY_RANGE,
  EMPTY_STATS,
  exportCanvasImage,
  liveEdgeRange,
  type ResolvedExportOptions,
  useColumnarViewport,
  useLegendItems,
  useRenderer,
  useSeriesVisibility,
} from './chart-runtime.js'
import { useChartSync } from './chart-sync-group.js'
import type { ChartTooltipPayload } from './chart-tooltip.js'
import { ChartTooltip } from './chart-tooltip.js'
import {
  buildColumnarTooltipPayload,
  type ColumnarTooltipProvenanceMap,
} from './chart-tooltip-data.js'
import type {
  AxisConfig,
  ChartStats,
  ExportOptions,
  SeriesConfig,
  StreamingConfig,
} from './use-chart.js'

export interface TimeSeriesColumnData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
  provenance?: ColumnarTooltipProvenanceMap
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface TimeSeriesSeriesConfig extends SeriesConfig {
  field: string
  rgba?: RgbaColor
  lineWidth?: number
  interpolation?: TimeSeriesInterpolation
  gapThreshold?: number
}

export interface TimeSeriesDerivedSeriesConfig extends Omit<TimeSeriesSeriesConfig, 'field'> {
  kind: TimeSeriesDerivedColumnKind
  sourceField: string
  field?: string
  windowSize?: number
  minimumSamples?: number
  per?: number
  scale?: number
  offset?: number
}

export interface TimeSeriesValueBandConfig {
  kind: 'value-band'
  key: string
  label?: string
  yStart: number
  yEnd: number
  xRange?: readonly [number, number]
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
  includeInYRange?: boolean
}

export interface TimeSeriesEnvelopeBandConfig {
  kind: 'envelope'
  key: string
  label?: string
  lowerField: string
  upperField: string
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
  gapThreshold?: number
  visible?: boolean
  includeInYRange?: boolean
}

export type TimeSeriesBandConfig = TimeSeriesValueBandConfig | TimeSeriesEnvelopeBandConfig

interface TimeSeriesBaseAnnotationConfig {
  key: string
  label?: string
  visible?: boolean
  includeInYRange?: boolean
  labelVisible?: boolean
}

export interface TimeSeriesXLineAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  kind: 'x-line'
  x: number
  rgba?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesYLineAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  kind: 'y-line'
  y: number
  rgba?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesXRangeAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  kind: 'x-range'
  xStart: number
  xEnd: number
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesYRangeAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  kind: 'y-range'
  yStart: number
  yEnd: number
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesRulerAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  kind: 'ruler'
  xStart: number
  xEnd: number
  yStart: number
  yEnd: number
  rgba?: RgbaColor
  lineWidth?: number
}

export type TimeSeriesAnnotationConfig =
  | TimeSeriesXLineAnnotationConfig
  | TimeSeriesYLineAnnotationConfig
  | TimeSeriesXRangeAnnotationConfig
  | TimeSeriesYRangeAnnotationConfig
  | TimeSeriesRulerAnnotationConfig

export interface TimeSeriesEventMarkerConfig {
  key: string
  x: number
  label?: string
  eventType?: TimeSeriesEventMarkerType
  placement?: TimeSeriesEventMarkerPlacement
  rgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface TimeSeriesConfig {
  series: TimeSeriesSeriesConfig[]
  derivedSeries?: TimeSeriesDerivedSeriesConfig[]
  bands?: TimeSeriesBandConfig[]
  annotations?: TimeSeriesAnnotationConfig[]
  eventMarkers?: TimeSeriesEventMarkerConfig[]
  xAxis?: AxisConfig & {
    gapThreshold?: number
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
    paddingRatio?: number
  }
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
  interpolation?: TimeSeriesInterpolation
}

export interface TimeSeriesStats extends ChartStats {
  sourcePointCount: number
  renderedPointCount: number
  segmentCount: number
  lodLevel: number
  rawPointCount: number
  returnedPointCount: number
  dataLoading: boolean
}

export interface UseTimeSeriesOptions {
  config: TimeSeriesConfig
  data: TimeSeriesColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  streaming?: StreamingConfig
  resizeKey?: unknown
}

export interface UseTimeSeriesReturn {
  append: (data: TimeSeriesColumnData) => void
  setData: (data: TimeSeriesColumnData) => void
  visibleRange: readonly [number, number]
  setVisibleRange: (range: readonly [number, number]) => void
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string) => void
  tooltipPayload: ChartTooltipPayload | null
  tooltipPosition: { x: number; y: number } | null
  syncedCursorX: number | null
  handleHoverChange: (coordinates: ChartPointerCoordinates | null) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: TimeSeriesStats
  ready: boolean
  error: Error | null
  config: TimeSeriesConfig
  renderPlan: TimeSeriesRenderPlan
  dataRange: readonly [number, number]
  fullRange: readonly [number, number]
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }>
  renderedPointCount: number
  layout: ChartLayout
}

export interface TimeSeriesProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: TimeSeriesConfig
  data: TimeSeriesColumnData
  streaming?: StreamingConfig
  renderer?: TimeSeriesConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  dataZoom?: boolean
  children?: ReactNode | ((chart: UseTimeSeriesReturn) => ReactNode)
}

const EMPTY_TOOLTIP: ChartTooltipPayload | null = null
const EMPTY_TIMESERIES_STATS: TimeSeriesStats = {
  ...EMPTY_STATS,
  sourcePointCount: 0,
  renderedPointCount: 0,
  segmentCount: 0,
  lodLevel: 0,
  rawPointCount: 0,
  returnedPointCount: 0,
  dataLoading: false,
}

export function useTimeSeries(options: UseTimeSeriesOptions): UseTimeSeriesReturn {
  const { chartKey = 'time-series', config, containerRef, resizeKey, streaming } = options
  const [visibleRange, setVisibleRangeState] = useState<readonly [number, number]>(EMPTY_RANGE)
  const [stats, setStats] = useState<TimeSeriesStats>(EMPTY_TIMESERIES_STATS)
  const [tooltipPayload, setTooltipPayload] = useState<ChartTooltipPayload | null>(EMPTY_TOOLTIP)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [syncedCursorX, setSyncedCursorX] = useState<number | null>(null)
  const sync = useChartSync(chartKey)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const derivedColumns = useMemo(
    () => (config.derivedSeries ?? []).map(toCoreTimeSeriesDerivedColumn),
    [config.derivedSeries],
  )
  const effectiveSeries = useMemo(
    () => [...config.series, ...(config.derivedSeries ?? []).map(toDerivedTimeSeriesSeriesConfig)],
    [config.derivedSeries, config.series],
  )
  const chartData = useMemo(
    () => addTimeSeriesDerivedColumns(options.data, derivedColumns),
    [derivedColumns, options.data],
  )
  const { visibilityMap, toggleSeries } = useSeriesVisibility(effectiveSeries)
  const legendItems = useLegendItems(effectiveSeries, visibilityMap)
  const tooltipSeries = useMemo(
    () =>
      effectiveSeries.map((series) => ({
        ...series,
        visible: visibilityMap[series.key] ?? series.visible !== false,
      })),
    [effectiveSeries, visibilityMap],
  )

  const planSeries: CoreTimeSeriesSeries[] = useMemo(
    () =>
      effectiveSeries.map((series, index) => {
        const planned: CoreTimeSeriesSeries = {
          key: series.key,
          label: series.label,
          field: series.field,
          color:
            series.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
          visible: visibilityMap[series.key] ?? series.visible !== false,
        }
        if (series.lineWidth !== undefined) planned.lineWidth = series.lineWidth
        if (series.interpolation !== undefined) planned.interpolation = series.interpolation
        if (series.gapThreshold !== undefined) planned.gapThreshold = series.gapThreshold
        return planned
      }),
    [effectiveSeries, visibilityMap],
  )

  const planBands: CoreTimeSeriesBand[] = useMemo(
    () => (config.bands ?? []).map(toCoreTimeSeriesBand),
    [config.bands],
  )
  const planAnnotations: CoreTimeSeriesAnnotation[] = useMemo(
    () => (config.annotations ?? []).map(toCoreTimeSeriesAnnotation),
    [config.annotations],
  )
  const planEventMarkers: CoreTimeSeriesEventMarker[] = useMemo(
    () => (config.eventMarkers ?? []).map(toCoreTimeSeriesEventMarker),
    [config.eventMarkers],
  )

  const activeXRange =
    visibleRange[0] < visibleRange[1] ? (visibleRange as readonly [number, number]) : undefined
  const activeYRange = config.yAxis?.range
  const visibleFields = useMemo(() => {
    const fields = new Set<string>()
    for (const series of planSeries) {
      if (series.visible !== false) fields.add(series.field)
    }
    for (const band of planBands) {
      if (band.visible === false || band.kind !== 'envelope') continue
      fields.add(band.lowerField)
      fields.add(band.upperField)
    }
    return Array.from(fields)
  }, [planBands, planSeries])
  const targetPixels = useMemo(() => {
    void resizeKey
    return Math.max(
      1,
      Math.round(containerRef.current?.dimensions.width ?? chartData.timestamps.length),
    )
  }, [chartData.timestamps.length, containerRef, resizeKey])
  const viewport = useColumnarViewport({
    data: chartData,
    fields: visibleFields,
    ...(activeXRange ? { range: activeXRange } : {}),
    targetPixels,
  })

  const renderPlan = useMemo(() => {
    const renderOptions: TimeSeriesRenderOptions = {}
    if (activeXRange) renderOptions.xRange = activeXRange
    if (activeYRange) renderOptions.yRange = activeYRange
    if (config.xAxis?.gapThreshold !== undefined) {
      renderOptions.gapThreshold = config.xAxis.gapThreshold
    }
    if (config.interpolation !== undefined) renderOptions.interpolation = config.interpolation
    if (config.yAxis?.paddingRatio !== undefined) {
      renderOptions.yPaddingRatio = config.yAxis.paddingRatio
    }

    return buildTimeSeriesRenderPlan(
      {
        timestamps: viewport.data.timestamps,
        columns: viewport.data.columns,
        series: planSeries,
        bands: planBands,
        annotations: planAnnotations,
        eventMarkers: planEventMarkers,
      },
      renderOptions,
    )
  }, [
    activeXRange,
    activeYRange,
    config.interpolation,
    config.xAxis?.gapThreshold,
    config.yAxis?.paddingRatio,
    planAnnotations,
    planBands,
    planEventMarkers,
    planSeries,
    viewport.data,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createTimeSeriesLayout(
      config,
      renderPlan,
      legendItems.length,
      dimensions?.width ?? 1,
      dimensions?.height ?? 1,
    )
  }, [config, containerRef, legendItems.length, renderPlan, resizeKey])

  useEffect(() => {
    setStats((previous) => ({
      ...previous,
      pointCount: renderPlan.includedSampleCount,
      sourcePointCount: renderPlan.sourcePointCount,
      renderedPointCount: renderPlan.renderedPointCount,
      segmentCount: renderPlan.segmentCount,
      lodLevel: viewport.lodLevel,
      rawPointCount: viewport.rawPointCount,
      returnedPointCount: viewport.returnedPointCount,
      dataLoading: viewport.loading,
    }))
  }, [renderPlan, viewport])

  useEffect(() => {
    if (!context) return

    void resizeKey

    const dimensions = containerRef.current?.dimensions
    if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
      context.resize(dimensions.width, dimensions.height, dimensions.dpr)
    }

    const started = performance.now()
    renderTimeSeriesPlan(context, renderPlan, { layout })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.includedSampleCount,
      sourcePointCount: renderPlan.sourcePointCount,
      renderedPointCount: renderPlan.renderedPointCount,
      segmentCount: renderPlan.segmentCount,
      lodLevel: viewport.lodLevel,
      rawPointCount: viewport.rawPointCount,
      returnedPointCount: viewport.returnedPointCount,
      dataLoading: viewport.loading,
    })
  }, [containerRef, context, layout, renderPlan, resizeKey, viewport])

  const setData = useCallback(
    (nextData: TimeSeriesColumnData) => {
      const nextChartData = addTimeSeriesDerivedColumns(nextData, derivedColumns)
      viewport.setData(nextChartData)
      if (streaming?.liveEdge) {
        setVisibleRangeState(
          liveEdgeRange(new Float64Array(0), nextChartData.timestamps, streaming.windowSize),
        )
      }
    },
    [derivedColumns, streaming?.liveEdge, streaming?.windowSize, viewport],
  )

  const append = useCallback(
    (nextData: TimeSeriesColumnData) => {
      const previousTimestamps = viewport.rawData.timestamps
      const nextChartData = addTimeSeriesDerivedColumns(nextData, derivedColumns, {
        previousData: viewport.rawData,
      })
      viewport.appendData(nextChartData)
      if (streaming?.liveEdge) {
        setVisibleRangeState(
          liveEdgeRange(previousTimestamps, nextChartData.timestamps, streaming.windowSize),
        )
      }
    },
    [derivedColumns, streaming?.liveEdge, streaming?.windowSize, viewport],
  )

  const setVisibleRange = useCallback(
    (range: readonly [number, number]) => {
      const nextRange: [number, number] = [range[0], range[1]]
      setVisibleRangeState(nextRange)
      sync.updateXRange(nextRange)
    },
    [sync],
  )

  useEffect(() => {
    if (!sync.isSynced || sync.syncState.source === chartKey) return
    const range = sync.syncState.xRange
    if (!range) return

    setVisibleRangeState((current) => (rangesEqual(current, range) ? current : range))
  }, [chartKey, sync.isSynced, sync.syncState.source, sync.syncState.xRange])

  const handleHoverChange = useCallback(
    (coordinates: ChartPointerCoordinates | null) => {
      if (!coordinates) {
        setTooltipPayload(null)
        setTooltipPosition(null)
        setSyncedCursorX(null)
        sync.updateCursor(null)
        return
      }

      const payload = buildColumnarTooltipPayload({
        data: viewport.rawData,
        series: tooltipSeries,
        timestamp: coordinates.dataX,
        formatX: config.xAxis?.formatValue,
        formatY: config.yAxis?.formatValue,
      })
      setTooltipPayload(payload)
      setTooltipPosition(payload ? { x: coordinates.chartX, y: coordinates.chartY } : null)
      setSyncedCursorX(null)
      sync.updateCursor(payload?.timestamp ?? null)
    },
    [config.xAxis?.formatValue, config.yAxis?.formatValue, sync, tooltipSeries, viewport.rawData],
  )

  useEffect(() => {
    if (!sync.isSynced || sync.syncState.source === chartKey) return
    const timestamp = sync.syncState.cursorTimestamp
    if (timestamp === null || !timestampInRange(timestamp, renderPlan.xRange)) {
      setTooltipPayload(null)
      setTooltipPosition(null)
      setSyncedCursorX(null)
      return
    }

    const payload = buildColumnarTooltipPayload({
      data: viewport.rawData,
      series: tooltipSeries,
      timestamp,
      formatX: config.xAxis?.formatValue,
      formatY: config.yAxis?.formatValue,
    })
    const yMid = (renderPlan.yRange[0] + renderPlan.yRange[1]) / 2
    const point = mapDataPointToChartPoint({
      x: timestamp,
      y: yMid,
      layout,
      xRange: renderPlan.xRelativeRange,
      yRange: renderPlan.yRange,
      xValueOffset: renderPlan.xOrigin,
      clampToPlot: true,
    })

    setTooltipPayload(payload)
    setTooltipPosition(payload ? { x: point.x, y: point.y } : null)
    setSyncedCursorX(payload ? point.x : null)
  }, [
    chartKey,
    config.xAxis?.formatValue,
    config.yAxis?.formatValue,
    layout,
    renderPlan.xOrigin,
    renderPlan.xRange,
    renderPlan.xRelativeRange,
    renderPlan.yRange,
    sync.isSynced,
    sync.syncState.cursorTimestamp,
    sync.syncState.source,
    tooltipSeries,
    viewport.rawData,
  ])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createTimeSeriesLayout(
            config,
            renderPlan,
            legendItems.length,
            dimensions.width,
            dimensions.height,
          )
          renderTimeSeriesPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildTimeSeriesCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createTimeSeriesLayout(
                config,
                renderPlan,
                legendItems.length,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Time series chart'),
          ),
      }),
    [config, containerRef, legendItems.length, renderPlan],
  )

  return {
    append,
    setData,
    visibleRange,
    setVisibleRange,
    legendItems,
    toggleSeries,
    tooltipPayload,
    tooltipPosition,
    syncedCursorX,
    handleHoverChange,
    exportImage,
    stats,
    ready,
    error: error ?? viewport.error,
    config,
    renderPlan,
    dataRange: renderPlan.xRange,
    fullRange: rangeFromTimestamps(viewport.rawData.timestamps),
    gaps: viewport.gaps,
    renderedPointCount: renderPlan.renderedPointCount,
    layout,
  }
}

function toCoreTimeSeriesDerivedColumn(
  series: TimeSeriesDerivedSeriesConfig,
): CoreTimeSeriesDerivedColumn {
  const derived: CoreTimeSeriesDerivedColumn = {
    kind: series.kind,
    sourceField: series.sourceField,
    field: series.field ?? series.key,
  }
  if (series.windowSize !== undefined) derived.windowSize = series.windowSize
  if (series.minimumSamples !== undefined) derived.minimumSamples = series.minimumSamples
  if (series.per !== undefined) derived.per = series.per
  if (series.scale !== undefined) derived.scale = series.scale
  if (series.offset !== undefined) derived.offset = series.offset
  return derived
}

function toDerivedTimeSeriesSeriesConfig(
  series: TimeSeriesDerivedSeriesConfig,
): TimeSeriesSeriesConfig {
  const derived: TimeSeriesSeriesConfig = {
    key: series.key,
    label: series.label,
    field: series.field ?? series.key,
  }
  if (series.color !== undefined) derived.color = series.color
  if (series.visible !== undefined) derived.visible = series.visible
  if (series.rgba !== undefined) derived.rgba = series.rgba
  if (series.lineWidth !== undefined) derived.lineWidth = series.lineWidth
  if (series.interpolation !== undefined) derived.interpolation = series.interpolation
  if (series.gapThreshold !== undefined) derived.gapThreshold = series.gapThreshold
  return derived
}

function toCoreTimeSeriesBand(band: TimeSeriesBandConfig): CoreTimeSeriesBand {
  if (band.kind === 'value-band') {
    const coreBand: CoreTimeSeriesBand = {
      kind: 'value-band',
      key: band.key,
      yStart: band.yStart,
      yEnd: band.yEnd,
    }
    if (band.label !== undefined) coreBand.label = band.label
    if (band.xRange !== undefined) coreBand.xRange = band.xRange
    if (band.fillRgba !== undefined) coreBand.fillColor = band.fillRgba
    if (band.lineRgba !== undefined) coreBand.lineColor = band.lineRgba
    if (band.lineWidth !== undefined) coreBand.lineWidth = band.lineWidth
    if (band.visible !== undefined) coreBand.visible = band.visible
    if (band.includeInYRange !== undefined) coreBand.includeInYRange = band.includeInYRange
    return coreBand
  }

  const coreBand: CoreTimeSeriesBand = {
    kind: 'envelope',
    key: band.key,
    lowerField: band.lowerField,
    upperField: band.upperField,
  }
  if (band.label !== undefined) coreBand.label = band.label
  if (band.fillRgba !== undefined) coreBand.fillColor = band.fillRgba
  if (band.lineRgba !== undefined) coreBand.lineColor = band.lineRgba
  if (band.lineWidth !== undefined) coreBand.lineWidth = band.lineWidth
  if (band.gapThreshold !== undefined) coreBand.gapThreshold = band.gapThreshold
  if (band.visible !== undefined) coreBand.visible = band.visible
  if (band.includeInYRange !== undefined) coreBand.includeInYRange = band.includeInYRange
  return coreBand
}

function toCoreTimeSeriesAnnotation(
  annotation: TimeSeriesAnnotationConfig,
): CoreTimeSeriesAnnotation {
  if (annotation.kind === 'x-line') {
    const coreAnnotation: CoreTimeSeriesAnnotation = {
      kind: 'x-line',
      key: annotation.key,
      x: annotation.x,
    }
    assignCommonAnnotationConfig(coreAnnotation, annotation)
    if (annotation.rgba !== undefined) coreAnnotation.color = annotation.rgba
    if (annotation.lineWidth !== undefined) coreAnnotation.lineWidth = annotation.lineWidth
    return coreAnnotation
  }

  if (annotation.kind === 'y-line') {
    const coreAnnotation: CoreTimeSeriesAnnotation = {
      kind: 'y-line',
      key: annotation.key,
      y: annotation.y,
    }
    assignCommonAnnotationConfig(coreAnnotation, annotation)
    if (annotation.rgba !== undefined) coreAnnotation.color = annotation.rgba
    if (annotation.lineWidth !== undefined) coreAnnotation.lineWidth = annotation.lineWidth
    return coreAnnotation
  }

  if (annotation.kind === 'x-range') {
    const coreAnnotation: CoreTimeSeriesAnnotation = {
      kind: 'x-range',
      key: annotation.key,
      xStart: annotation.xStart,
      xEnd: annotation.xEnd,
    }
    assignCommonAnnotationConfig(coreAnnotation, annotation)
    if (annotation.fillRgba !== undefined) coreAnnotation.fillColor = annotation.fillRgba
    if (annotation.lineRgba !== undefined) coreAnnotation.lineColor = annotation.lineRgba
    if (annotation.lineWidth !== undefined) coreAnnotation.lineWidth = annotation.lineWidth
    return coreAnnotation
  }

  if (annotation.kind === 'y-range') {
    const coreAnnotation: CoreTimeSeriesAnnotation = {
      kind: 'y-range',
      key: annotation.key,
      yStart: annotation.yStart,
      yEnd: annotation.yEnd,
    }
    assignCommonAnnotationConfig(coreAnnotation, annotation)
    if (annotation.fillRgba !== undefined) coreAnnotation.fillColor = annotation.fillRgba
    if (annotation.lineRgba !== undefined) coreAnnotation.lineColor = annotation.lineRgba
    if (annotation.lineWidth !== undefined) coreAnnotation.lineWidth = annotation.lineWidth
    return coreAnnotation
  }

  const coreAnnotation: CoreTimeSeriesAnnotation = {
    kind: 'ruler',
    key: annotation.key,
    xStart: annotation.xStart,
    xEnd: annotation.xEnd,
    yStart: annotation.yStart,
    yEnd: annotation.yEnd,
  }
  assignCommonAnnotationConfig(coreAnnotation, annotation)
  if (annotation.rgba !== undefined) coreAnnotation.color = annotation.rgba
  if (annotation.lineWidth !== undefined) coreAnnotation.lineWidth = annotation.lineWidth
  return coreAnnotation
}

function assignCommonAnnotationConfig(
  coreAnnotation: CoreTimeSeriesAnnotation,
  annotation: TimeSeriesAnnotationConfig,
): void {
  if (annotation.label !== undefined) coreAnnotation.label = annotation.label
  if (annotation.visible !== undefined) coreAnnotation.visible = annotation.visible
  if (annotation.includeInYRange !== undefined) {
    coreAnnotation.includeInYRange = annotation.includeInYRange
  }
  if (annotation.labelVisible !== undefined) coreAnnotation.labelVisible = annotation.labelVisible
}

function toCoreTimeSeriesEventMarker(
  marker: TimeSeriesEventMarkerConfig,
): CoreTimeSeriesEventMarker {
  const coreMarker: CoreTimeSeriesEventMarker = {
    key: marker.key,
    x: marker.x,
  }
  if (marker.label !== undefined) coreMarker.label = marker.label
  if (marker.eventType !== undefined) coreMarker.eventType = marker.eventType
  if (marker.placement !== undefined) coreMarker.placement = marker.placement
  if (marker.rgba !== undefined) coreMarker.color = marker.rgba
  if (marker.lineWidth !== undefined) coreMarker.lineWidth = marker.lineWidth
  if (marker.visible !== undefined) coreMarker.visible = marker.visible
  if (marker.labelVisible !== undefined) coreMarker.labelVisible = marker.labelVisible
  return coreMarker
}

function createTimeSeriesLayout(
  config: TimeSeriesConfig,
  renderPlan: TimeSeriesRenderPlan,
  legendItemCount: number,
  width: number,
  height: number,
): ChartLayout {
  return createChartLayout({
    width,
    height,
    padding: 8,
    xRange: renderPlan.xRelativeRange,
    yRange: renderPlan.yRange,
    legend: {
      visible: legendItemCount > 0,
      position: 'top',
      size: 42,
      gap: 6,
    },
    xAxis: {
      visible: true,
      size: 34,
      tickCount: 6,
      ...(config.xAxis?.label !== undefined ? { label: config.xAxis.label } : {}),
      ...(config.xAxis?.formatValue !== undefined ? { formatValue: config.xAxis.formatValue } : {}),
    },
    yAxis: {
      visible: true,
      size: 58,
      tickCount: 5,
      ...(config.yAxis?.label !== undefined ? { label: config.yAxis.label } : {}),
      ...(config.yAxis?.formatValue !== undefined ? { formatValue: config.yAxis.formatValue } : {}),
    },
    grid: {
      visible: true,
      xTickCount: 6,
      yTickCount: 5,
    },
  })
}

function buildSvgOptions(dimensions: ResolvedExportOptions, title: string) {
  return dimensions.background === undefined
    ? { title }
    : { title, background: dimensions.background }
}

export function TimeSeries(props: TimeSeriesProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Time series chart',
    aspectRatio,
    children,
    chartKey,
    className,
    config,
    data,
    dataZoom = false,
    onResize,
    renderer,
    streaming,
    style,
  } = props
  const containerRef = useRef<ChartContainerRef | null>(null)
  const generatedChartKey = useId()
  const [resizeKey, setResizeKey] = useState(0)
  const effectiveConfig = useMemo(
    () => (renderer === undefined ? config : { ...config, renderer }),
    [config, renderer],
  )
  const chartOptions: UseTimeSeriesOptions = {
    chartKey: chartKey ?? generatedChartKey,
    config: effectiveConfig,
    data,
    containerRef,
    resizeKey,
  }
  if (streaming !== undefined) chartOptions.streaming = streaming
  const chart = useTimeSeries(chartOptions)
  const dataZoomSeries = useMemo(
    () => resolveTimeSeriesDataZoomSeries(data, chart.config.series, chart.legendItems),
    [chart.config.series, chart.legendItems, data],
  )

  const handleResize = useCallback(
    (width: number, height: number, dpr: number) => {
      setResizeKey((value) => value + 1)
      onResize?.(width, height, dpr)
    },
    [onResize],
  )

  return (
    <ChartContainer
      ref={containerRef}
      ariaLabel={ariaLabel}
      onResize={handleResize}
      {...(ariaDescribedBy !== undefined ? { ariaDescribedBy } : {})}
      {...(aspectRatio !== undefined ? { aspectRatio } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(style !== undefined ? { style } : {})}
    >
      <ChartRegionZoomLayer
        containerRef={containerRef}
        fullRange={chart.fullRange}
        layout={chart.layout}
        onHoverChange={chart.handleHoverChange}
        onRangeChange={chart.setVisibleRange}
        syncedCursorX={chart.syncedCursorX}
        xOrigin={chart.renderPlan.xOrigin}
        xRange={chart.renderPlan.xRelativeRange}
        yRange={chart.renderPlan.yRange}
      />
      {dataZoom ? (
        <ChartDataZoom
          color={dataZoomSeries?.color}
          fullRange={chart.fullRange}
          layout={chart.layout}
          onRangeChange={chart.setVisibleRange}
          timestamps={data.timestamps}
          values={dataZoomSeries?.values}
          visibleRange={activeDataZoomRange(chart.visibleRange, chart.fullRange)}
        />
      ) : null}
      <ChartTooltip payload={chart.tooltipPayload} position={chart.tooltipPosition} />
      {typeof children === 'function' ? children(chart) : children}
    </ChartContainer>
  )
}

function rangeFromTimestamps(timestamps: Float64Array): readonly [number, number] {
  if (timestamps.length === 0) return EMPTY_RANGE

  const first = timestamps[0]
  const last = timestamps[timestamps.length - 1]
  if (first === undefined || last === undefined) return EMPTY_RANGE

  return [first, last]
}

function rangesEqual(left: readonly [number, number], right: readonly [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

function timestampInRange(timestamp: number, range: readonly [number, number]): boolean {
  return timestamp >= range[0] && timestamp <= range[1]
}

function activeDataZoomRange(
  visibleRange: readonly [number, number],
  fullRange: readonly [number, number],
): readonly [number, number] {
  return visibleRange[0] < visibleRange[1] ? visibleRange : fullRange
}

function resolveTimeSeriesDataZoomSeries(
  data: TimeSeriesColumnData,
  series: readonly TimeSeriesSeriesConfig[],
  legendItems: readonly ChartLegendItem[],
): { values: Float64Array; color: string } | undefined {
  for (const item of legendItems) {
    if (!item.visible) continue
    const match = series.find((candidate) => candidate.key === item.key)
    const values = match ? data.columns[match.field] : undefined
    if (values) return { values, color: item.color }
  }

  return undefined
}
