'use client'

import {
  buildSpectrumCommandFrame,
  buildSpectrumRenderPlan,
  type ChartLayout,
  type SpectrumFrequencyBand as CoreSpectrumFrequencyBand,
  type SpectrumPeakMarker as CoreSpectrumPeakMarker,
  type SpectrumSeries as CoreSpectrumSeries,
  commandFrameToSvg,
  createChartLayout,
  DEFAULT_CHART_COLORS,
  type RgbaColor,
  renderSpectrumPlan,
  type SpectrumRenderOptions,
  type SpectrumRenderPlan,
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

export interface SpectrumColumnData {
  frequencies: Float64Array
  columns: Record<string, Float64Array>
}

export interface SpectrumSeriesConfig extends SeriesConfig {
  field: string
  rgba?: RgbaColor
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
  binWidth?: number
  barWidthRatio?: number
}

export interface SpectrumPeakMarkerConfig {
  key: string
  frequency: number
  magnitude?: number
  label?: string
  rgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface SpectrumFrequencyBandConfig {
  key: string
  frequencyStart: number
  frequencyEnd: number
  label?: string
  fillRgba?: RgbaColor
  lineRgba?: RgbaColor
  lineWidth?: number
  visible?: boolean
}

export interface SpectrumConfig {
  series: SpectrumSeriesConfig[]
  peakMarkers?: SpectrumPeakMarkerConfig[]
  bands?: SpectrumFrequencyBandConfig[]
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

export interface SpectrumStats extends ChartStats {
  sourceBinCount: number
  renderedBinCount: number
  segmentCount: number
  peakMarkerCount: number
}

export interface UseSpectrumOptions {
  config: SpectrumConfig
  data: SpectrumColumnData
  containerRef: RefObject<ChartContainerRef | null>
  chartKey?: string
  resizeKey?: unknown
}

export interface UseSpectrumReturn {
  setData: (data: SpectrumColumnData) => void
  legendItems: readonly ChartLegendItem[]
  toggleSeries: (key: string) => void
  exportImage: (format: 'png' | 'svg', options?: ExportOptions) => Promise<Blob>
  stats: SpectrumStats
  ready: boolean
  error: Error | null
  config: SpectrumConfig
  renderPlan: SpectrumRenderPlan
  dataRange: readonly [number, number]
  renderedBinCount: number
  layout: ChartLayout
}

export interface SpectrumProps
  extends Pick<
    ChartContainerProps,
    'className' | 'style' | 'aspectRatio' | 'ariaLabel' | 'ariaDescribedBy'
  > {
  config: SpectrumConfig
  data: SpectrumColumnData
  renderer?: SpectrumConfig['renderer']
  onResize?: (width: number, height: number, dpr: number) => void
  chartKey?: string
  children?: ReactNode | ((chart: UseSpectrumReturn) => ReactNode)
}

const EMPTY_SPECTRUM_STATS: SpectrumStats = {
  ...EMPTY_STATS,
  sourceBinCount: 0,
  renderedBinCount: 0,
  segmentCount: 0,
  peakMarkerCount: 0,
}

export function useSpectrum(options: UseSpectrumOptions): UseSpectrumReturn {
  const { config, containerRef, resizeKey } = options
  const [data, setData] = useState<SpectrumColumnData>(options.data)
  const [stats, setStats] = useState<SpectrumStats>(EMPTY_SPECTRUM_STATS)
  const { context, ready, error } = useRenderer({
    containerRef,
    renderer: config.renderer ?? 'auto',
  })
  const { visibilityMap, toggleSeries } = useSeriesVisibility(config.series)
  const legendItems = useLegendItems(config.series, visibilityMap)

  useEffect(() => {
    setData(options.data)
  }, [options.data])

  const planSeries: CoreSpectrumSeries[] = useMemo(
    () =>
      config.series.map((series, index) => {
        const planned: CoreSpectrumSeries = {
          key: series.key,
          label: series.label,
          frequencies: data.frequencies,
          magnitudes: data.columns[series.field] ?? new Float64Array(0),
          color:
            series.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
          visible: visibilityMap[series.key] ?? series.visible !== false,
        }
        if (series.fillRgba !== undefined) planned.fillColor = series.fillRgba
        if (series.lineRgba !== undefined) planned.lineColor = series.lineRgba
        if (series.lineWidth !== undefined) planned.lineWidth = series.lineWidth
        if (series.binWidth !== undefined) planned.binWidth = series.binWidth
        if (series.barWidthRatio !== undefined) planned.barWidthRatio = series.barWidthRatio
        return planned
      }),
    [config.series, data.columns, data.frequencies, visibilityMap],
  )
  const peakMarkers = useMemo(
    () => (config.peakMarkers ?? []).map(toCoreSpectrumPeakMarker),
    [config.peakMarkers],
  )
  const bands = useMemo(() => (config.bands ?? []).map(toCoreSpectrumFrequencyBand), [config.bands])

  const renderPlan = useMemo(() => {
    const renderOptions: SpectrumRenderOptions = {}
    if (config.xAxis?.range !== undefined) renderOptions.xRange = config.xAxis.range
    if (config.yAxis?.range !== undefined) renderOptions.yRange = config.yAxis.range
    if (config.yAxis?.baseline !== undefined) renderOptions.baseline = config.yAxis.baseline
    if (config.yAxis?.paddingRatio !== undefined) {
      renderOptions.yPaddingRatio = config.yAxis.paddingRatio
    }
    return buildSpectrumRenderPlan(
      {
        series: planSeries,
        peakMarkers,
        bands,
      },
      renderOptions,
    )
  }, [
    bands,
    config.xAxis?.range,
    config.yAxis?.baseline,
    config.yAxis?.paddingRatio,
    config.yAxis?.range,
    peakMarkers,
    planSeries,
  ])

  const layout = useMemo(() => {
    void resizeKey
    const dimensions = containerRef.current?.dimensions
    return createSpectrumLayout(
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
      segmentCount: renderPlan.segmentCount,
      peakMarkerCount: renderPlan.peakMarkers.length,
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
    renderSpectrumPlan(context, renderPlan, { layout })
    const renderTime = performance.now() - started

    setStats({
      fps: renderTime > 0 ? 1000 / renderTime : 0,
      renderTime,
      pointCount: renderPlan.renderedBinCount,
      sourceBinCount: renderPlan.sourceBinCount,
      renderedBinCount: renderPlan.renderedBinCount,
      segmentCount: renderPlan.segmentCount,
      peakMarkerCount: renderPlan.peakMarkers.length,
    })
  }, [containerRef, context, layout, renderPlan, resizeKey])

  const exportImage = useCallback(
    (format: 'png' | 'svg', exportOptions?: ExportOptions) =>
      exportCanvasImage(containerRef, format, exportOptions, {
        renderCanvas: (exportContext, dimensions) => {
          const exportLayout = createSpectrumLayout(
            config,
            renderPlan,
            legendItems.length,
            dimensions.width,
            dimensions.height,
          )
          renderSpectrumPlan(exportContext, renderPlan, { layout: exportLayout })
        },
        renderSvg: (dimensions) =>
          commandFrameToSvg(
            buildSpectrumCommandFrame(renderPlan, dimensions.width, dimensions.height, {
              layout: createSpectrumLayout(
                config,
                renderPlan,
                legendItems.length,
                dimensions.width,
                dimensions.height,
              ),
            }),
            buildSvgOptions(dimensions, 'Spectrum chart'),
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

function toCoreSpectrumPeakMarker(marker: SpectrumPeakMarkerConfig): CoreSpectrumPeakMarker {
  const coreMarker: CoreSpectrumPeakMarker = {
    key: marker.key,
    frequency: marker.frequency,
  }
  if (marker.magnitude !== undefined) coreMarker.magnitude = marker.magnitude
  if (marker.label !== undefined) coreMarker.label = marker.label
  if (marker.rgba !== undefined) coreMarker.color = marker.rgba
  if (marker.lineWidth !== undefined) coreMarker.lineWidth = marker.lineWidth
  if (marker.visible !== undefined) coreMarker.visible = marker.visible
  if (marker.labelVisible !== undefined) coreMarker.labelVisible = marker.labelVisible
  return coreMarker
}

function toCoreSpectrumFrequencyBand(band: SpectrumFrequencyBandConfig): CoreSpectrumFrequencyBand {
  const coreBand: CoreSpectrumFrequencyBand = {
    key: band.key,
    frequencyStart: band.frequencyStart,
    frequencyEnd: band.frequencyEnd,
  }
  if (band.label !== undefined) coreBand.label = band.label
  if (band.fillRgba !== undefined) coreBand.fillColor = band.fillRgba
  if (band.lineRgba !== undefined) coreBand.lineColor = band.lineRgba
  if (band.lineWidth !== undefined) coreBand.lineWidth = band.lineWidth
  if (band.visible !== undefined) coreBand.visible = band.visible
  return coreBand
}

function createSpectrumLayout(
  config: SpectrumConfig,
  renderPlan: SpectrumRenderPlan,
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

export function Spectrum(props: SpectrumProps): JSX.Element {
  const {
    ariaDescribedBy,
    ariaLabel = 'Spectrum chart',
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
  const chart = useSpectrum({
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
