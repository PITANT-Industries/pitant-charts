'use client'

import {
  buildDigitalChannelCommandFrame,
  buildDigitalChannelRenderPlan,
  type ChartLayout,
  type ChartPointerCoordinates,
  type DigitalChannelSeries as CoreDigitalChannelSeries,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  type DigitalChannelRenderOptions,
  type DigitalChannelRenderPlan,
  mapDataPointToChartPoint,
  type RgbaColor,
  renderDigitalChannelPlan,
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

export interface DigitalChannelColumnData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
  provenance?: ColumnarTooltipProvenanceMap
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface DigitalChannelConfigSeries extends SeriesConfig {
  field: string
  rgba?: RgbaColor
  lineWidth?: number
  gapThreshold?: number
  stateLabels?: Record<number, string>
}

export interface DigitalChannelConfig {
  channels: DigitalChannelConfigSeries[]
  xAxis?: AxisConfig & {
    gapThreshold?: number
  }
  yAxis?: AxisConfig
  channelHeight?: number
  channelGap?: number
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface DigitalChannelStats extends ChartStats {
  sourcePointCount: number
  renderedPointCount: number
  segmentCount: number
  lodLevel: number
  rawPointCount: number
  returnedPointCount: number
  dataLoading: boolean
}

export interface UseDigitalChannelOptions {
  config: DigitalChannelConfig
  data: DigitalChannelColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  streaming?: StreamingConfig
  resizeKey?: unknown
}

export interface UseDigitalChannelReturn {
  append: (data: DigitalChannelColumnData) => void
  setData: (data: DigitalChannelColumnData) => void
  visibleRange: readonly [number, number]
  setVisibleRange: (range: readonly [number, number]) => void
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string) => void
  tooltipPayload: ChartTooltipPayload | null
  tooltipPosition: { x: number; y: number } | null
  syncedCursorX: number | null
  handleHoverChange: (coordinates: ChartPointerCoordinates | null) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: DigitalChannelStats
  ready: boolean
  error: Error | null
  config: DigitalChannelConfig
  renderPlan: DigitalChannelRenderPlan
  dataRange: readonly [number, number]
  fullRange: readonly [number, number]
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }>
  renderedPointCount: number
  layout: ChartLayout
}

export interface DigitalChannelProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: DigitalChannelConfig
  data: DigitalChannelColumnData
  streaming?: StreamingConfig
  renderer?: DigitalChannelConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  dataZoom?: boolean
  children?: ReactNode | ((chart: UseDigitalChannelReturn) => ReactNode)
}

const EMPTY_TOOLTIP: ChartTooltipPayload | null = null
const EMPTY_DIGITAL_STATS: DigitalChannelStats = {
  ...EMPTY_STATS,
  sourcePointCount: 0,
  renderedPointCount: 0,
  segmentCount: 0,
  lodLevel: 0,
  rawPointCount: 0,
  returnedPointCount: 0,
  dataLoading: false,
}

