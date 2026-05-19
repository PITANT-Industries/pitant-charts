'use client'

import {
  buildCorrelationMatrixCommandFrame,
  buildCorrelationMatrixRenderPlan,
  type ChartLayout,
  type CorrelationColorStop,
  type CorrelationMatrixDataSet,
  type CorrelationMatrixFrameOptions,
  type CorrelationMatrixRenderOptions,
  type CorrelationMatrixRenderPlan,
  type CorrelationMatrixValueLayout,
  type CorrelationVariable,
  commandFrameToSvg,
  createChartLayout,
  type RgbaColor,
  renderCorrelationMatrixPlan,
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
import type { AxisConfig, ChartStats, ExportOptions } from './use-chart.js'

export interface CorrelationMatrixData {
  variables: readonly CorrelationVariable[]
  values: Float32Array | Float64Array
  sampleCounts?: Uint16Array | Uint32Array | Int32Array | Float64Array
  missingCounts?: Uint16Array | Uint32Array | Int32Array | Float64Array
  mask?: Uint8Array
  valueLayout?: CorrelationMatrixValueLayout
}

export interface CorrelationColorStopConfig {
  value: number
  rgba: RgbaColor
}

export interface CorrelationMatrixLabelConfig {
  visible?: boolean
  maxCount?: number
}

export interface CorrelationMatrixConfig {
  valueRange?: readonly [number, number]
  minSampleCount?: number
  includeDiagonal?: boolean
  colorStops?: readonly CorrelationColorStopConfig[]
  labels?: CorrelationMatrixLabelConfig
  xAxis?: AxisConfig & {
    range?: readonly [number, number]
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
  }
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface CorrelationMatrixStats extends ChartStats {
  sourceVariableCount: number
  visibleVariableCount: number
  renderedCellCount: number
  missingCellCount: number
  lowSampleCellCount: number
  maskedCellCount: number
}

export interface UseCorrelationMatrixOptions {
  config: CorrelationMatrixConfig
  data: CorrelationMatrixData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseCorrelationMatrixReturn {
  setData: (data: CorrelationMatrixData) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: CorrelationMatrixStats
  ready: boolean
  error: Error | null
  config: CorrelationMatrixConfig
  renderPlan: CorrelationMatrixRenderPlan
  layout: ChartLayout
  renderedCellCount: number
}

export interface CorrelationMatrixProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: CorrelationMatrixConfig
  data: CorrelationMatrixData
  renderer?: CorrelationMatrixConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseCorrelationMatrixReturn) => ReactNode)
}

const EMPTY_CORRELATION_STATS: CorrelationMatrixStats = {
  ...EMPTY_STATS,
  sourceVariableCount: 0,
  visibleVariableCount: 0,
  renderedCellCount: 0,
  missingCellCount: 0,
  lowSampleCellCount: 0,
  maskedCellCount: 0,
}

