'use client'

import {
  addTimeSeriesDerivedColumns,
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  type ChartFramePlugin,
  type ChartLayout,
  type ChartPointerCoordinates,
  type TimeSeriesAnnotation as CoreTimeSeriesAnnotation,
  type TimeSeriesAnomalyTrack as CoreTimeSeriesAnomalyTrack,
  type TimeSeriesBand as CoreTimeSeriesBand,
  type TimeSeriesDerivedColumn as CoreTimeSeriesDerivedColumn,
  type TimeSeriesEventMarker as CoreTimeSeriesEventMarker,
  type TimeSeriesSeries as CoreTimeSeriesSeries,
  type TimeSeriesSpcRuleMarker as CoreTimeSeriesSpcRuleMarker,
  type TimeSeriesSpcTrack as CoreTimeSeriesSpcTrack,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  mapDataPointToChartPoint,
  type NumericRange,
  type RgbaColor,
  renderTimeSeriesPlan,
  type TimeSeriesAnomalyTrackPlacement,
  type TimeSeriesAnomalyTrackReviewerState,
  type TimeSeriesDerivedColumnKind,
  type TimeSeriesEventMarkerPlacement,
  type TimeSeriesEventMarkerType,
  type TimeSeriesInterpolation,
  type TimeSeriesMark,
  type TimeSeriesPathBuilder,
  type TimeSeriesPointOptions,
  type TimeSeriesRenderOptions,
  type TimeSeriesRenderPlan,
  type TimeSeriesSpcChartKind,
  type TimeSeriesSpcRuleSeverity,
  type TimeSeriesStackOptions,
  type TimeSeriesYAxisOptions,
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
import { ChartRegionZoomLayer, type ChartRegionZoomLayerProps } from './chart-interactions.js'
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
  useSyncedSeriesVisibility,
} from './chart-runtime.js'
import { resolveSyncedCursor, useChartSync } from './chart-sync-group.js'
import type { ChartTooltipPayload, ChartTooltipProps } from './chart-tooltip.js'
import { ChartTooltip } from './chart-tooltip.js'
import {
  buildColumnarTooltipPayload,
  type ColumnarTooltipProvenanceMap,
  findNearestColumnarTimestamp,
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
  sampleKinds?: Record<string, Uint8Array>
  seriesTimestamps?: Record<string, Float64Array>
  provenance?: ColumnarTooltipProvenanceMap
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface TimeSeriesSeriesConfig extends SeriesConfig {
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
  field: string
  rgba?: RgbaColor
  lineWidth?: number
  interpolation?: TimeSeriesInterpolation
  gapThreshold?: number
  mark?: TimeSeriesMark
  baseline?: number
  fillRgba?: RgbaColor
  barWidthRatio?: number
  points?: TimeSeriesPointOptions
  spanGaps?: boolean
  path?: TimeSeriesPathBuilder
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
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
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
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
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
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
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
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
  kind: 'y-range'
  yStart: number
  yEnd: number
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesRulerAnnotationConfig extends TimeSeriesBaseAnnotationConfig {
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
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

export interface TimeSeriesAnomalyTrackConfig {
  key: string
  label?: string
  scoreField: string
  threshold?: number
  modelVersion?: string
  reviewerState?: TimeSeriesAnomalyTrackReviewerState
  placement?: TimeSeriesAnomalyTrackPlacement
  laneHeightRatio?: number
  laneOffsetRatio?: number
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  thresholdRgba?: RgbaColor
  lineWidth?: number
  gapThreshold?: number
  visible?: boolean
}

export interface TimeSeriesSpcRuleMarkerConfig {
  key: string
  x: number
  label?: string
  rule?: string
  severity?: TimeSeriesSpcRuleSeverity
  rgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface TimeSeriesSpcTrackConfig {
  /** Named Y axis. Omit to use the primary axis. */
  yAxisKey?: string
  key: string
  label?: string
  chartKind?: TimeSeriesSpcChartKind
  centerLine: number
  upperControlLimit?: number
  lowerControlLimit?: number
  upperWarningLimit?: number
  lowerWarningLimit?: number
  xRange?: readonly [number, number]
  zoneFillRgba?: RgbaColor
  warningFillRgba?: RgbaColor
  centerLineRgba?: RgbaColor
  controlLineRgba?: RgbaColor
  warningLineRgba?: RgbaColor
  markerRgba?: RgbaColor
  markerLineWidth?: number
  lineWidth?: number
  markers?: readonly TimeSeriesSpcRuleMarkerConfig[]
  visible?: boolean
  includeInYRange?: boolean
}

export type TimeSeriesYAxisConfig = TimeSeriesYAxisOptions

export interface TimeSeriesConfig {
  series: TimeSeriesSeriesConfig[]
  derivedSeries?: TimeSeriesDerivedSeriesConfig[]
  bands?: TimeSeriesBandConfig[]
  annotations?: TimeSeriesAnnotationConfig[]
  eventMarkers?: TimeSeriesEventMarkerConfig[]
  anomalyTracks?: TimeSeriesAnomalyTrackConfig[]
  spcTracks?: TimeSeriesSpcTrackConfig[]
  xAxis?: AxisConfig & {
    gapThreshold?: number
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
    paddingRatio?: number
  }
  /** Named Y axes in display order. The first is the primary axis. */
  yAxes?: readonly TimeSeriesYAxisConfig[]
  plugins?: readonly ChartFramePlugin<TimeSeriesRenderPlan>[]
  stack?: TimeSeriesStackOptions
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

export interface TimeSeriesInteractionOptions
  extends Pick<
    ChartRegionZoomLayerProps,
    | 'crosshair'
    | 'hoverLock'
    | 'keyboardNavigation'
    | 'onSelectionChange'
    | 'pan'
    | 'selectedRanges'
    | 'selection'
    | 'snapHover'
    | 'touchNavigation'
    | 'wheelZoom'
  > {
  snapToSample?: boolean
  /** Dim other series when a sample is within the given CSS pixel distance. */
  focusClosestSeries?: boolean | number
}

export interface UseTimeSeriesOptions {
  config: TimeSeriesConfig
  data: TimeSeriesColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  streaming?: StreamingConfig
  resizeKey?: unknown
  interaction?: TimeSeriesInteractionOptions
}

export interface UseTimeSeriesReturn {
  append: (data: TimeSeriesColumnData) => void
  setData: (data: TimeSeriesColumnData) => void
  visibleRange: readonly [number, number]
  setVisibleRange: (range: readonly [number, number]) => void
  visibleYRange: NumericRange | null
  /** Set null to restore the configured or automatically fitted primary Y range. */
  setVisibleYRange: (range: NumericRange | null) => void
  snapHover: (coordinates: ChartPointerCoordinates) => ChartPointerCoordinates
  focusedSeriesKey: string | null
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string, visible?: boolean) => void
  tooltipPayload: ChartTooltipPayload | null
  tooltipPosition: { x: number; y: number } | null
  syncedCursorX: number | null
  syncedCursorY: number | null
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
  pixelRatio?: number
  tooltip?: Omit<ChartTooltipProps, 'payload' | 'position'>
  interaction?: TimeSeriesInteractionOptions
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
  const {
    chartKey = 'time-series',
    config,
    containerRef,
    interaction,
    resizeKey,
    streaming,
  } = options
  const [visibleRange, setVisibleRangeState] = useState<readonly [number, number]>(EMPTY_RANGE)
  const [visibleYRange, setVisibleYRangeState] = useState<NumericRange | null>(null)
  const [stats, setStats] = useState<TimeSeriesStats>(EMPTY_TIMESERIES_STATS)
  const [tooltipPayload, setTooltipPayload] = useState<ChartTooltipPayload | null>(EMPTY_TOOLTIP)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [syncedCursorX, setSyncedCursorX] = useState<number | null>(null)
  const [syncedCursorY, setSyncedCursorY] = useState<number | null>(null)
  const [focusedSeriesKey, setFocusedSeriesKey] = useState<string | null>(null)
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
  const { visibilityMap, toggleSeries } = useSyncedSeriesVisibility(effectiveSeries, sync)

  useEffect(() => {
    if (!sync.canReceive('focus') || sync.focusSource === undefined) return
    const key = sync.syncState.focusedSeriesKey
    setFocusedSeriesKey(key ? sync.resolveSeriesKey(key, sync.focusSource) : null)
  }, [sync.canReceive, sync.focusSource, sync.resolveSeriesKey, sync.syncState.focusedSeriesKey])
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
        if (series.yAxisKey !== undefined) planned.yAxisKey = series.yAxisKey
        if (series.lineWidth !== undefined) planned.lineWidth = series.lineWidth
        if (series.interpolation !== undefined) planned.interpolation = series.interpolation
        if (series.gapThreshold !== undefined) planned.gapThreshold = series.gapThreshold
        if (series.mark !== undefined) planned.mark = series.mark
        if (series.baseline !== undefined) planned.baseline = series.baseline
        if (series.fillRgba !== undefined) planned.fillColor = series.fillRgba
        if (series.barWidthRatio !== undefined) planned.barWidthRatio = series.barWidthRatio
        if (series.points !== undefined) planned.points = series.points
        if (series.spanGaps !== undefined) planned.spanGaps = series.spanGaps
        if (series.path !== undefined) planned.path = series.path
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
  const planAnomalyTracks: CoreTimeSeriesAnomalyTrack[] = useMemo(
    () => (config.anomalyTracks ?? []).map(toCoreTimeSeriesAnomalyTrack),
    [config.anomalyTracks],
  )
  const planSpcTracks: CoreTimeSeriesSpcTrack[] = useMemo(
    () => (config.spcTracks ?? []).map(toCoreTimeSeriesSpcTrack),
    [config.spcTracks],
  )

  const activeXRange =
    visibleRange[0] < visibleRange[1] ? (visibleRange as readonly [number, number]) : undefined
  const activeYRange = visibleYRange ?? config.yAxis?.range
  const namedYAxes = useMemo(() => {
    if (!config.yAxes || !visibleYRange) return config.yAxes
    const primaryIndex = config.yAxes.findIndex((axis) => axis.key.trim().length > 0)
    return config.yAxes.map((axis, index) =>
      index === primaryIndex ? { ...axis, range: visibleYRange } : axis,
    )
  }, [config.yAxes, visibleYRange])
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
    for (const track of planAnomalyTracks) {
      if (track.visible === false) continue
      fields.add(track.scoreField)
    }
    return Array.from(fields)
  }, [planAnomalyTracks, planBands, planSeries])
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
    if (namedYAxes !== undefined) renderOptions.yAxes = namedYAxes
    if (config.xAxis?.gapThreshold !== undefined) {
      renderOptions.gapThreshold = config.xAxis.gapThreshold
    }
    if (config.interpolation !== undefined) renderOptions.interpolation = config.interpolation
    if (config.stack !== undefined) renderOptions.stack = config.stack
    if (config.yAxis?.scale !== undefined) renderOptions.yScale = config.yAxis.scale
    if (config.yAxis?.paddingRatio !== undefined) {
      renderOptions.yPaddingRatio = config.yAxis.paddingRatio
    }

    return buildTimeSeriesRenderPlan(
      {
        timestamps: viewport.data.timestamps,
        columns: viewport.data.columns,
        ...(viewport.data.sampleKinds !== undefined
          ? { sampleKinds: viewport.data.sampleKinds }
          : {}),
        ...(viewport.data.seriesTimestamps !== undefined
          ? { seriesTimestamps: viewport.data.seriesTimestamps }
          : {}),
        series: planSeries,
        bands: planBands,
        annotations: planAnnotations,
        eventMarkers: planEventMarkers,
        anomalyTracks: planAnomalyTracks,
        spcTracks: planSpcTracks,
      },
      renderOptions,
    )
  }, [
    activeXRange,
    activeYRange,
    config.interpolation,
    config.stack,
    config.xAxis?.gapThreshold,
    config.yAxis?.paddingRatio,
    config.yAxis?.scale,
    namedYAxes,
    planAnnotations,
    planAnomalyTracks,
    planBands,
    planEventMarkers,
    planSpcTracks,
    planSeries,
    viewport.data,
  ])

  const tooltipSeries = useMemo(() => {
    const axes = new Map(renderPlan.yAxes?.map((axis) => [axis.key, axis]))
    const primaryKey = renderPlan.yAxes?.[0]?.key ?? 'y'
    return effectiveSeries.map((series) => {
      const axisKey = series.yAxisKey ?? primaryKey
      const axis = axes.get(axisKey)
      const isPrimary = axisKey === primaryKey
      const axisConfigured = isPrimary || axis !== undefined
      const formatValue = axis?.formatValue ?? (isPrimary ? config.yAxis?.formatValue : undefined)
      return {
        ...series,
        axisConfigured,
        visible: axisConfigured && (visibilityMap[series.key] ?? series.visible !== false),
        ...(formatValue !== undefined ? { formatValue } : {}),
      }
    })
  }, [config.yAxis?.formatValue, effectiveSeries, renderPlan.yAxes, visibilityMap])
  const allLegendItems = useLegendItems(effectiveSeries, visibilityMap)
  const legendItems = useMemo(
    () => allLegendItems.filter((_, index) => tooltipSeries[index]?.axisConfigured),
    [allLegendItems, tooltipSeries],
  )

  const fullRange = useMemo(() => fullTimeSeriesRange(viewport.rawData), [viewport.rawData])
  const drawPlan = useMemo(
    () =>
      focusedSeriesKey !== null && renderPlan.series.some(({ key }) => key === focusedSeriesKey)
        ? {
            ...renderPlan,
            series: renderPlan.series.map((series) =>
              series.key === focusedSeriesKey ? series : dimTimeSeries(series),
            ),
          }
        : renderPlan,
    [focusedSeriesKey, renderPlan],
  )

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
    renderTimeSeriesPlan(context, drawPlan, {
      layout,
      ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
    })
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
  }, [config.plugins, containerRef, context, drawPlan, layout, renderPlan, resizeKey, viewport])

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
    if (!sync.canReceive('xRange')) return
    const range = sync.syncState.xRange
    if (!range) return
    setVisibleRangeState((current) => (rangesEqual(current, range) ? current : range))
  }, [sync.canReceive, sync.syncState.xRange])

  const setVisibleYRange = useCallback(
    (range: NumericRange | null) => {
      if (range && (!range.every(Number.isFinite) || range[0] >= range[1])) return
      setVisibleYRangeState(range)
      sync.updateYRange(range)
    },
    [sync.updateYRange],
  )

  useEffect(() => {
    if (sync.canReceive('yRange')) setVisibleYRangeState(sync.syncState.yRange ?? null)
  }, [sync.canReceive, sync.syncState.yRange])

  const snapHover = useCallback(
    (coordinates: ChartPointerCoordinates): ChartPointerCoordinates => {
      const selected = interaction?.snapHover?.(coordinates) ?? coordinates
      if (!interaction?.snapToSample) return selected
      const nearest = findNearestColumnarTimestamp(viewport.rawData, selected.dataX)
      if (!nearest || !timestampInRange(nearest.timestamp, renderPlan.xRange)) return selected
      const point = mapDataPointToChartPoint({
        x: nearest.timestamp,
        y: selected.dataY,
        layout,
        xRange: renderPlan.xRelativeRange,
        yRange: renderPlan.yRange,
        xValueOffset: renderPlan.xOrigin,
        clampToPlot: true,
      })
      const plotX = point.x - layout.plotArea.x
      return {
        ...selected,
        chartX: point.x,
        plotX,
        plotRatioX: plotX / Math.max(1, layout.plotArea.width),
        dataX: nearest.timestamp,
        relativeDataX: nearest.timestamp - renderPlan.xOrigin,
      }
    },
    [interaction, layout, renderPlan, viewport.rawData],
  )

  const handleHoverChange = useCallback(
    (coordinates: ChartPointerCoordinates | null) => {
      if (!coordinates) {
        setTooltipPayload(null)
        setTooltipPosition(null)
        setSyncedCursorX(null)
        setSyncedCursorY(null)
        setFocusedSeriesKey(null)
        if (focusedSeriesKey !== null) sync.updateSeriesFocus(null)
        sync.updateCursor(null)
        return
      }

      const payload = buildColumnarTooltipPayload({
        data: viewport.rawData,
        series: tooltipSeries,
        timestamp: coordinates.dataX,
        formatX: config.xAxis?.formatValue,
      })
      setTooltipPayload(payload)
      setTooltipPosition(payload ? { x: coordinates.chartX, y: coordinates.chartY } : null)
      const focused =
        payload &&
        interaction?.focusClosestSeries !== undefined &&
        interaction.focusClosestSeries !== false
          ? findClosestSeries(
              payload,
              coordinates,
              renderPlan,
              layout,
              interaction.focusClosestSeries,
            )
          : null
      setFocusedSeriesKey(focused)
      if (focused !== focusedSeriesKey) sync.updateSeriesFocus(focused)
      setSyncedCursorX(null)
      setSyncedCursorY(null)
      sync.updateCursor(payload?.timestamp ?? null, {
        xRatio: coordinates.plotRatioX,
        yRatio: coordinates.plotRatioY,
        y: coordinates.dataY,
      })
    },
    [
      config.xAxis?.formatValue,
      focusedSeriesKey,
      interaction?.focusClosestSeries,
      layout,
      renderPlan,
      sync,
      tooltipSeries,
      viewport.rawData,
    ],
  )

  useEffect(() => {
    if (!sync.canReceive('cursor')) return
    const cursor = resolveSyncedCursor(sync.syncState, sync.cursorOptions, {
      layout,
      xRange: renderPlan.xRelativeRange,
      yRange: renderPlan.yRange,
      xOrigin: renderPlan.xOrigin,
    })
    const payload =
      cursor.timestamp !== null
        ? buildColumnarTooltipPayload({
            data: viewport.rawData,
            series: tooltipSeries,
            timestamp: cursor.timestamp,
            formatX: config.xAxis?.formatValue,
          })
        : null
    setTooltipPayload(payload)
    setTooltipPosition(
      payload && cursor.x !== null
        ? { x: cursor.x, y: cursor.y ?? layout.plotArea.y + layout.plotArea.height / 2 }
        : null,
    )
    setSyncedCursorX(cursor.x)
    setSyncedCursorY(cursor.y)
  }, [
    config.xAxis?.formatValue,
    layout,
    renderPlan.xOrigin,
    renderPlan.xRelativeRange,
    renderPlan.yRange,
    sync.canReceive,
    sync.cursorOptions,
    sync.syncState,
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
          renderTimeSeriesPlan(exportContext, renderPlan, {
            layout: exportLayout,
            ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
          })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildTimeSeriesCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              ...(config.plugins !== undefined ? { plugins: config.plugins } : {}),
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
    visibleYRange,
    setVisibleYRange,
    snapHover,
    focusedSeriesKey,
    legendItems,
    toggleSeries,
    tooltipPayload,
    tooltipPosition,
    syncedCursorX,
    syncedCursorY,
    handleHoverChange,
    exportImage,
    stats,
    ready,
    error: error ?? viewport.error,
    config,
    renderPlan,
    dataRange: renderPlan.xRange,
    fullRange,
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
  const {
    kind: _kind,
    sourceField: _sourceField,
    windowSize: _windowSize,
    minimumSamples: _minimumSamples,
    per: _per,
    scale: _scale,
    offset: _offset,
    ...seriesConfig
  } = series
  return { ...seriesConfig, field: series.field ?? series.key }
}

function toCoreTimeSeriesBand(band: TimeSeriesBandConfig): CoreTimeSeriesBand {
  if (band.kind === 'value-band') {
    const coreBand: CoreTimeSeriesBand = {
      kind: 'value-band',
      key: band.key,
      yStart: band.yStart,
      yEnd: band.yEnd,
    }
    if (band.yAxisKey !== undefined) coreBand.yAxisKey = band.yAxisKey
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
  if (band.yAxisKey !== undefined) coreBand.yAxisKey = band.yAxisKey
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
    if (annotation.yAxisKey !== undefined) coreAnnotation.yAxisKey = annotation.yAxisKey
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
    if (annotation.yAxisKey !== undefined) coreAnnotation.yAxisKey = annotation.yAxisKey
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
  if (annotation.yAxisKey !== undefined) coreAnnotation.yAxisKey = annotation.yAxisKey
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

function toCoreTimeSeriesAnomalyTrack(
  track: TimeSeriesAnomalyTrackConfig,
): CoreTimeSeriesAnomalyTrack {
  const coreTrack: CoreTimeSeriesAnomalyTrack = {
    key: track.key,
    scoreField: track.scoreField,
  }
  if (track.label !== undefined) coreTrack.label = track.label
  if (track.threshold !== undefined) coreTrack.threshold = track.threshold
  if (track.modelVersion !== undefined) coreTrack.modelVersion = track.modelVersion
  if (track.reviewerState !== undefined) coreTrack.reviewerState = track.reviewerState
  if (track.placement !== undefined) coreTrack.placement = track.placement
  if (track.laneHeightRatio !== undefined) coreTrack.laneHeightRatio = track.laneHeightRatio
  if (track.laneOffsetRatio !== undefined) coreTrack.laneOffsetRatio = track.laneOffsetRatio
  if (track.fillRgba !== undefined) coreTrack.fillColor = track.fillRgba
  if (track.lineRgba !== undefined) coreTrack.lineColor = track.lineRgba
  if (track.thresholdRgba !== undefined) coreTrack.thresholdColor = track.thresholdRgba
  if (track.lineWidth !== undefined) coreTrack.lineWidth = track.lineWidth
  if (track.gapThreshold !== undefined) coreTrack.gapThreshold = track.gapThreshold
  if (track.visible !== undefined) coreTrack.visible = track.visible
  return coreTrack
}

function toCoreTimeSeriesSpcRuleMarker(
  marker: TimeSeriesSpcRuleMarkerConfig,
): CoreTimeSeriesSpcRuleMarker {
  const coreMarker: CoreTimeSeriesSpcRuleMarker = {
    key: marker.key,
    x: marker.x,
  }
  if (marker.label !== undefined) coreMarker.label = marker.label
  if (marker.rule !== undefined) coreMarker.rule = marker.rule
  if (marker.severity !== undefined) coreMarker.severity = marker.severity
  if (marker.rgba !== undefined) coreMarker.color = marker.rgba
  if (marker.lineWidth !== undefined) coreMarker.lineWidth = marker.lineWidth
  if (marker.visible !== undefined) coreMarker.visible = marker.visible
  if (marker.labelVisible !== undefined) coreMarker.labelVisible = marker.labelVisible
  return coreMarker
}

function toCoreTimeSeriesSpcTrack(track: TimeSeriesSpcTrackConfig): CoreTimeSeriesSpcTrack {
  const coreTrack: CoreTimeSeriesSpcTrack = {
    key: track.key,
    centerLine: track.centerLine,
  }
  if (track.label !== undefined) coreTrack.label = track.label
  if (track.yAxisKey !== undefined) coreTrack.yAxisKey = track.yAxisKey
  if (track.chartKind !== undefined) coreTrack.chartKind = track.chartKind
  if (track.upperControlLimit !== undefined) coreTrack.upperControlLimit = track.upperControlLimit
  if (track.lowerControlLimit !== undefined) coreTrack.lowerControlLimit = track.lowerControlLimit
  if (track.upperWarningLimit !== undefined) coreTrack.upperWarningLimit = track.upperWarningLimit
  if (track.lowerWarningLimit !== undefined) coreTrack.lowerWarningLimit = track.lowerWarningLimit
  if (track.xRange !== undefined) coreTrack.xRange = [track.xRange[0], track.xRange[1]]
  if (track.zoneFillRgba !== undefined) coreTrack.zoneFillColor = track.zoneFillRgba
  if (track.warningFillRgba !== undefined) coreTrack.warningFillColor = track.warningFillRgba
  if (track.centerLineRgba !== undefined) coreTrack.centerLineColor = track.centerLineRgba
  if (track.controlLineRgba !== undefined) coreTrack.controlLineColor = track.controlLineRgba
  if (track.warningLineRgba !== undefined) coreTrack.warningLineColor = track.warningLineRgba
  if (track.markerRgba !== undefined) coreTrack.markerColor = track.markerRgba
  if (track.markerLineWidth !== undefined) coreTrack.markerLineWidth = track.markerLineWidth
  if (track.lineWidth !== undefined) coreTrack.lineWidth = track.lineWidth
  if (track.markers !== undefined) {
    coreTrack.markers = track.markers.map(toCoreTimeSeriesSpcRuleMarker)
  }
  if (track.visible !== undefined) coreTrack.visible = track.visible
  if (track.includeInYRange !== undefined) coreTrack.includeInYRange = track.includeInYRange
  return coreTrack
}

function createTimeSeriesLayout(
  config: TimeSeriesConfig,
  renderPlan: TimeSeriesRenderPlan,
  legendItemCount: number,
  width: number,
  height: number,
): ChartLayout {
  const { side: legacySide, ...primaryAxis } = config.yAxis ?? {}
  const primaryDefaults = {
    ...primaryAxis,
    ...(legacySide === 'left' || legacySide === 'right' ? { side: legacySide } : {}),
  }
  const yAxes = renderPlan.yAxes?.map((axis, index) => ({
    visible: true,
    size: 58,
    tickCount: 5,
    ...(index === 0 ? primaryDefaults : undefined),
    ...axis,
  }))
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
      ...config.xAxis,
      valueOffset: renderPlan.xOrigin,
    },
    yAxis: {
      visible: true,
      size: 58,
      tickCount: 5,
      ...config.yAxis,
    },
    ...(yAxes !== undefined ? { yAxes } : {}),
    grid: { visible: true },
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
    interaction,
    onResize,
    pixelRatio,
    renderer,
    streaming,
    style,
    tooltip,
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
  if (interaction !== undefined) chartOptions.interaction = interaction
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
      {...(pixelRatio !== undefined ? { pixelRatio } : {})}
      {...(ariaDescribedBy !== undefined ? { ariaDescribedBy } : {})}
      {...(aspectRatio !== undefined ? { aspectRatio } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(style !== undefined ? { style } : {})}
    >
      <ChartRegionZoomLayer
        {...interaction}
        containerRef={containerRef}
        fullRange={chart.fullRange}
        layout={chart.layout}
        onHoverChange={chart.handleHoverChange}
        onRangeChange={chart.setVisibleRange}
        onYRangeChange={chart.setVisibleYRange}
        snapHover={chart.snapHover}
        syncedCursorX={chart.syncedCursorX}
        syncedCursorY={chart.syncedCursorY}
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
          timestamps={dataZoomSeries?.timestamps ?? data.timestamps}
          values={dataZoomSeries?.values}
          visibleRange={activeDataZoomRange(chart.visibleRange, chart.fullRange)}
        />
      ) : null}
      <ChartTooltip {...tooltip} payload={chart.tooltipPayload} position={chart.tooltipPosition} />
      {typeof children === 'function' ? children(chart) : children}
    </ChartContainer>
  )
}

