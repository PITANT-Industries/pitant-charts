import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { FillOptions, LineOptions, RenderContext } from '../renderer/types.js'
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
  finiteRange,
  getDefaultColor,
  isFiniteNumber,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  relativeRange,
  resolveChartLayout,
} from './common.js'

export type TimeSeriesInterpolation = 'linear' | 'step-after' | 'step-before'

export interface TimeSeriesSeries {
  key: string
  label: string
  field: string
  color?: RgbaColor
  lineWidth?: number
  interpolation?: TimeSeriesInterpolation
  visible?: boolean
  gapThreshold?: number
}

export interface TimeSeriesValueBand {
  kind: 'value-band'
  key: string
  label?: string
  yStart: number
  yEnd: number
  xRange?: NumericRange
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
  visible?: boolean
  includeInYRange?: boolean
}

export interface TimeSeriesEnvelopeBand {
  kind: 'envelope'
  key: string
  label?: string
  lowerField: string
  upperField: string
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
  gapThreshold?: number
  visible?: boolean
  includeInYRange?: boolean
}

export type TimeSeriesBand = TimeSeriesValueBand | TimeSeriesEnvelopeBand

export interface TimeSeriesDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  series: readonly TimeSeriesSeries[]
  bands?: readonly TimeSeriesBand[]
}

export interface TimeSeriesRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  gapThreshold?: number
  interpolation?: TimeSeriesInterpolation
  defaultColor?: RgbaColor
  defaultLineWidth?: number
  defaultBandFillColor?: RgbaColor
  defaultBandLineColor?: RgbaColor
  defaultBandLineWidth?: number
  includeHidden?: boolean
  includeHiddenBands?: boolean
  yPaddingRatio?: number
}

export interface TimeSeriesLineSegment {
  buffer: Float32Array
  pointCount: number
}

export interface TimeSeriesPlannedSeries {
  key: string
  label: string
  field: string
  style: LineOptions
  interpolation: TimeSeriesInterpolation
  segments: readonly TimeSeriesLineSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
}

export interface TimeSeriesBandSegment {
  upper: Float32Array
  lower: Float32Array
  pointCount: number
}

export interface TimeSeriesBandStyle {
  fill: FillOptions
  boundary?: LineOptions
}

export interface TimeSeriesPlannedBand {
  kind: TimeSeriesBand['kind']
  key: string
  label: string
  style: TimeSeriesBandStyle
  segments: readonly TimeSeriesBandSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
  includeInYRange: boolean
}

export interface TimeSeriesRenderPlan {
  kind: 'time-series'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  series: readonly TimeSeriesPlannedSeries[]
  bands: readonly TimeSeriesPlannedBand[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  segmentCount: number
  warnings: readonly string[]
}

export interface TimeSeriesFrameOptions {
  layout?: ChartLayout | ChartLayoutOptions
  guides?: ChartGuideOptions | false
}

export interface TimeSeriesCommandFrame {
  width: number
  height: number
  layout: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

interface SegmentBuildResult {
  segments: TimeSeriesLineSegment[]
  includedSampleCount: number
  renderedPointCount: number
  minY: number
  maxY: number
}

interface BandBuildResult {
  segments: TimeSeriesBandSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  minY: number
  maxY: number
}

export function buildTimeSeriesRenderPlan(
  data: TimeSeriesDataSet,
  options: TimeSeriesRenderOptions = {},
): TimeSeriesRenderPlan {
  const xRange = options.xRange ? normalizeRange(options.xRange) : finiteRange(data.timestamps)
  const xOrigin = xRange[0]
  const xRelativeRange = relativeRange(xRange, xOrigin)
  const yPaddingRatio = options.yPaddingRatio ?? 0.05
  const plannedSeries: TimeSeriesPlannedSeries[] = []
  const plannedBands: TimeSeriesPlannedBand[] = []
  const warnings: string[] = []
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let sourcePointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let segmentCount = 0

  for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
    const series = data.series[seriesIndex] as TimeSeriesSeries
    if (series.visible === false && options.includeHidden !== true) continue

    const values = data.columns[series.field]
    if (!values) {
      warnings.push(`Series "${series.key}" skipped because column "${series.field}" is missing.`)
      continue
    }

    const pointCount = Math.min(data.timestamps.length, values.length)
    if (data.timestamps.length !== values.length) {
      warnings.push(
        `Series "${series.key}" uses ${pointCount} points because timestamp and value lengths differ.`,
      )
    }

    const interpolation = series.interpolation ?? options.interpolation ?? 'linear'
    const build = buildSeriesSegments(data.timestamps, values, {
      pointCount,
      xRange,
      xOrigin,
      gapThreshold: series.gapThreshold ?? options.gapThreshold ?? 0,
      interpolation,
    })

    sourcePointCount += pointCount
    includedSampleCount += build.includedSampleCount
    renderedPointCount += build.renderedPointCount
    segmentCount += build.segments.length

    if (build.includedSampleCount > 0) {
      minY = Math.min(minY, build.minY)
      maxY = Math.max(maxY, build.maxY)
    }

    plannedSeries.push({
      key: series.key,
      label: series.label,
      field: series.field,
      style: {
        color: series.color ?? getDefaultColor(seriesIndex, options.defaultColor),
        width: series.lineWidth ?? options.defaultLineWidth ?? 1.5,
      },
      interpolation,
      segments: build.segments,
      sourcePointCount: pointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: pointCount - build.includedSampleCount,
    })
  }

