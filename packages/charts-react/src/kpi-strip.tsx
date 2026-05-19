'use client'

import {
  buildKpiStripCommandFrame,
  buildKpiStripRenderPlan,
  type KpiStripItem as CoreKpiStripItem,
  commandFrameToSvg,
  createChartLayout,
  type KpiSparkline,
  type KpiStatus,
  type KpiStripRenderOptions,
  type KpiStripRenderPlan,
  type RgbaColor,
  renderKpiStripPlan,
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
import {
  EMPTY_STATS,
  exportCanvasImage,
  type ResolvedExportOptions,
  useRenderer,
} from './chart-runtime.js'
import type { ChartStats, ExportOptions } from './use-chart.js'

export interface KpiSparklineConfig {
  values: Float32Array | Float64Array
  valueRange?: readonly [number, number]
  rgba?: RgbaColor
  width?: number
  visible?: boolean
}

export interface KpiStripItemData {
  key: string
  label: string
  value: number
  unit?: string
  status?: KpiStatus
  freshnessSeconds?: number
  quality?: number
  sparkline?: KpiSparklineConfig
  target?: number
  lowerLimit?: number
  upperLimit?: number
  visible?: boolean
}

export interface KpiStripData {
  items: readonly KpiStripItemData[]
}

export interface KpiStripConfig {
  columns?: number
  maxItems?: number
  labels?: {
    visible?: boolean
    maxCount?: number
  }
  sparklinePointLimit?: number
  cardGapRatio?: number
  cardPaddingRatio?: number
  backgroundRgba?: RgbaColor
  borderRgba?: RgbaColor
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface KpiStripStats extends ChartStats {
  sourceItemCount: number
  renderedItemCount: number
  sparklinePointCount: number
  alarmCount: number
  warningCount: number
  staleCount: number
  commandCount: number
}

export interface UseKpiStripOptions {
  config: KpiStripConfig
  data: KpiStripData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseKpiStripReturn {
  setData: (data: KpiStripData) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: KpiStripStats
  ready: boolean
  error: Error | null
  config: KpiStripConfig
  renderPlan: KpiStripRenderPlan
  renderedItemCount: number
}

export interface KpiStripProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: KpiStripConfig
  data: KpiStripData
  renderer?: KpiStripConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseKpiStripReturn) => ReactNode)
}

const EMPTY_KPI_STRIP_STATS: KpiStripStats = {
  ...EMPTY_STATS,
  sourceItemCount: 0,
  renderedItemCount: 0,
  sparklinePointCount: 0,
  alarmCount: 0,
  warningCount: 0,
  staleCount: 0,
  commandCount: 0,
}

