'use client'

import {
  buildHeatmapCommandFrame,
  buildHeatmapRenderPlan,
  buildSpectrogramCommandFrame,
  buildSpectrogramRenderPlan,
  type ChartFramePlugin,
  type ChartLayout,
  commandFrameToSvg,
  createChartLayout,
  type HeatmapDataSet,
  type HeatmapRenderPlan,
  type RenderContext,
  type RgbaColor,
  renderHeatmapPlan,
  renderSpectrogramPlan,
  type SpectrogramColorStop,
  type SpectrogramCommandFrame,
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

type MatrixPlan = SpectrogramRenderPlan | HeatmapRenderPlan

interface MatrixConfig<TPlan> {
  plugins?: readonly ChartFramePlugin<TPlan>[]
  orientation?: 'rotated'
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

export interface SpectrogramConfig extends MatrixConfig<SpectrogramRenderPlan> {}
export type HeatmapConfig = MatrixConfig<HeatmapRenderPlan>

export interface HeatmapStats extends ChartStats {
  sourceTileCount: number
  renderedTileCount: number
}

export interface SpectrogramStats extends HeatmapStats {
  timeBinCount: number
  frequencyBinCount: number
}

interface UseMatrixOptions<TData, TPlan> {
  config: MatrixConfig<TPlan>
  data: TData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseSpectrogramOptions
  extends UseMatrixOptions<SpectrogramMatrixData, SpectrogramRenderPlan> {}
export type UseHeatmapOptions = UseMatrixOptions<HeatmapDataSet, HeatmapRenderPlan>

interface UseMatrixReturn<TData, TPlan> {
  setData: (data: TData) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: HeatmapStats
  ready: boolean
  error: Error | null
  config: MatrixConfig<TPlan>
  renderPlan: TPlan
  dataRange: readonly [number, number]
  renderedTileCount: number
  layout: ChartLayout
}

export interface UseSpectrogramReturn
  extends UseMatrixReturn<SpectrogramMatrixData, SpectrogramRenderPlan> {
  stats: SpectrogramStats
}

export type UseHeatmapReturn = UseMatrixReturn<HeatmapDataSet, HeatmapRenderPlan>

interface MatrixProps<TData, TPlan, TChart = UseMatrixReturn<TData, TPlan>>
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: MatrixConfig<TPlan>
  data: TData
  renderer?: MatrixConfig<TPlan>['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: TChart) => ReactNode)
  pixelRatio?: number
}

export interface SpectrogramProps
  extends MatrixProps<SpectrogramMatrixData, SpectrogramRenderPlan, UseSpectrogramReturn> {}
export type HeatmapProps = MatrixProps<HeatmapDataSet, HeatmapRenderPlan>

interface MatrixFrameOptions<TPlan> {
  layout: ChartLayout
  plugins?: readonly ChartFramePlugin<TPlan>[]
}

interface MatrixPipeline<TData, TPlan> {
  title: string
  buildPlan: (data: TData, options: SpectrogramRenderOptions) => TPlan
  buildFrame: (
    plan: TPlan,
    width: number,
    height: number,
    options: MatrixFrameOptions<TPlan>,
  ) => SpectrogramCommandFrame
  render: (context: RenderContext, plan: TPlan, options: MatrixFrameOptions<TPlan>) => void
}

const SPECTROGRAM_PIPELINE: MatrixPipeline<SpectrogramMatrixData, SpectrogramRenderPlan> = {
  title: 'Spectrogram chart',
  buildPlan: buildSpectrogramRenderPlan,
  buildFrame: buildSpectrogramCommandFrame,
  render: renderSpectrogramPlan,
}

const HEATMAP_PIPELINE: MatrixPipeline<HeatmapDataSet, HeatmapRenderPlan> = {
  title: 'Heatmap chart',
  buildPlan: buildHeatmapRenderPlan,
  buildFrame: buildHeatmapCommandFrame,
  render: renderHeatmapPlan,
}

function withBinCounts(
  chart: UseMatrixReturn<SpectrogramMatrixData, SpectrogramRenderPlan>,
): UseSpectrogramReturn {
  const { timeBinCount, frequencyBinCount } = chart.renderPlan
  return { ...chart, stats: { ...chart.stats, timeBinCount, frequencyBinCount } }
}

export function useSpectrogram(options: UseSpectrogramOptions): UseSpectrogramReturn {
  return withBinCounts(useMatrixChart(options, SPECTROGRAM_PIPELINE))
}

export function useHeatmap(options: UseHeatmapOptions): UseHeatmapReturn {
  return useMatrixChart(options, HEATMAP_PIPELINE)
}

function useMatrixChart<TData, TPlan extends MatrixPlan>(
  options: UseMatrixOptions<TData, TPlan>,
  pipeline: MatrixPipeline<TData, TPlan>,
): UseMatrixReturn<TData, TPlan> {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<TData>(options.data)
  const [stats, setStats] = useState<ChartStats>(EMPTY_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    plugins: config.plugins,
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
    return pipeline.buildPlan(data, renderOptions)
  }, [
    colorStops,
    config.includeMissing,
    config.missingRgba,
    config.xAxis?.range,
    config.yAxis?.range,
    config.zAxis?.range,
    data,
    pipeline,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createMatrixLayout(config, renderPlan, dimensions?.width ?? 1, dimensions?.height ?? 1)
  }, [config, containerRef, renderPlan, resizeKey])

  useEffect(() => {
    if (!context) return

    void resizeKey

    const dimensions = containerRef.current?.dimensions
    if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
      context.resize(dimensions.width, dimensions.height, dimensions.dpr)
    }

    const started = performance.now()
    pipeline.render(context, renderPlan, {
      layout,
      ...(config.plugins ? { plugins: config.plugins } : {}),
    })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedTileCount,
    })
  }, [config.plugins, containerRef, context, layout, pipeline, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createMatrixLayout(
            config,
            renderPlan,
            dimensions.width,
            dimensions.height,
          )
          pipeline.render(exportContext, renderPlan, {
            layout: exportLayout,
            ...(config.plugins ? { plugins: config.plugins } : {}),
          })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            pipeline.buildFrame(renderPlan, dimensions.width, dimensions.height, {
              ...(config.plugins ? { plugins: config.plugins } : {}),
              layout: createMatrixLayout(config, renderPlan, dimensions.width, dimensions.height),
            }),
            buildSvgOptions(dimensions, pipeline.title),
          ),
      }),
    [config, containerRef, pipeline, renderPlan],
  )

  return {
    setData,
    exportImage,
    stats: {
      ...stats,
      pointCount: renderPlan.renderedTileCount,
      sourceTileCount: renderPlan.sourceTileCount,
      renderedTileCount: renderPlan.renderedTileCount,
    },
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

function createMatrixLayout<TPlan extends MatrixPlan>(
  config: MatrixConfig<TPlan>,
  renderPlan: TPlan,
  width: number,
  height: number,
): ChartLayout {
  return createChartLayout({
    width,
    height,
    ...(config.orientation ? { orientation: config.orientation } : {}),
    padding: 8,
    xRange: renderPlan.xRelativeRange,
    yRange: renderPlan.kind === 'heatmap' ? renderPlan.yRelativeRange : renderPlan.yRange,
    xAxis: {
      visible: true,
      size: 34,
      tickCount: 6,
      ...config.xAxis,
      ...(renderPlan.kind === 'heatmap' ||
      config.xAxis?.scale ||
      config.xAxis?.calendar ||
      config.xAxis?.tickValues ||
      config.xAxis?.rangePolicy
        ? { valueOffset: renderPlan.xOrigin }
        : {}),
    },
    yAxis: {
      visible: true,
      size: 58,
      tickCount: 5,
      ...config.yAxis,
      ...(renderPlan.kind === 'heatmap' ? { valueOffset: renderPlan.yOrigin } : {}),
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

export function Spectrogram({ children, ...props }: SpectrogramProps): JSX.Element {
  return (
    <MatrixChart {...props} pipeline={SPECTROGRAM_PIPELINE}>
      {typeof children === 'function' ? (chart) => children(withBinCounts(chart)) : children}
    </MatrixChart>
  )
}

export function Heatmap(props: HeatmapProps): JSX.Element {
  return <MatrixChart {...props} pipeline={HEATMAP_PIPELINE} />
}

function MatrixChart<TData, TPlan extends MatrixPlan>({
  pipeline,
  ...props
}: MatrixProps<TData, TPlan> & { pipeline: MatrixPipeline<TData, TPlan> }): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = pipeline.title,
    aspectRatio,
    children,
    chartKey,
    className,
    config,
    data,
    onResize,
    pixelRatio,
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
  const chart = useMatrixChart(
    {
      chartKey: chartKey ?? generatedChartKey,
      config: effectiveConfig,
      data,
      containerRef,
      resizeKey,
    },
    pipeline,
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
      {...(pixelRatio !== undefined ? { pixelRatio } : {})}
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