  const bands = data.bands ?? []
  for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
    const band = bands[bandIndex] as TimeSeriesBand
    if (band.visible === false && options.includeHiddenBands !== true) continue

    const build =
      band.kind === 'value-band'
        ? buildValueBandSegments(band, { xRange, xOrigin })
        : buildEnvelopeBandSegments(data.timestamps, data.columns, band, {
            xRange,
            xOrigin,
            gapThreshold: band.gapThreshold ?? options.gapThreshold ?? 0,
          })

    if (band.kind === 'envelope' && build.sourcePointCount === 0) {
      warnings.push(`Band "${band.key}" skipped because envelope columns are missing.`)
      continue
    }

    if (build.includedSampleCount === 0) {
      warnings.push(`Band "${band.key}" has no samples inside the visible x-range.`)
      continue
    }

    const includeInYRange = band.includeInYRange !== false
    if (includeInYRange) {
      minY = Math.min(minY, build.minY)
      maxY = Math.max(maxY, build.maxY)
    }

    const plannedBand: TimeSeriesPlannedBand = {
      kind: band.kind,
      key: band.key,
      label: band.label ?? band.key,
      style: resolveBandStyle(band, bandIndex, options),
      segments: build.segments,
      sourcePointCount: build.sourcePointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: build.sourcePointCount - build.includedSampleCount,
      includeInYRange,
    }
    plannedBands.push(plannedBand)
  }

  const inferredYRange: NumericRange =
    minY === Number.POSITIVE_INFINITY ? [0, 1] : expandRange([minY, maxY], yPaddingRatio)
  const yRange = options.yRange ? normalizeRange(options.yRange) : inferredYRange

  return {
    kind: 'time-series',
    xRange,
    xOrigin,
    xRelativeRange,
    yRange,
    series: plannedSeries,
    bands: plannedBands,
    sourcePointCount,
    includedSampleCount,
    renderedPointCount,
    segmentCount,
    warnings,
  }
}

export function addTimeSeriesBandsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  boundaryZ: ZLayer = ZLayer.Overlay,
): void {
  for (const band of plan.bands) {
    for (const segment of band.segments) {
      commands.addFill(segment.upper, segment.lower, band.style.fill, fillZ)
      if (band.style.boundary) {
        commands.addLine(segment.upper, band.style.boundary, boundaryZ)
        commands.addLine(segment.lower, band.style.boundary, boundaryZ)
      }
    }
  }
}

export function addTimeSeriesToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  z: ZLayer = ZLayer.Line,
): void {
  for (const series of plan.series) {
    for (const segment of series.segments) {
      commands.addLine(segment.buffer, series.style, z)
    }
  }
}

export function createTimeSeriesViewTransform(
  plan: TimeSeriesRenderPlan,
  width: number,
  height: number,
): ViewTransform {
  return createViewportTransform(plan.xRelativeRange, plan.yRange, width, height)
}

