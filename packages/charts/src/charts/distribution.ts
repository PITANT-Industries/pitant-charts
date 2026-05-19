import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { LineOptions, RectOptions, RenderContext, TextOptions } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  addChartGuidesToCommandList,
  type ChartGuideOptions,
  type ChartLayout,
  type ChartLayoutOptions,
  createPlotViewportTransform,
  createViewportTransform,
  drawCommandList,
  expandRange,
  getDefaultColor,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  resolveChartLayout,
} from './common.js'

export type DistributionMarkerKind =
  | 'lower-spec'
  | 'upper-spec'
  | 'target'
  | 'mean'
  | 'median'
  | 'percentile'
  | 'custom'

export interface DistributionSeries {
  key: string
  label: string
  binStarts: Float64Array
  binEnds: Float64Array
  values: Float64Array
  color?: RgbaColor
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
  barWidthRatio?: number
  visible?: boolean
}

export interface DistributionMarker {
  key: string
  value: number
  kind?: DistributionMarkerKind
  label?: string
  color?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface DistributionDataSet {
  series: readonly DistributionSeries[]
  markers?: readonly DistributionMarker[]
}

export interface DistributionRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  baseline?: number
  defaultColor?: RgbaColor
  defaultFillColor?: RgbaColor
  defaultLineWidth?: number
  defaultBarWidthRatio?: number
  yPaddingRatio?: number
  includeHidden?: boolean
}

export interface DistributionPlannedBin {
  x: number
  y: number
  width: number
  height: number
  value: number
  style: RectOptions
}

export interface DistributionPlannedSeries {
  key: string
  label: string
  bins: readonly DistributionPlannedBin[]
  sourceBinCount: number
  includedBinCount: number
  renderedBinCount: number
  droppedBinCount: number
}

export interface DistributionPlannedMarker {
  key: string
  value: number
  kind: DistributionMarkerKind
  label?: string
  labelVisible: boolean
  style: LineOptions
  lineBuffer: Float32Array
}

export interface DistributionRenderPlan {
  kind: 'distribution'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  baseline: number
  series: readonly DistributionPlannedSeries[]
  markers: readonly DistributionPlannedMarker[]
  sourceBinCount: number
  includedBinCount: number
  renderedBinCount: number
  commandCount: number
  warnings: readonly string[]
}

export interface DistributionFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface DistributionCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

const DEFAULT_MARKER_COLOR: RgbaColor = [0.12, 0.12, 0.12, 0.72]
const SPEC_MARKER_COLOR: RgbaColor = [0.86, 0.15, 0.15, 0.86]
const TARGET_MARKER_COLOR: RgbaColor = [0.09, 0.64, 0.29, 0.82]

export function buildDistributionRenderPlan(
  data: DistributionDataSet,
  options: DistributionRenderOptions = {},
): DistributionRenderPlan {
  const xRange = options.xRange
    ? normalizeRange(options.xRange)
    : inferDistributionXRange(data, options)
  const baseline = options.baseline ?? 0
  const yRange = options.yRange
    ? normalizeRange(options.yRange)
    : inferDistributionYRange(data, xRange, baseline, options)
  const series: DistributionPlannedSeries[] = []
  const warnings: string[] = []
  let sourceBinCount = 0
  let includedBinCount = 0
  let renderedBinCount = 0

  for (let sourceIndex = 0; sourceIndex < data.series.length; sourceIndex++) {
    const source = data.series[sourceIndex] as DistributionSeries
    if (source.visible === false && options.includeHidden !== true) continue

    const binCount = Math.min(source.binStarts.length, source.binEnds.length, source.values.length)
    if (
      source.binStarts.length !== source.binEnds.length ||
      source.binStarts.length !== source.values.length
    ) {
      warnings.push(
        `Distribution series "${source.key}" uses ${binCount} bins because start, end, and value lengths differ.`,
      )
    }

    const binOptions: {
      baseline: number
      xRange: NumericRange
      barWidthRatio: number
      defaultColor?: RgbaColor
      defaultFillColor?: RgbaColor
      defaultLineWidth?: number
    } = {
      baseline,
      xRange,
      barWidthRatio: source.barWidthRatio ?? options.defaultBarWidthRatio ?? 0.92,
    }
    if (options.defaultColor !== undefined) binOptions.defaultColor = options.defaultColor
    if (options.defaultFillColor !== undefined) {
      binOptions.defaultFillColor = options.defaultFillColor
    }
    if (options.defaultLineWidth !== undefined) {
      binOptions.defaultLineWidth = options.defaultLineWidth
    }

    const planned = buildDistributionBins(source, sourceIndex, binCount, binOptions)
    sourceBinCount += binCount
    includedBinCount += planned.includedBinCount
    renderedBinCount += planned.renderedBinCount
    series.push(planned)
  }

  const markers = buildDistributionMarkers(data.markers ?? [], xRange, yRange, baseline)

  return {
    kind: 'distribution',
    xRange,
    xOrigin: 0,
    xRelativeRange: xRange,
    yRange,
    baseline,
    series,
    markers,
    sourceBinCount,
    includedBinCount,
    renderedBinCount,
    commandCount: renderedBinCount + markers.length,
    warnings,
  }
}

