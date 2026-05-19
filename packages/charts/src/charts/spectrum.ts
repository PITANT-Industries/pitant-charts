import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { FillOptions, LineOptions, RenderContext, TextOptions } from '../renderer/types.js'
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

export interface SpectrumSeries {
  key: string
  label: string
  frequencies: Float64Array
  magnitudes: Float64Array
  color?: RgbaColor
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
  binWidth?: number
  barWidthRatio?: number
  visible?: boolean
}

export interface SpectrumPeakMarker {
  key: string
  frequency: number
  magnitude?: number
  label?: string
  color?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface SpectrumFrequencyBand {
  key: string
  frequencyStart: number
  frequencyEnd: number
  label?: string
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
  visible?: boolean
}

export interface SpectrumDataSet {
  series: readonly SpectrumSeries[]
  peakMarkers?: readonly SpectrumPeakMarker[]
  bands?: readonly SpectrumFrequencyBand[]
}

export interface SpectrumRenderOptions {
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

export interface SpectrumFillSegment {
  upper: Float32Array
  lower: Float32Array
  pointCount: number
}

export interface SpectrumLineSegment {
  buffer: Float32Array
  pointCount: number
}

export interface SpectrumPlannedSeries {
  key: string
  label: string
  style: {
    fill: FillOptions
    line: LineOptions
  }
  fillSegments: readonly SpectrumFillSegment[]
  lineSegments: readonly SpectrumLineSegment[]
  sourceBinCount: number
  includedBinCount: number
  renderedBinCount: number
  droppedBinCount: number
}

export interface SpectrumPlannedPeakMarker {
  key: string
  frequency: number
  relativeFrequency: number
  magnitude: number
  label?: string
  labelVisible: boolean
  style: LineOptions
  lineSegments: readonly SpectrumLineSegment[]
}

export interface SpectrumPlannedBand {
  key: string
  frequencyStart: number
  frequencyEnd: number
  label?: string
  style: {
    fill: FillOptions
    line?: LineOptions
  }
  fillSegments: readonly SpectrumFillSegment[]
  lineSegments: readonly SpectrumLineSegment[]
}

export interface SpectrumRenderPlan {
  kind: 'spectrum'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  baseline: number
  series: readonly SpectrumPlannedSeries[]
  peakMarkers: readonly SpectrumPlannedPeakMarker[]
  bands: readonly SpectrumPlannedBand[]
  sourceBinCount: number
  includedBinCount: number
  renderedBinCount: number
  segmentCount: number
  warnings: readonly string[]
}

export interface SpectrumFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface SpectrumCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

interface SpectrumBuildResult {
  fillSegments: SpectrumFillSegment[]
  lineSegments: SpectrumLineSegment[]
  includedBinCount: number
  renderedBinCount: number
}

const DEFAULT_PEAK_COLOR: RgbaColor = [0.86, 0.15, 0.15, 0.86]
const DEFAULT_BAND_FILL: RgbaColor = [0.15, 0.39, 0.92, 0.08]
const DEFAULT_BAND_LINE: RgbaColor = [0.15, 0.39, 0.92, 0.32]

export function buildSpectrumRenderPlan(
  data: SpectrumDataSet,
  options: SpectrumRenderOptions = {},
): SpectrumRenderPlan {
  const xRange = options.xRange
    ? normalizeRange(options.xRange)
    : inferSpectrumXRange(data, options)
  const baseline = options.baseline ?? inferSpectrumBaseline(data, xRange, options)
  const yRange = options.yRange
    ? normalizeRange(options.yRange)
    : inferSpectrumYRange(data, xRange, baseline, options)
  const series: SpectrumPlannedSeries[] = []
  const warnings: string[] = []
  let sourceBinCount = 0
  let includedBinCount = 0
  let renderedBinCount = 0
  let segmentCount = 0

  for (let sourceIndex = 0; sourceIndex < data.series.length; sourceIndex++) {
    const source = data.series[sourceIndex] as SpectrumSeries
    if (source.visible === false && options.includeHidden !== true) continue

    const pointCount = Math.min(source.frequencies.length, source.magnitudes.length)
    if (source.frequencies.length !== source.magnitudes.length) {
      warnings.push(
        `Spectrum series "${source.key}" uses ${pointCount} bins because frequency and magnitude lengths differ.`,
      )
    }

    const build = buildSpectrumSegments(source, {
      baseline,
      pointCount,
      xRange,
      barWidthRatio: source.barWidthRatio ?? options.defaultBarWidthRatio ?? 0.92,
    })
    const baseColor = source.color ?? getDefaultColor(sourceIndex, options.defaultColor)
    const fillColor =
      source.fillColor ??
      options.defaultFillColor ??
      ([baseColor[0], baseColor[1], baseColor[2], Math.min(0.34, baseColor[3])] as const)
    const lineColor = source.lineColor ?? baseColor
    const plannedSeries: SpectrumPlannedSeries = {
      key: source.key,
      label: source.label,
      style: {
        fill: { color: fillColor },
        line: {
          color: lineColor,
          width: source.lineWidth ?? options.defaultLineWidth ?? 1,
          join: 'miter',
        },
      },
      fillSegments: build.fillSegments,
      lineSegments: build.lineSegments,
      sourceBinCount: pointCount,
      includedBinCount: build.includedBinCount,
      renderedBinCount: build.renderedBinCount,
      droppedBinCount: pointCount - build.includedBinCount,
    }

    sourceBinCount += pointCount
    includedBinCount += build.includedBinCount
    renderedBinCount += build.renderedBinCount
    segmentCount += build.fillSegments.length + build.lineSegments.length
    series.push(plannedSeries)
  }

  const bands = buildSpectrumBands(data.bands ?? [], xRange, yRange)
  const peakMarkers = buildSpectrumPeakMarkers(data.peakMarkers ?? [], xRange, yRange, baseline)
  segmentCount += bands.reduce(
    (total, band) => total + band.fillSegments.length + band.lineSegments.length,
    0,
  )
  segmentCount += peakMarkers.reduce((total, marker) => total + marker.lineSegments.length, 0)

  return {
    kind: 'spectrum',
    xRange,
    xOrigin: 0,
    xRelativeRange: xRange,
    yRange,
    baseline,
    series,
    peakMarkers,
    bands,
    sourceBinCount,
    includedBinCount,
    renderedBinCount,
    segmentCount,
    warnings,
  }
}

export function addSpectrumBandsToCommandList(
  commands: RenderCommandList,
  plan: SpectrumRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Overlay,
): void {
  for (const band of plan.bands) {
    for (const segment of band.fillSegments) {
      commands.addFill(segment.upper, segment.lower, band.style.fill, fillZ)
    }
    if (band.style.line) {
      for (const segment of band.lineSegments) {
        commands.addLine(segment.buffer, band.style.line, lineZ)
      }
    }
  }
}

export function addSpectrumToCommandList(
  commands: RenderCommandList,
  plan: SpectrumRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Line,
): void {
  for (const series of plan.series) {
    for (const segment of series.fillSegments) {
      commands.addFill(segment.upper, segment.lower, series.style.fill, fillZ)
    }
    for (const segment of series.lineSegments) {
      commands.addLine(segment.buffer, series.style.line, lineZ)
    }
  }
}

export function addSpectrumPeakMarkersToCommandList(
  commands: RenderCommandList,
  plan: SpectrumRenderPlan,
  z: ZLayer = ZLayer.Overlay,
): void {
  for (const marker of plan.peakMarkers) {
    for (const segment of marker.lineSegments) {
      commands.addLine(segment.buffer, marker.style, z)
    }
  }
}

export function createSpectrumViewTransform(
  plan: SpectrumRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildSpectrumCommandFrame(
  plan: SpectrumRenderPlan,
  width: number,
  height: number,
  options: SpectrumFrameOptions = {},
): SpectrumCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createSpectrumViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addSpectrumBandsToCommandList(commands, plan)
  addSpectrumToCommandList(commands, plan)
  addSpectrumPeakMarkersToCommandList(commands, plan)
  addSpectrumPeakLabelsToCommandList(
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

export function renderSpectrumPlan(
  context: RenderContext,
  plan: SpectrumRenderPlan,
  options: SpectrumFrameOptions = {},
): void {
  const frame = buildSpectrumCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function buildSpectrumSegments(
  series: SpectrumSeries,
  options: {
    baseline: number
    pointCount: number
    xRange: NumericRange
    barWidthRatio: number
  },
): SpectrumBuildResult {
  const maxFloats = options.pointCount * 4
  const upperScratch = new Float32Array(maxFloats)
  const lowerScratch = new Float32Array(maxFloats)
  let write = 0
  let includedBinCount = 0
  const fallbackWidth = Math.max(
    Number.EPSILON,
    (options.xRange[1] - options.xRange[0]) / Math.max(1, options.pointCount),
  )
  const widthRatio = Math.max(0.05, Math.min(1, options.barWidthRatio))

  for (let index = 0; index < options.pointCount; index++) {
    const frequency = series.frequencies[index]
    const magnitude = series.magnitudes[index]
    if (
      !isFiniteNumber(frequency) ||
      !isFiniteNumber(magnitude) ||
      frequency < options.xRange[0] ||
      frequency > options.xRange[1]
    ) {
      continue
    }

    const binWidth = series.binWidth ?? inferBinWidth(series.frequencies, index, fallbackWidth)
    const halfWidth = (binWidth * widthRatio) / 2
    const left = frequency - halfWidth
    const right = frequency + halfWidth
    upperScratch[write] = left
    upperScratch[write + 1] = magnitude
    upperScratch[write + 2] = right
    upperScratch[write + 3] = magnitude
    lowerScratch[write] = left
    lowerScratch[write + 1] = options.baseline
    lowerScratch[write + 2] = right
    lowerScratch[write + 3] = options.baseline
    write += 4
    includedBinCount += 1
  }

  if (write === 0) {
    return {
      fillSegments: [],
      lineSegments: [],
      includedBinCount,
      renderedBinCount: 0,
    }
  }

  const upper = upperScratch.subarray(0, write)
  const lower = lowerScratch.subarray(0, write)
  const line = new Float32Array(upper)
  return {
    fillSegments: [{ upper, lower, pointCount: write / 2 }],
    lineSegments: [{ buffer: line, pointCount: write / 2 }],
    includedBinCount,
    renderedBinCount: includedBinCount,
  }
}

function buildSpectrumBands(
  bands: readonly SpectrumFrequencyBand[],
  xRange: NumericRange,
  yRange: NumericRange,
): SpectrumPlannedBand[] {
  const planned: SpectrumPlannedBand[] = []
  for (const band of bands) {
    if (band.visible === false) continue
    const [rawStart, rawEnd] = normalizeRange([band.frequencyStart, band.frequencyEnd])
    if (!isFiniteNumber(rawStart) || !isFiniteNumber(rawEnd)) continue
    const start = Math.max(rawStart, xRange[0])
    const end = Math.min(rawEnd, xRange[1])
    if (end <= start) continue

    const lower = new Float32Array([start, yRange[0], end, yRange[0]])
    const upper = new Float32Array([start, yRange[1], end, yRange[1]])
    const lineWidth = band.lineWidth ?? 1
    const lineStyle = band.lineColor
      ? {
          color: band.lineColor,
          width: lineWidth,
        }
      : {
          color: DEFAULT_BAND_LINE,
          width: lineWidth,
        }
    const plannedBand: SpectrumPlannedBand = {
      key: band.key,
      frequencyStart: start,
      frequencyEnd: end,
      style: {
        fill: { color: band.fillColor ?? DEFAULT_BAND_FILL },
        line: lineStyle,
      },
      fillSegments: [{ upper, lower, pointCount: 2 }],
      lineSegments: [
        { buffer: new Float32Array([start, yRange[0], start, yRange[1]]), pointCount: 2 },
        { buffer: new Float32Array([end, yRange[0], end, yRange[1]]), pointCount: 2 },
      ],
    }
    if (band.label !== undefined) plannedBand.label = band.label
    planned.push(plannedBand)
  }
  return planned
}

function buildSpectrumPeakMarkers(
  markers: readonly SpectrumPeakMarker[],
  xRange: NumericRange,
  yRange: NumericRange,
  baseline: number,
): SpectrumPlannedPeakMarker[] {
  const planned: SpectrumPlannedPeakMarker[] = []
  for (const marker of markers) {
    if (marker.visible === false) continue
    if (!isFiniteNumber(marker.frequency)) continue
    if (marker.frequency < xRange[0] || marker.frequency > xRange[1]) continue
    const magnitude =
      marker.magnitude !== undefined && isFiniteNumber(marker.magnitude)
        ? marker.magnitude
        : yRange[1]
    const plannedMarker: SpectrumPlannedPeakMarker = {
      key: marker.key,
      frequency: marker.frequency,
      relativeFrequency: marker.frequency,
      magnitude,
      labelVisible: marker.labelVisible !== false,
      style: {
        color: marker.color ?? DEFAULT_PEAK_COLOR,
        width: marker.lineWidth ?? 1.2,
      },
      lineSegments: [
        {
          buffer: new Float32Array([marker.frequency, baseline, marker.frequency, magnitude]),
          pointCount: 2,
        },
      ],
    }
    if (marker.label !== undefined) plannedMarker.label = marker.label
    planned.push(plannedMarker)
  }
  return planned
}

function addSpectrumPeakLabelsToCommandList(
  commands: RenderCommandList,
  plan: SpectrumRenderPlan,
  transform: ViewTransform,
  plotArea: { x: number; y: number; width: number; height: number },
): void {
  const style: TextOptions = {
    color: [0.12, 0.12, 0.12, 0.86],
    font: 'system-ui, sans-serif',
    fontSize: 11,
    align: 'center',
    baseline: 'bottom',
  }
  for (const marker of plan.peakMarkers) {
    if (!marker.labelVisible || !marker.label) continue
    const point = transform.dataToPixel(marker.relativeFrequency, marker.magnitude)
    const x = Math.max(plotArea.x + 4, Math.min(plotArea.x + plotArea.width - 4, point.x))
    const y = Math.max(plotArea.y + 12, Math.min(plotArea.y + plotArea.height - 2, point.y - 4))
    commands.addText(marker.label, x, y, style, ZLayer.Text)
  }
}

function inferSpectrumXRange(data: SpectrumDataSet, options: SpectrumRenderOptions): NumericRange {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const series of data.series) {
    if (series.visible === false && options.includeHidden !== true) continue
    const pointCount = Math.min(series.frequencies.length, series.magnitudes.length)
    for (let index = 0; index < pointCount; index++) {
      const frequency = series.frequencies[index]
      if (!isFiniteNumber(frequency)) continue
      if (frequency < min) min = frequency
      if (frequency > max) max = frequency
    }
  }

  if (min === Number.POSITIVE_INFINITY) return [0, 1]
  return expandRange([min, max], 0.02)
}

function inferSpectrumBaseline(
  data: SpectrumDataSet,
  xRange: NumericRange,
  options: SpectrumRenderOptions,
): number {
  let min = Number.POSITIVE_INFINITY
  for (const series of data.series) {
    if (series.visible === false && options.includeHidden !== true) continue
    const pointCount = Math.min(series.frequencies.length, series.magnitudes.length)
    for (let index = 0; index < pointCount; index++) {
      const frequency = series.frequencies[index]
      const magnitude = series.magnitudes[index]
      if (
        !isFiniteNumber(frequency) ||
        !isFiniteNumber(magnitude) ||
        frequency < xRange[0] ||
        frequency > xRange[1]
      ) {
        continue
      }
      if (magnitude < min) min = magnitude
    }
  }

  if (min === Number.POSITIVE_INFINITY) return 0
  return min < 0 ? min : 0
}

function inferSpectrumYRange(
  data: SpectrumDataSet,
  xRange: NumericRange,
  baseline: number,
  options: SpectrumRenderOptions,
): NumericRange {
  let min = baseline
  let max = baseline
  for (const series of data.series) {
    if (series.visible === false && options.includeHidden !== true) continue
    const pointCount = Math.min(series.frequencies.length, series.magnitudes.length)
    for (let index = 0; index < pointCount; index++) {
      const frequency = series.frequencies[index]
      const magnitude = series.magnitudes[index]
      if (
        !isFiniteNumber(frequency) ||
        !isFiniteNumber(magnitude) ||
        frequency < xRange[0] ||
        frequency > xRange[1]
      ) {
        continue
      }
      if (magnitude < min) min = magnitude
      if (magnitude > max) max = magnitude
    }
  }
  for (const marker of data.peakMarkers ?? []) {
    if (marker.visible === false) continue
    if (
      !isFiniteNumber(marker.frequency) ||
      marker.frequency < xRange[0] ||
      marker.frequency > xRange[1] ||
      marker.magnitude === undefined ||
      !isFiniteNumber(marker.magnitude)
    ) {
      continue
    }
    if (marker.magnitude < min) min = marker.magnitude
    if (marker.magnitude > max) max = marker.magnitude
  }
  return expandRange([min, max], options.yPaddingRatio ?? 0.08)
}

function inferBinWidth(frequencies: Float64Array, index: number, fallbackWidth: number): number {
  const current = frequencies[index]
  if (!isFiniteNumber(current)) return fallbackWidth
  const previous = frequencies[index - 1]
  const next = frequencies[index + 1]
  const previousGap = isFiniteNumber(previous) ? current - previous : Number.POSITIVE_INFINITY
  const nextGap = isFiniteNumber(next) ? next - current : Number.POSITIVE_INFINITY
  const width = Math.min(
    previousGap > 0 ? previousGap : Number.POSITIVE_INFINITY,
    nextGap > 0 ? nextGap : Number.POSITIVE_INFINITY,
  )
  return Number.isFinite(width) ? width : fallbackWidth
}