export function useCorrelationMatrix(
  options: UseCorrelationMatrixOptions,
): UseCorrelationMatrixReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<CorrelationMatrixData>(options.data)
  const [stats, setStats] = useState<CorrelationMatrixStats>(EMPTY_CORRELATION_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const labelsVisible = config.labels?.visible !== false
  const maxLabelCount = config.labels?.maxCount

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const dataSet: CorrelationMatrixDataSet = useMemo(() => {
    const planned: CorrelationMatrixDataSet = {
      variables: data.variables,
      values: data.values,
    }
    if (data.sampleCounts !== undefined) planned.sampleCounts = data.sampleCounts
    if (data.missingCounts !== undefined) planned.missingCounts = data.missingCounts
    if (data.mask !== undefined) planned.mask = data.mask
    if (data.valueLayout !== undefined) planned.valueLayout = data.valueLayout
    return planned
  }, [
    data.mask,
    data.missingCounts,
    data.sampleCounts,
    data.valueLayout,
    data.values,
    data.variables,
  ])

  const colorStops = useMemo<readonly CorrelationColorStop[] | undefined>(
    () => config.colorStops?.map((stop) => ({ value: stop.value, color: stop.rgba })),
    [config.colorStops],
  )

  const renderPlan = useMemo(() => {
    const renderOptions: CorrelationMatrixRenderOptions = {}
    if (config.xAxis?.range !== undefined) renderOptions.columnRange = config.xAxis.range
    if (config.yAxis?.range !== undefined) renderOptions.rowRange = config.yAxis.range
    if (config.valueRange !== undefined) renderOptions.valueRange = config.valueRange
    if (config.minSampleCount !== undefined) renderOptions.minSampleCount = config.minSampleCount
    if (config.includeDiagonal !== undefined) renderOptions.includeDiagonal = config.includeDiagonal
    if (colorStops !== undefined) renderOptions.defaultColorStops = colorStops
    return buildCorrelationMatrixRenderPlan(dataSet, renderOptions)
  }, [
    colorStops,
    config.includeDiagonal,
    config.minSampleCount,
    config.valueRange,
    config.xAxis?.range,
    config.yAxis?.range,
    dataSet,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createCorrelationMatrixLayout(
      config,
      renderPlan,
      dimensions?.width ?? 1,
      dimensions?.height ?? 1,
    )
  }, [config, containerRef, renderPlan, resizeKey])

  useEffect(() => {
    setStats((previous) => ({
      ...previous,
      pointCount: renderPlan.renderedCellCount,
      sourceVariableCount: renderPlan.sourceVariableCount,
      visibleVariableCount: renderPlan.visibleVariableCount,
      renderedCellCount: renderPlan.renderedCellCount,
      missingCellCount: renderPlan.missingCellCount,
      lowSampleCellCount: renderPlan.lowSampleCellCount,
      maskedCellCount: renderPlan.maskedCellCount,
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
    renderCorrelationMatrixPlan(
      context,
      renderPlan,
      correlationFrameOptions(layout, labelsVisible, maxLabelCount),
    )
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedCellCount,
      sourceVariableCount: renderPlan.sourceVariableCount,
      visibleVariableCount: renderPlan.visibleVariableCount,
      renderedCellCount: renderPlan.renderedCellCount,
      missingCellCount: renderPlan.missingCellCount,
      lowSampleCellCount: renderPlan.lowSampleCellCount,
      maskedCellCount: renderPlan.maskedCellCount,
    })
  }, [containerRef, context, labelsVisible, layout, maxLabelCount, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createCorrelationMatrixLayout(
            config,
            renderPlan,
            dimensions.width,
            dimensions.height,
          )
          renderCorrelationMatrixPlan(exportContext, renderPlan, {
            ...correlationFrameOptions(exportLayout, labelsVisible, maxLabelCount),
          })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildCorrelationMatrixCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              ...correlationFrameOptions(
                createCorrelationMatrixLayout(
                  config,
                  renderPlan,
                  dimensions.width,
                  dimensions.height,
                ),
                labelsVisible,
                maxLabelCount,
              ),
            }),
            buildSvgOptions(dimensions, 'Correlation matrix'),
          ),
      }),
    [config, containerRef, labelsVisible, maxLabelCount, renderPlan],
  )

  return {
    setData,
    exportImage,
    stats,
    ready,
    error,
    config,
    renderPlan,
    layout,
    renderedCellCount: renderPlan.renderedCellCount,
  }
}

function correlationFrameOptions(
  layout: ChartLayout,
  labelsVisible: boolean,
  maxLabelCount: number | undefined,
): CorrelationMatrixFrameOptions {
  const options: CorrelationMatrixFrameOptions = {
    layout,
    guides: false,
    labels: labelsVisible,
  }
  if (maxLabelCount !== undefined) options.maxLabelCount = maxLabelCount
  return options
}

function createCorrelationMatrixLayout(
  config: CorrelationMatrixConfig,
  renderPlan: CorrelationMatrixRenderPlan,
  width: number,
  height: number,
): ChartLayout {
  return createChartLayout({
    width,
    height,
    padding: 8,
    xRange: renderPlan.xRelativeRange,
    yRange: renderPlan.yRange,
    xAxis: {
      visible: true,
      size: 34,
      tickCount: Math.min(6, Math.max(2, renderPlan.visibleVariableCount)),
      ...(config.xAxis?.label !== undefined ? { label: config.xAxis.label } : {}),
      ...(config.xAxis?.formatValue !== undefined ? { formatValue: config.xAxis.formatValue } : {}),
    },
    yAxis: {
      visible: true,
      size: 72,
      tickCount: Math.min(6, Math.max(2, renderPlan.visibleVariableCount)),
      ...(config.yAxis?.label !== undefined ? { label: config.yAxis.label } : {}),
      ...(config.yAxis?.formatValue !== undefined ? { formatValue: config.yAxis.formatValue } : {}),
    },
    grid: {
      visible: false,
      xTickCount: 0,
      yTickCount: 0,
    },
  })
}

function buildSvgOptions(dimensions: ResolvedExportOptions, title: string) {
  return dimensions.background === undefined
    ? { title }
    : { title, background: dimensions.background }
}

export function CorrelationMatrix(props: CorrelationMatrixProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Correlation matrix',
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
  const chart = useCorrelationMatrix({
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