function dimTimeSeries(
  series: TimeSeriesRenderPlan['series'][number],
): TimeSeriesRenderPlan['series'][number] {
  return {
    ...series,
    style: { ...series.style, color: dimColor(series.style.color) },
    ...(series.fillColor !== undefined ? { fillColor: dimColor(series.fillColor) } : {}),
    ...(series.points?.color !== undefined
      ? { points: { ...series.points, color: dimColor(series.points.color) } }
      : {}),
  }
}

function dimColor([r, g, b, alpha]: RgbaColor): RgbaColor {
  return [r, g, b, alpha * 0.25]
}

function findClosestSeries(
  tooltip: ChartTooltipPayload,
  coordinates: ChartPointerCoordinates,
  plan: TimeSeriesRenderPlan,
  layout: ChartLayout,
  proximity: boolean | number,
): string | null {
  let nearest: string | null = null
  let distance = typeof proximity === 'number' ? proximity : 24
  const { plotArea } = layout
  for (const row of tooltip.series) {
    if (row.value === null) continue
    const series = plan.series.find((candidate) => candidate.key === row.key)
    if (!series) continue
    const axis = plan.yAxes?.find(({ key }) => key === series.yAxisKey)
    const projection = axis
      ? layout.yAxes?.find(({ key }) => key === axis.key)?.projection
      : layout.yProjection
    const range = axis?.range ?? plan.yRange
    const ratio = projection?.toRatio(row.value) ?? (row.value - range[0]) / (range[1] - range[0])
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) continue
    const sampleY = (1 - ratio) * plotArea.height
    const delta = Math.abs(coordinates.plotY - sampleY)
    if (delta <= distance) {
      distance = delta
      nearest = row.key
    }
  }
  return nearest
}

function fullTimeSeriesRange(data: TimeSeriesColumnData): NumericRange {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const timeline of [data.timestamps, ...Object.values(data.seriesTimestamps ?? {})]) {
    if (timeline.length === 0) continue
    const range = rangeFromTimestamps(timeline)
    start = Math.min(start, range[0])
    end = Math.max(end, range[1])
  }
  return Number.isFinite(start) && Number.isFinite(end) ? [start, end] : EMPTY_RANGE
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
): { values: Float64Array; color: string; timestamps: Float64Array } | undefined {
  for (const item of legendItems) {
    if (!item.visible) continue
    const match = series.find((candidate) => candidate.key === item.key)
    if (!match) continue
    const values = data.columns[match.field]
    if (values) {
      return {
        values,
        color: item.color,
        timestamps: data.seriesTimestamps?.[match.field] ?? data.timestamps,
      }
    }
  }

  return undefined
}