export function buildTimeSeriesCommandFrame(
  plan: TimeSeriesRenderPlan,
  width: number,
  height: number,
  options: TimeSeriesFrameOptions = {},
): TimeSeriesCommandFrame {
  const layout = resolveChartLayout(options.layout, width, height, plan.xRelativeRange, plan.yRange)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addTimeSeriesBandsToCommandList(commands, plan)
  addTimeSeriesToCommandList(commands, plan)

  return {
    width,
    height,
    layout,
    commands,
    transform: layout
      ? createPlotViewportTransform(
          plan.xRelativeRange,
          plan.yRange,
          width,
          height,
          layout.plotArea,
        )
      : createTimeSeriesViewTransform(plan, width, height),
  }
}

function buildValueBandSegments(
  band: TimeSeriesValueBand,
  options: {
    xRange: NumericRange
    xOrigin: number
  },
): BandBuildResult {
  const yRange = normalizeRange([band.yStart, band.yEnd])
  const bandXRange = band.xRange ? normalizeRange(band.xRange) : options.xRange
  const xStart = Math.max(options.xRange[0], bandXRange[0])
  const xEnd = Math.min(options.xRange[1], bandXRange[1])

  if (
    !isFiniteNumber(yRange[0]) ||
    !isFiniteNumber(yRange[1]) ||
    !isFiniteNumber(xStart) ||
    !isFiniteNumber(xEnd) ||
    xEnd <= xStart
  ) {
    return emptyBandBuildResult(2)
  }

  const lower = new Float32Array([
    xStart - options.xOrigin,
    yRange[0],
    xEnd - options.xOrigin,
    yRange[0],
  ])
  const upper = new Float32Array([
    xStart - options.xOrigin,
    yRange[1],
    xEnd - options.xOrigin,
    yRange[1],
  ])

  return {
    segments: [{ upper, lower, pointCount: 2 }],
    sourcePointCount: 2,
    includedSampleCount: 2,
    renderedPointCount: 2,
    minY: yRange[0],
    maxY: yRange[1],
  }
}

function buildEnvelopeBandSegments(
  timestamps: Float64Array,
  columns: Record<string, Float64Array>,
  band: TimeSeriesEnvelopeBand,
  options: {
    xRange: NumericRange
    xOrigin: number
    gapThreshold: number
  },
): BandBuildResult {
  const lowerValues = columns[band.lowerField]
  const upperValues = columns[band.upperField]
  if (!lowerValues || !upperValues) return emptyBandBuildResult(0)

  const pointCount = Math.min(timestamps.length, lowerValues.length, upperValues.length)
  const upperScratch = new Float32Array(pointCount * 2)
  const lowerScratch = new Float32Array(pointCount * 2)
  const segments: TimeSeriesBandSegment[] = []
  let write = 0
  let segmentStart = 0
  let segmentPointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let previousTimestamp = 0

  const pushSegment = () => {
    if (segmentPointCount >= 2) {
      segments.push({
        upper: upperScratch.subarray(segmentStart, write),
        lower: lowerScratch.subarray(segmentStart, write),
        pointCount: segmentPointCount,
      })
      renderedPointCount += segmentPointCount
    }
    segmentPointCount = 0
    segmentStart = write
  }

  const appendPoint = (x: number, lowerY: number, upperY: number) => {
    lowerScratch[write] = x
    lowerScratch[write + 1] = lowerY
    upperScratch[write] = x
    upperScratch[write + 1] = upperY
    write += 2
    segmentPointCount += 1
  }

  for (let i = 0; i < pointCount; i++) {
    const timestamp = timestamps[i]
    const lowerValue = lowerValues[i]
    const upperValue = upperValues[i]
    if (
      !isFiniteNumber(timestamp) ||
      !isFiniteNumber(lowerValue) ||
      !isFiniteNumber(upperValue) ||
      timestamp < options.xRange[0] ||
      timestamp > options.xRange[1]
    ) {
      pushSegment()
      continue
    }

    const gapBreak =
      segmentPointCount > 0 &&
      options.gapThreshold > 0 &&
      timestamp - previousTimestamp > options.gapThreshold
    if (gapBreak) {
      pushSegment()
    }

    if (segmentPointCount === 0) segmentStart = write

    const yRange = normalizeRange([lowerValue, upperValue])
    appendPoint(timestamp - options.xOrigin, yRange[0], yRange[1])
    includedSampleCount += 1
    minY = Math.min(minY, yRange[0])
    maxY = Math.max(maxY, yRange[1])
    previousTimestamp = timestamp
  }

  pushSegment()

  return {
    segments,
    sourcePointCount: pointCount,
    includedSampleCount,
    renderedPointCount,
    minY,
    maxY,
  }
}