export function useDigitalChannel(options: UseDigitalChannelOptions): UseDigitalChannelReturn {
  const { chartKey = 'digital-channel', config, containerRef, resizeKey, streaming } = options
  const [visibleRange, setVisibleRangeState] = useState<readonly [number, number]>(EMPTY_RANGE)
  const [stats, setStats] = useState<DigitalChannelStats>(EMPTY_DIGITAL_STATS)
  const [tooltipPayload, setTooltipPayload] = useState<ChartTooltipPayload | null>(EMPTY_TOOLTIP)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [syncedCursorX, setSyncedCursorX] = useState<number | null>(null)
  const sync = useChartSync(chartKey)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const { visibilityMap, toggleSeries } = useSeriesVisibility(config.channels)
  const legendItems = useLegendItems(config.channels, visibilityMap)
  const tooltipSeries = useMemo(
    () =>
      config.channels.map((channel) => ({
        ...channel,
        visible: visibilityMap[channel.key] ?? channel.visible !== false,
      })),
    [config.channels, visibilityMap],
  )

  const channelsForPlan: CoreDigitalChannelSeries[] = useMemo(
    () =>
      config.channels.map((channel, index) => {
        const planned: CoreDigitalChannelSeries = {
          key: channel.key,
          label: channel.label,
          field: channel.field,
          color:
            channel.rgba ??
            (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
          visible: visibilityMap[channel.key] ?? channel.visible !== false,
        }
        if (channel.lineWidth !== undefined) planned.lineWidth = channel.lineWidth
        if (channel.gapThreshold !== undefined) planned.gapThreshold = channel.gapThreshold
        if (channel.stateLabels !== undefined) planned.stateLabels = channel.stateLabels
        return planned
      }),
    [config.channels, visibilityMap],
  )

  const activeXRange =
    visibleRange[0] < visibleRange[1] ? (visibleRange as readonly [number, number]) : undefined
  const visibleFields = useMemo(
    () =>
      channelsForPlan
        .filter((channel) => channel.visible !== false)
        .map((channel) => channel.field),
    [channelsForPlan],
  )
  const targetPixels = useMemo(() => {
    void resizeKey
    return Math.max(
      1,
      Math.round(containerRef.current?.dimensions.width ?? options.data.timestamps.length),
    )
  }, [containerRef, options.data.timestamps.length, resizeKey])
  const viewport = useColumnarViewport({
    data: options.data,
    fields: visibleFields,
    ...(activeXRange ? { range: activeXRange } : {}),
    targetPixels,
  })

  const renderPlan = useMemo(() => {
    const renderOptions: DigitalChannelRenderOptions = {}
    if (activeXRange) renderOptions.xRange = activeXRange
    if (config.xAxis?.gapThreshold !== undefined) {
      renderOptions.gapThreshold = config.xAxis.gapThreshold
    }
    if (config.channelHeight !== undefined) renderOptions.channelHeight = config.channelHeight
    if (config.channelGap !== undefined) renderOptions.channelGap = config.channelGap

    return buildDigitalChannelRenderPlan(
      {
        timestamps: viewport.data.timestamps,
        columns: viewport.data.columns,
        channels: channelsForPlan,
      },
      renderOptions,
    )
  }, [
    activeXRange,
    channelsForPlan,
    config.channelGap,
    config.channelHeight,
    config.xAxis?.gapThreshold,
    viewport.data,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createDigitalChannelLayout(
      config,
      renderPlan,
      legendItems.length,
      channelsForPlan.length,
      dimensions?.width ?? 1,
      dimensions?.height ?? 1,
    )
  }, [channelsForPlan.length, containerRef, config, legendItems.length, renderPlan, resizeKey])

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
    renderDigitalChannelPlan(context, renderPlan, { layout })
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
    (nextData: DigitalChannelColumnData) => {
      viewport.setData(nextData)
      if (streaming?.liveEdge) {
        setVisibleRangeState(
          liveEdgeRange(new Float64Array(0), nextData.timestamps, streaming.windowSize),
        )
      }
    },
    [streaming?.liveEdge, streaming?.windowSize, viewport],
  )

  const append = useCallback(
    (nextData: DigitalChannelColumnData) => {
      const previousTimestamps = viewport.rawData.timestamps
      viewport.appendData(nextData)
      if (streaming?.liveEdge) {
        setVisibleRangeState(
          liveEdgeRange(previousTimestamps, nextData.timestamps, streaming.windowSize),
        )
      }
    },
    [streaming?.liveEdge, streaming?.windowSize, viewport],
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
          const exportLayout = createDigitalChannelLayout(
            config,
            renderPlan,
            legendItems.length,
            channelsForPlan.length,
            dimensions.width,
            dimensions.height,
          )
          renderDigitalChannelPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildDigitalChannelCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createDigitalChannelLayout(
                config,
                renderPlan,
                legendItems.length,
                channelsForPlan.length,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Digital channel chart'),
          ),
      }),
    [channelsForPlan.length, config, containerRef, legendItems.length, renderPlan],
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

function createDigitalChannelLayout(
  config: DigitalChannelConfig,
  renderPlan: DigitalChannelRenderPlan,
  legendItemCount: number,
  channelCount: number,
  width: number,
  height: number,
): ChartLayout {
  const yTickCount = Math.max(2, Math.min(8, channelCount + 1))
  return createChartLayout({
    width,
    height,
    padding: 8,
    xRange: renderPlan.xRelativeRange,
    yRange: renderPlan.yRange,
    legend: {
      visible: legendItemCount > 0,
      position: 'top',
      size: 38,
      gap: 6,
    },
    xAxis: {
      visible: true,
      size: 32,
      tickCount: 6,
      ...(config.xAxis?.label !== undefined ? { label: config.xAxis.label } : {}),
      ...(config.xAxis?.formatValue !== undefined ? { formatValue: config.xAxis.formatValue } : {}),
    },
    yAxis: {
      visible: true,
      size: 84,
      tickCount: yTickCount,
      ...(config.yAxis?.label !== undefined ? { label: config.yAxis.label } : {}),
      ...(config.yAxis?.formatValue !== undefined ? { formatValue: config.yAxis.formatValue } : {}),
    },
    grid: {
      visible: true,
      xTickCount: 6,
      yTickCount,
    },
  })
}

function buildSvgOptions(dimensions: ResolvedExportOptions, title: string) {
  return dimensions.background === undefined
    ? { title }
    : { title, background: dimensions.background }
}

export function DigitalChannel(props: DigitalChannelProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Digital channel chart',
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
  const chartOptions: UseDigitalChannelOptions = {
    chartKey: chartKey ?? generatedChartKey,
    config: effectiveConfig,
    data,
    containerRef,
    resizeKey,
  }
  if (streaming !== undefined) chartOptions.streaming = streaming
  const chart = useDigitalChannel(chartOptions)
  const dataZoomSeries = useMemo(
    () => resolveDigitalChannelDataZoomSeries(data, chart.config.channels, chart.legendItems),
    [chart.config.channels, chart.legendItems, data],
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

function resolveDigitalChannelDataZoomSeries(
  data: DigitalChannelColumnData,
  channels: readonly DigitalChannelConfigSeries[],
  legendItems: readonly ChartLegendItem[],
): { values: Float64Array; color: string } | undefined {
  for (const item of legendItems) {
    if (!item.visible) continue
    const match = channels.find((candidate) => candidate.key === item.key)
    const values = match ? data.columns[match.field] : undefined
    if (values) return { values, color: item.color }
  }

  return undefined
}