export function addDistributionToCommandList(
  commands: RenderCommandList,
  plan: DistributionRenderPlan,
  z: ZLayer = ZLayer.Fill,
): void {
  for (const series of plan.series) {
    for (const bin of series.bins) {
      commands.addRect(bin.x, bin.y, bin.width, bin.height, bin.style, z)
    }
  }
}

export function addDistributionMarkersToCommandList(
  commands: RenderCommandList,
  plan: DistributionRenderPlan,
  z: ZLayer = ZLayer.Overlay,
): void {
  for (const marker of plan.markers) {
    commands.addLine(marker.lineBuffer, marker.style, z)
  }
}

export function createDistributionViewTransform(
  plan: DistributionRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildDistributionCommandFrame(
  plan: DistributionRenderPlan,
  width: number,
  height: number,
  options: DistributionFrameOptions = {},
): DistributionCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createDistributionViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addDistributionToCommandList(commands, plan)
  addDistributionMarkersToCommandList(commands, plan)
  addDistributionMarkerLabelsToCommandList(
    commands,
    plan,
    transform,
    layout?.plotArea ?? { x: 0, y: 0, width, height },
  )

  return {
    width,
    height,
    layout,
    commands,
    transform,
  }
}

export function renderDistributionPlan(
  context: RenderContext,
  plan: DistributionRenderPlan,
  options: DistributionFrameOptions = {},
): void {
  const frame = buildDistributionCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function buildDistributionBins(
  source: DistributionSeries,
  sourceIndex: number,
  binCount: number,
  options: {
    baseline: number
    xRange: NumericRange
    barWidthRatio: number
    defaultColor?: RgbaColor
    defaultFillColor?: RgbaColor
    defaultLineWidth?: number
  },
): DistributionPlannedSeries {
  const bins: DistributionPlannedBin[] = []
  const baseColor = source.color ?? getDefaultColor(sourceIndex, options.defaultColor)
  const fillColor =
    source.fillColor ??
    options.defaultFillColor ??
    ([baseColor[0], baseColor[1], baseColor[2], Math.min(0.42, baseColor[3])] as const)
  const strokeColor = source.lineColor ?? baseColor
  const widthRatio = Math.max(0.05, Math.min(1, options.barWidthRatio))
  let includedBinCount = 0

  for (let index = 0; index < binCount; index++) {
    const start = source.binStarts[index]
    const end = source.binEnds[index]
    const value = source.values[index]
    if (!isFiniteNumber(start) || !isFiniteNumber(end) || !isFiniteNumber(value)) continue
    const [rawStart, rawEnd] = normalizeRange([start, end])
    if (rawEnd < options.xRange[0] || rawStart > options.xRange[1]) continue

    const span = rawEnd - rawStart
    if (span <= 0) continue
    const inset = (span * (1 - widthRatio)) / 2
    const clippedStart = Math.max(rawStart + inset, options.xRange[0])
    const clippedEnd = Math.min(rawEnd - inset, options.xRange[1])
    if (clippedEnd <= clippedStart) continue

    includedBinCount += 1
    const y = Math.min(options.baseline, value)
    const height = Math.abs(value - options.baseline)
    bins.push({
      x: clippedStart,
      y,
      width: clippedEnd - clippedStart,
      height,
      value,
      style: {
        fillColor,
        strokeColor,
        strokeWidth: source.lineWidth ?? options.defaultLineWidth ?? 0.8,
      },
    })
  }

  return {
    key: source.key,
    label: source.label,
    bins,
    sourceBinCount: binCount,
    includedBinCount,
    renderedBinCount: bins.length,
    droppedBinCount: binCount - includedBinCount,
  }
}

function buildDistributionMarkers(
  markers: readonly DistributionMarker[],
  xRange: NumericRange,
  yRange: NumericRange,
  baseline: number,
): DistributionPlannedMarker[] {
  const planned: DistributionPlannedMarker[] = []
  for (const marker of markers) {
    if (marker.visible === false) continue
    if (!isFiniteNumber(marker.value)) continue
    if (marker.value < xRange[0] || marker.value > xRange[1]) continue
    const kind = marker.kind ?? 'custom'
    const style = {
      color: marker.color ?? defaultMarkerColor(kind),
      width: marker.lineWidth ?? (kind === 'lower-spec' || kind === 'upper-spec' ? 1.3 : 1),
    }
    const plannedMarker: DistributionPlannedMarker = {
      key: marker.key,
      value: marker.value,
      kind,
      labelVisible: marker.labelVisible !== false,
      style,
      lineBuffer: new Float32Array([marker.value, baseline, marker.value, yRange[1]]),
    }
    if (marker.label !== undefined) plannedMarker.label = marker.label
    planned.push(plannedMarker)
  }
  return planned
}

function addDistributionMarkerLabelsToCommandList(
  commands: RenderCommandList,
  plan: DistributionRenderPlan,
  transform: ViewTransform,
  plotArea: { x: number; y: number; width: number; height: number },
): void {
  const style: TextOptions = {
    color: [0.12, 0.12, 0.12, 0.86],
    font: 'system-ui, sans-serif',
    fontSize: 11,
    align: 'center',
    baseline: 'top',
  }
  for (const marker of plan.markers) {
    if (!marker.labelVisible || !marker.label) continue
    const point = transform.dataToPixel(marker.value, plan.yRange[1])
    const x = Math.max(plotArea.x + 4, Math.min(plotArea.x + plotArea.width - 4, point.x))
    const y = Math.max(plotArea.y + 2, Math.min(plotArea.y + plotArea.height - 14, point.y + 4))
    commands.addText(marker.label, x, y, style, ZLayer.Text)
  }
}

function inferDistributionXRange(
  data: DistributionDataSet,
  options: DistributionRenderOptions,
): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const series of data.series) {
    if (series.visible === false && options.includeHidden !== true) continue
    const binCount = Math.min(series.binStarts.length, series.binEnds.length, series.values.length)
    for (let index = 0; index < binCount; index++) {
      const start = series.binStarts[index]
      const end = series.binEnds[index]
      if (!isFiniteNumber(start) || !isFiniteNumber(end)) continue
      const [rawStart, rawEnd] = normalizeRange([start, end])
      if (rawStart < min) min = rawStart
      if (rawEnd > max) max = rawEnd
    }
  }
  for (const marker of data.markers ?? []) {
    if (marker.visible === false || !isFiniteNumber(marker.value)) continue
    if (marker.value < min) min = marker.value
    if (marker.value > max) max = marker.value
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  return expandRange([min, max], 0.02)
}

function inferDistributionYRange(
  data: DistributionDataSet,
  xRange: NumericRange,
  baseline: number,
  options: DistributionRenderOptions,
): NumericRange {
  let min = baseline
  let max = baseline
  for (const series of data.series) {
    if (series.visible === false && options.includeHidden !== true) continue
    const binCount = Math.min(series.binStarts.length, series.binEnds.length, series.values.length)
    for (let index = 0; index < binCount; index++) {
      const start = series.binStarts[index]
      const end = series.binEnds[index]
      const value = series.values[index]
      if (!isFiniteNumber(start) || !isFiniteNumber(end) || !isFiniteNumber(value)) continue
      const [rawStart, rawEnd] = normalizeRange([start, end])
      if (rawEnd < xRange[0] || rawStart > xRange[1]) continue
      if (value < min) min = value
      if (value > max) max = value
    }
  }
  return expandRange([min, max], options.yPaddingRatio ?? 0.08)
}

function defaultMarkerColor(kind: DistributionMarkerKind): RgbaColor {
  if (kind === 'lower-spec' || kind === 'upper-spec') return SPEC_MARKER_COLOR
  if (kind === 'target') return TARGET_MARKER_COLOR
  return DEFAULT_MARKER_COLOR
}
