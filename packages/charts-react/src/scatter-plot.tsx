'use client'

import {
  buildScatterPlotCommandFrame,
  buildScatterPlotRenderPlan,
  type ChartLayout,
  type ScatterPlotSeries as CoreScatterPlotSeries,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  type RgbaColor,
  renderScatterPlotPlan,
  type ScatterPlotMode,
  type ScatterPlotRenderOptions,
  type ScatterPlotRenderPlan,
  type ScatterVector,
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

export interface ScatterPlotColumnData {
  columns: Record<string, ScatterVector>
}

export interface ScatterPlotSeriesConfig extends SeriesConfig {
  xField: string
  yField: string
  rgba?: RgbaColor
  pointSize?: number
}

export interface ScatterPlotConfig {
  series: ScatterPlotSeriesConfig[]
  xAxis?: AxisConfig & {
    range?: readonly [number, number]
    paddingRatio?: number
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
    paddingRatio?: number
  }
  maxRenderedPoints?: number
  pointSize?: number
  density?: {
    enabled?: boolean
    columns?: number
    rows?: number
    minPointCount?: number
    minAlpha?: number
    maxAlpha?: number
  }
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface ScatterPlotStats extends ChartStats {
  mode: ScatterPlotMode
  sourcePointCount: number
  filteredPointCount: number
  renderedPointCount: number
  densityCellCount: number
  commandCount: number
}

export interface UseScatterPlotOptions {
  config: ScatterPlotConfig
  data: ScatterPlotColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseScatterPlotReturn {
  setData: (data: ScatterPlotColumnData) => void
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: ScatterPlotStats
  ready: boolean
  error: Error | null
  config: ScatterPlotConfig
  renderPlan: ScatterPlotRenderPlan
  dataRange: readonly [number, number]
  layout: ChartLayout
}

export interface ScatterPlotProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: ScatterPlotConfig
  data: ScatterPlotColumnData
  renderer?: ScatterPlotConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseScatterPlotReturn) => ReactNode)
}

const EMPTY_SCATTER_STATS: ScatterPlotStats = {
  ...EMPTY_STATS,
  mode: 'points',
  sourcePointCount: 0,
  filteredPointCount: 0,
  renderedPointCount: 0,
  densityCellCount: 0,
  commandCount: 0,
}

export function useScatterPlot(options: UseScatterPlotOptions): UseScatterPlotReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<ScatterPlotColumnData>(options.data)
  const [stats, setStats] = useState<ScatterPlotStats>(EMPTY_SCATTER_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const { visibilityMap, toggleSeries } = useSeriesVisibility(config.series)
  const legendItems = useLegendItems(config.series, visibilityMap)

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const planSeries: CoreScatterPlotSeries[] = useMemo(
    () =>
      config.series.map((series, index) => {
        const planned: CoreScatterPlotSeries = {
          key: series.key,
          label: series.label,
          x: data.columns[series.xField] ?? new Float64Array(0),
          y: data.columns[series.yField] ?? new Float64Array(0),
          color:
            series.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
          visible: visibilityMap[series.key] ?? series.visible !== false,
        }
        if (series.pointSize !== undefined) planned.pointSize = series.pointSize
        return planned
      }),
    [config.series, data.columns, visibilityMap],
  )

  const renderPlan = useMemo(() => {
    const renderOptions: ScatterPlotRenderOptions = {}
    if (config.xAxis?.range !== undefined) renderOptions.xRange = config.xAxis.range
    if (config.yAxis?.range !== undefined) renderOptions.yRange = config.yAxis.range
    if (config.xAxis?.paddingRatio !== undefined) {
      renderOptions.xPaddingRatio = config.xAxis.paddingRatio
    }
    if (config.yAxis?.paddingRatio !== undefined) {
      renderOptions.yPaddingRatio = config.yAxis.paddingRatio
    }
    if (config.maxRenderedPoints !== undefined) {
      renderOptions.maxRenderedPoints = config.maxRenderedPoints
    }
    if (config.pointSize !== undefined) renderOptions.pointSize = config.pointSize
    if (config.density !== undefined) renderOptions.density = config.density
    return buildScatterPlotRenderPlan({ series: planSeries }, renderOptions)
  }, [
    config.density,
    config.maxRenderedPoints,
    config.pointSize,
    config.xAxis?.paddingRatio,
    config.xAxis?.range,
    config.yAxis?.paddingRatio,
    config.yAxis?.range,
    planSeries,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createScatterPlotLayout(
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
      pointCount:
        renderPlan.mode === 'density' ? renderPlan.densityCellCount : renderPlan.renderedPointCount,
      mode: renderPlan.mode,
      sourcePointCount: renderPlan.sourcePointCount,
      filteredPointCount: renderPlan.filteredPointCount,
      renderedPointCount: renderPlan.renderedPointCount,
      densityCellCount: renderPlan.densityCellCount,
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
    renderScatterPlotPlan(context, renderPlan, { layout })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount:
        renderPlan.mode === 'density' ? renderPlan.densityCellCount : renderPlan.renderedPointCount,
      mode: renderPlan.mode,
      sourcePointCount: renderPlan.sourcePointCount,
      filteredPointCount: renderPlan.filteredPointCount,
      renderedPointCount: renderPlan.renderedPointCount,
      densityCellCount: renderPlan.densityCellCount,
      commandCount: renderPlan.commandCount,
    })
  }, [containerRef, context, layout, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createScatterPlotLayout(
            config,
            renderPlan,
            legendItems.length,
            dimensions.width,
            dimensions.height,
          )
          renderScatterPlotPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildScatterPlotCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createScatterPlotLayout(
                config,
                renderPlan,
                legendItems.length,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Scatter plot'),
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
    layout,
  }
}

function createScatterPlotLayout(
  config: ScatterPlotConfig,
  renderPlan: ScatterPlotRenderPlan,
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

export function ScatterPlot(props: ScatterPlotProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Scatter plot',
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
  const chart = useScatterPlot({
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