export function useKpiStrip(options: UseKpiStripOptions): UseKpiStripReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<KpiStripData>(options.data)
  const [stats, setStats] = useState<KpiStripStats>(EMPTY_KPI_STRIP_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const items = useMemo(
    () =>
      data.items.map((item): CoreKpiStripItem => {
        const planned: CoreKpiStripItem = {
          key: item.key,
          label: item.label,
          value: item.value,
        }
        if (item.unit !== undefined) planned.unit = item.unit
        if (item.status !== undefined) planned.status = item.status
        if (item.freshnessSeconds !== undefined) planned.freshnessSeconds = item.freshnessSeconds
        if (item.quality !== undefined) planned.quality = item.quality
        if (item.sparkline !== undefined) planned.sparkline = toCoreSparkline(item.sparkline)
        if (item.target !== undefined) planned.target = item.target
        if (item.lowerLimit !== undefined) planned.lowerLimit = item.lowerLimit
        if (item.upperLimit !== undefined) planned.upperLimit = item.upperLimit
        if (item.visible !== undefined) planned.visible = item.visible
        return planned
      }),
    [data.items],
  )

  const renderPlan = useMemo(() => {
    const renderOptions: KpiStripRenderOptions = {}
    if (config.columns !== undefined) renderOptions.columns = config.columns
    if (config.maxItems !== undefined) renderOptions.maxItems = config.maxItems
    if (config.sparklinePointLimit !== undefined) {
      renderOptions.sparklinePointLimit = config.sparklinePointLimit
    }
    if (config.cardGapRatio !== undefined) renderOptions.cardGapRatio = config.cardGapRatio
    if (config.cardPaddingRatio !== undefined)
      renderOptions.cardPaddingRatio = config.cardPaddingRatio
    if (config.backgroundRgba !== undefined) renderOptions.backgroundColor = config.backgroundRgba
    if (config.borderRgba !== undefined) renderOptions.borderColor = config.borderRgba
    return buildKpiStripRenderPlan({ items }, renderOptions)
  }, [
    config.backgroundRgba,
    config.borderRgba,
    config.cardGapRatio,
    config.cardPaddingRatio,
    config.columns,
    config.maxItems,
    config.sparklinePointLimit,
    items,
  ])

  useEffect(() => {
    setStats((previous) => ({
      ...previous,
      pointCount: renderPlan.renderedItemCount,
      sourceItemCount: renderPlan.sourceItemCount,
      renderedItemCount: renderPlan.renderedItemCount,
      sparklinePointCount: renderPlan.sparklinePointCount,
      alarmCount: renderPlan.statusCounts.alarm,
      warningCount: renderPlan.statusCounts.warning,
      staleCount: renderPlan.statusCounts.stale + renderPlan.statusCounts.offline,
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
    renderKpiStripPlan(
      context,
      renderPlan,
      createKpiStripFrameOptions(
        renderPlan,
        dimensions?.width ?? 1,
        dimensions?.height ?? 1,
        config.labels?.visible !== false,
        config.labels?.maxCount,
      ),
    )
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedItemCount,
      sourceItemCount: renderPlan.sourceItemCount,
      renderedItemCount: renderPlan.renderedItemCount,
      sparklinePointCount: renderPlan.sparklinePointCount,
      alarmCount: renderPlan.statusCounts.alarm,
      warningCount: renderPlan.statusCounts.warning,
      staleCount: renderPlan.statusCounts.stale + renderPlan.statusCounts.offline,
      commandCount: renderPlan.commandCount,
    })
  }, [
    config.labels?.maxCount,
    config.labels?.visible,
    containerRef,
    context,
    renderPlan,
    resizeKey,
  ])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          renderKpiStripPlan(
            exportContext,
            renderPlan,
            createKpiStripFrameOptions(
              renderPlan,
              dimensions.width,
              dimensions.height,
              config.labels?.visible !== false,
              config.labels?.maxCount,
            ),
          )
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildKpiStripCommandFrame(
              renderPlan,
              dimensions.width,
              dimensions.height,
              createKpiStripFrameOptions(
                renderPlan,
                dimensions.width,
                dimensions.height,
                config.labels?.visible !== false,
                config.labels?.maxCount,
              ),
            ),
            buildSvgOptions(dimensions, 'KPI strip'),
          ),
      }),
    [config.labels?.maxCount, config.labels?.visible, containerRef, renderPlan],
  )

  return {
    setData,
    exportImage,
    stats,
    ready,
    error,
    config,
    renderPlan,
    renderedItemCount: renderPlan.renderedItemCount,
  }
}

function toCoreSparkline(sparkline: KpiSparklineConfig): KpiSparkline {
  const planned: KpiSparkline = {
    values: sparkline.values,
  }
  if (sparkline.valueRange !== undefined) planned.valueRange = sparkline.valueRange
  if (sparkline.rgba !== undefined) planned.color = sparkline.rgba
  if (sparkline.width !== undefined) planned.width = sparkline.width
  if (sparkline.visible !== undefined) planned.visible = sparkline.visible
  return planned
}

function createKpiStripLayout(renderPlan: KpiStripRenderPlan, width: number, height: number) {
  return createChartLayout({
    width,
    height,
    padding: 8,
    xRange: renderPlan.xRelativeRange,
    yRange: renderPlan.yRange,
    xAxis: { visible: false, size: 0, tickCount: 0 },
    yAxis: { visible: false, size: 0, tickCount: 0 },
    grid: { visible: false, xTickCount: 0, yTickCount: 0 },
    minPlotWidth: 96,
    minPlotHeight: 64,
  })
}

function createKpiStripFrameOptions(
  renderPlan: KpiStripRenderPlan,
  width: number,
  height: number,
  labels: boolean,
  maxLabelCount: number | undefined,
) {
  const frameOptions = {
    layout: createKpiStripLayout(renderPlan, width, height),
    labels,
  }
  return maxLabelCount === undefined ? frameOptions : { ...frameOptions, maxLabelCount }
}

function buildSvgOptions(dimensions: ResolvedExportOptions, title: string) {
  return dimensions.background === undefined
    ? { title }
    : { title, background: dimensions.background }
}

export function KpiStrip(props: KpiStripProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'KPI strip',
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
  const chart = useKpiStrip({
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
