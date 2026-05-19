'use client'

import {
  buildDistributionCommandFrame,
  buildDistributionRenderPlan,
  type ChartLayout,
  type DistributionMarker as CoreDistributionMarker,
  type DistributionSeries as CoreDistributionSeries,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  type DistributionMarkerKind,
  type DistributionRenderOptions,
  type DistributionRenderPlan,
  type RgbaColor,
  renderDistributionPlan,
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
import type { ChartLegendItem } from './chart-legend.js'
import {
  EMPTY_STATS,
  exportCanvasImage,
  type ResolvedExportOptions,
  useLegendItems,
  useRenderer,
  useSeriesVisibility,
} from './chart-runtime.js'
import type { AxisConfig, ChartStats, ExportOptions, SeriesConfig } from './use-chart.js'

export interface DistributionColumnData {
  binStarts: Float64Array
  binEnds: Float64Array
  columns: Record<string, Float64Array>
}

export interface DistributionSeriesConfig extends SeriesConfig {
  field: string
  rgba?: RgbaColor
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
  barWidthRatio?: number
}

export interface DistributionMarkerConfig {
  key: string
  value: number
  kind?: DistributionMarkerKind
  label?: string
  rgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface DistributionConfig {
  series: DistributionSeriesConfig[]
  markers?: DistributionMarkerConfig[]
  xAxis?: AxisConfig & {
    range?: readonly [number, number]
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
    baseline?: number
    paddingRatio?: number
  }
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface DistributionStats extends ChartStats {
  sourceBinCount: number
  renderedBinCount: number
  markerCount: number
  commandCount: number
}

export interface UseDistributionOptions {
  config: DistributionConfig
  data: DistributionColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseDistributionReturn {
  setData: (data: DistributionColumnData) => void
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: DistributionStats
  ready: boolean
  error: Error | null
  config: DistributionConfig
  renderPlan: DistributionRenderPlan
  dataRange: readonly [number, number]
  renderedBinCount: number
  layout: ChartLayout
}

export interface DistributionProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: DistributionConfig
  data: DistributionColumnData
  renderer?: DistributionConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseDistributionReturn) => ReactNode)
}

const EMPTY_DISTRIBUTION_STATS: DistributionStats = {
  ...EMPTY_STATS,
  sourceBinCount: 0,
  renderedBinCount: 0,
  markerCount: 0,
  commandCount: 0,
}

export function useDistribution(options: UseDistributionOptions): UseDistributionReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<DistributionColumnData>(options.data)
  const [stats, setStats] = useState<DistributionStats>(EMPTY_DISTRIBUTION_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const { visibilityMap, toggleSeries } = useSeriesVisibility(config.series)
  const legendItems = useLegendItems(config.series, visibilityMap)

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const planSeries: CoreDistributionSeries[] = useMemo(
    () =>
      config.series.map((series, index) => {
        const planned: CoreDistributionSeries = {
          key: series.key,
          label: series.label,
          binStarts: data.binStarts,
          binEnds: data.binEnds,
          values: data.columns[series.field] ?? new Float64Array(0),
          color:
            series.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
          visible: visibilityMap[series.key] ?? series.visible !== false,
        }
        if (series.fillRgba !== undefined) planned.fillColor = series.fillRgba
        if (series.lineRgba !== undefined) planned.lineColor = series.lineRgba
        if (series.lineWidth !== undefined) planned.lineWidth = series.lineWidth
        if (series.barWidthRatio !== undefined) planned.barWidthRatio = series.barWidthRatio
        return planned
      }),
    [config.series, data.binEnds, data.binStarts, data.columns, visibilityMap],
  )
  const markers = useMemo(
    () => (config.markers ?? []).map(toCoreDistributionMarker),
    [config.markers],
  )

  const renderPlan = useMemo(() => {
    const renderOptions: DistributionRenderOptions = {}
    if (config.xAxis?.range !== undefined) renderOptions.xRange = config.xAxis.range
    if (config.yAxis?.range !== undefined) renderOptions.yRange = config.yAxis.range
    if (config.yAxis?.baseline !== undefined) renderOptions.baseline = config.yAxis.baseline
    if (config.yAxis?.paddingRatio !== undefined) {
      renderOptions.yPaddingRatio = config.yAxis.paddingRatio
    }
    return buildDistributionRenderPlan(
      {
        series: planSeries,
        markers,
      },
      renderOptions,
    )
  }, [
    config.xAxis?.range,
    config.yAxis?.baseline,
    config.yAxis?.paddingRatio,
    config.yAxis?.range,
    markers,
    planSeries,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createDistributionLayout(
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
      pointCount: renderPlan.renderedBinCount,
      sourceBinCount: renderPlan.sourceBinCount,
      renderedBinCount: renderPlan.renderedBinCount,
      markerCount: renderPlan.markers.length,
      commandCount: renderPlan.commandCount,
    }))
  }, [renderPlan])

  useEffect(() => {
    if (!context) return

    void resizeKey

    const dimensions = containerRef.current?.dimensions
    if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
      context.resize(dimensions.width, dimensions.height, dimensions.dpr)
    }

    const started = performance.now()
    renderDistributionPlan(context, renderPlan, { layout })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedBinCount,
      sourceBinCount: renderPlan.sourceBinCount,
      renderedBinCount: renderPlan.renderedBinCount,
      markerCount: renderPlan.markers.length,
      commandCount: renderPlan.commandCount,
    })
  }, [containerRef, context, layout, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createDistributionLayout(
            config,
            renderPlan,
            legendItems.length,
            dimensions.width,
            dimensions.height,
          )
          renderDistributionPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildDistributionCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createDistributionLayout(
                config,
                renderPlan,
                legendItems.length,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Distribution chart'),
          ),
      }),
    [config, containerRef, legendItems.length, renderPlan],
  )

  return {
    setData,
    legendItems,
    toggleSeries,
    exportImage,
    stats,
    ready,
    error,
    config,
    renderPlan,
    dataRange: renderPlan.xRange,
    renderedBinCount: renderPlan.renderedBinCount,
    layout,
  }
}

function toCoreDistributionMarker(marker: DistributionMarkerConfig): CoreDistributionMarker {
  const coreMarker: CoreDistributionMarker = {
    key: marker.key,
    value: marker.value,
  }
  if (marker.kind !== undefined) coreMarker.kind = marker.kind
  if (marker.label !== undefined) coreMarker.label = marker.label
  if (marker.rgba !== undefined) coreMarker.color = marker.rgba
  if (marker.lineWidth !== undefined) coreMarker.lineWidth = marker.lineWidth
  if (marker.visible !== undefined) coreMarker.visible = marker.visible
  if (marker.labelVisible !== undefined) coreMarker.labelVisible = marker.labelVisible
  return coreMarker
}

function createDistributionLayout(
  config: DistributionConfig,
  renderPlan: DistributionRenderPlan,
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

export function Distribution(props: DistributionProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Distribution chart',
    aspectRatio,
    children,
    chartKey,
    className,
    config,
    data,
    onResize,
    renderer,
    style,
  } = props
  const containerRef = useRef<ChartContainerRef | null>(null)
  const generatedChartKey = useId()
  const [resizeKey, setResizeKey] = useState(0)
  const effectiveConfig = useMemo(
    () => (renderer === undefined ? config : { ...config, renderer }),
    [config, renderer],
  )
  const chart = useDistribution({
    chartKey: chartKey ?? generatedChartKey,
    config: effectiveConfig,
    data,
    containerRef,
    resizeKey,
  })

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
      {typeof children === 'function' ? children(chart) : children}
    </ChartContainer>
  )
}