function emptyBandBuildResult(sourcePointCount: number): BandBuildResult {
  return {
    segments: [],
    sourcePointCount,
    includedSampleCount: 0,
    renderedPointCount: 0,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }
}

function resolveBandStyle(
  band: TimeSeriesBand,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesBandStyle {
  const base = getDefaultColor(index, options.defaultBandFillColor)
  const fillColor = band.fillColor ?? [base[0], base[1], base[2], Math.min(base[3], 0.14)]
  const boundaryColor = band.lineColor ?? options.defaultBandLineColor
  const boundaryWidth = band.lineWidth ?? options.defaultBandLineWidth ?? 1
  const style: TimeSeriesBandStyle = { fill: { color: fillColor } }
  if (boundaryColor) {
    style.boundary = {
      color: boundaryColor,
      width: boundaryWidth,
    }
  }
  return style
}

export function renderTimeSeriesPlan(
  context: RenderContext,
  plan: TimeSeriesRenderPlan,
  options: TimeSeriesFrameOptions = {},
): void {
  const frame = buildTimeSeriesCommandFrame(plan, context.width, context.height, options)
  context.setTransform(frame.transform)
  context.beginFrame()
  drawCommandList(context, frame.commands)
  context.endFrame()
}

function buildSeriesSegments(
  timestamps: Float64Array,
  values: Float64Array,
  options: {
    pointCount: number
    xRange: NumericRange
    xOrigin: number
    gapThreshold: number
    interpolation: TimeSeriesInterpolation
  },
): SegmentBuildResult {
  const maxFloats =
    options.interpolation === 'linear'
      ? options.pointCount * 2
      : Math.max(0, options.pointCount * 4 - 2)
  const scratch = new Float32Array(maxFloats)
  const segments: TimeSeriesLineSegment[] = []
  let write = 0
  let segmentStart = 0
  let segmentPointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let previousX = 0
  let previousY = 0

  const pushSegment = () => {
    if (segmentPointCount >= 2) {
      const buffer = scratch.subarray(segmentStart, write)
      segments.push({ buffer, pointCount: segmentPointCount })
      renderedPointCount += segmentPointCount
    }
    segmentPointCount = 0
    segmentStart = write
  }

  const appendPoint = (x: number, y: number) => {
    scratch[write++] = x
    scratch[write++] = y
    segmentPointCount += 1
  }

  for (let i = 0; i < options.pointCount; i++) {
    const timestamp = timestamps[i]
    const value = values[i]
    if (
      !isFiniteNumber(timestamp) ||
      !isFiniteNumber(value) ||
      timestamp < options.xRange[0] ||
      timestamp > options.xRange[1]
    ) {
      pushSegment()
      continue
    }

    const x = timestamp - options.xOrigin
    const previousTimestamp = previousX + options.xOrigin
    const gapBreak =
      segmentPointCount > 0 &&
      options.gapThreshold > 0 &&
      timestamp - previousTimestamp > options.gapThreshold

    if (gapBreak) {
      pushSegment()
    }

    if (segmentPointCount === 0) {
      segmentStart = write
      appendPoint(x, value)
    } else if (options.interpolation === 'step-after') {
      appendPoint(x, previousY)
      appendPoint(x, value)
    } else if (options.interpolation === 'step-before') {
      appendPoint(previousX, value)
      appendPoint(x, value)
    } else {
      appendPoint(x, value)
    }

    includedSampleCount += 1
    minY = Math.min(minY, value)
    maxY = Math.max(maxY, value)
    previousX = x
    previousY = value
  }

  pushSegment()

  return {
    segments,
    includedSampleCount,
    renderedPointCount,
    minY,
    maxY,
  }
}
