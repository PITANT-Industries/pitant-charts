'use client'

import {
  buildSpectrogramCommandFrame,
  buildSpectrogramRenderPlan,
  type ChartLayout,
  commandFrameToSvg,
  createChartLayout,
  type RgbaColor,
  renderSpectrogramPlan,
  type SpectrogramColorStop,
  type SpectrogramRenderOptions,
  type SpectrogramRenderPlan,
  type SpectrogramValueLayout,
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

export interface SpectrogramMatrixData {
  timeBins: Float64Array
  frequencyBins: Float64Array
  values: Float32Array | Float64Array
  valueLayout?: SpectrogramValueLayout
  timeBinWidth?: number
  frequencyBinWidth?: number
}

export interface SpectrogramColorStopConfig {
  value: number
  rgba: RgbaColor
}

export interface SpectrogramConfig {
  colorStops?: readonly SpectrogramColorStopConfig[]
  missingRgba?: RgbaColor
  includeMissing?: boolean
  xAxis?: AxisConfig & {
    range?: readonly [number, number]
  }
  yAxis?: AxisConfig & {
    range?: readonly [number, number]
  }
  zAxis?: {
    range?: readonly [number, number]
    label?: string
    formatValue?: (value: number) => string
  }
  renderer?: 'webgpu' | 'canvas2d' | 'auto'
}

export interface SpectrogramStats extends ChartStats {
  sourceTileCount: number
  renderedTileCount: number
  timeBinCount: number
  frequencyBinCount: number
}

export interface UseSpectrogramOptions {
  config: SpectrogramConfig
  data: SpectrogramMatrixData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseSpectrogramReturn {
  setData: (data: SpectrogramMatrixData) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: SpectrogramStats
  ready: boolean
  error: Error | null
  config: SpectrogramConfig
  renderPlan: SpectrogramRenderPlan
  dataRange: readonly [number, number]
  renderedTileCount: number
  layout: ChartLayout
}

export interface SpectrogramProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: SpectrogramConfig
  data: SpectrogramMatrixData
  renderer?: SpectrogramConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseSpectrogramReturn) => ReactNode)
}

const EMPTY_SPECTROGRAM_STATS: SpectrogramStats = {
  ...EMPTY_STATS,
  sourceTileCount: 0,
  renderedTileCount: 0,
  timeBinCount: 0,
  frequencyBinCount: 0,
}

export function useSpectrogram(options: UseSpectrogramOptions): UseSpectrogramReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<SpectrogramMatrixData>(options.data)
  const [stats, setStats] = useState<SpectrogramStats>(EMPTY_SPECTROGRAM_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const colorStops = useMemo(() => config.colorStops?.map(toCoreColorStop), [config.colorStops])

  const renderPlan = useMemo(() => {
    const renderOptions: SpectrogramRenderOptions = {}
    if (config.xAxis?.range !== undefined) renderOptions.xRange = config.xAxis.range
    if (config.yAxis?.range !== undefined) renderOptions.yRange = config.yAxis.range
    if (config.zAxis?.range !== undefined) renderOptions.zRange = config.zAxis.range
    if (config.missingRgba !== undefined) renderOptions.missingColor = config.missingRgba
    if (config.includeMissing !== undefined) renderOptions.includeMissing = config.includeMissing
    if (colorStops !== undefined) renderOptions.defaultColorStops = colorStops
    return buildSpectrogramRenderPlan(
      {
        timeBins: data.timeBins,
        frequencyBins: data.frequencyBins,
        values: data.values,
        ...(data.valueLayout !== undefined ? { valueLayout: data.valueLayout } : {}),
        ...(data.timeBinWidth !== undefined ? { timeBinWidth: data.timeBinWidth } : {}),
        ...(data.frequencyBinWidth !== undefined
          ? { frequencyBinWidth: data.frequencyBinWidth }
          : {}),
      },
      renderOptions,
    )
  }, [
    colorStops,
    config.includeMissing,
    config.missingRgba,
    config.xAxis?.range,
    config.yAxis?.range,
    config.zAxis?.range,
    data.frequencyBinWidth,
    data.frequencyBins,
    data.timeBinWidth,
    data.timeBins,
    data.valueLayout,
    data.values,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createSpectrogramLayout(
      config,
      renderPlan,
      dimensions?.width ?? 1,
      dimensions?.height ?? 1,
    )
  }, [config, containerRef, renderPlan, resizeKey])

  useEffect(() => {
    setStats((previous) => ({
      ...previous,
      pointCount: renderPlan.renderedTileCount,
      sourceTileCount: renderPlan.sourceTileCount,
      renderedTileCount: renderPlan.renderedTileCount,
      timeBinCount: renderPlan.timeBinCount,
      frequencyBinCount: renderPlan.frequencyBinCount,
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
    renderSpectrogramPlan(context, renderPlan, { layout })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedTileCount,
      sourceTileCount: renderPlan.sourceTileCount,
      renderedTileCount: renderPlan.renderedTileCount,
      timeBinCount: renderPlan.timeBinCount,
      frequencyBinCount: renderPlan.frequencyBinCount,
    })
  }, [containerRef, context, layout, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createSpectrogramLayout(
            config,
            renderPlan,
            dimensions.width,
            dimensions.height,
          )
          renderSpectrogramPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildSpectrogramCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createSpectrogramLayout(
                config,
                renderPlan,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Spectrogram chart'),
          ),
      }),
    [config, containerRef, renderPlan],
  )

  return {
    setData,
    exportImage,
    stats,
    ready,
    error,
    config,
    renderPlan,
    dataRange: renderPlan.xRange,
    renderedTileCount: renderPlan.renderedTileCount,
    layout,
  }
}

function toCoreColorStop(stop: SpectrogramColorStopConfig): SpectrogramColorStop {
  return {
    value: stop.value,
    color: stop.rgba,
  }
}

function createSpectrogramLayout(
  config: SpectrogramConfig,
  renderPlan: SpectrogramRenderPlan,
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

export function Spectrogram(props: SpectrogramProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Spectrogram chart',
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
  const chart = useSpectrogram({
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
