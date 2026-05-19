import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { LineOptions, RenderContext } from '../renderer/types.js'
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

export interface TimeSeriesDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  series: readonly TimeSeriesSeries[]
}

export interface TimeSeriesRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  gapThreshold?: number
  interpolation?: TimeSeriesInterpolation
  defaultColor?: RgbaColor
  defaultLineWidth?: number
  includeHidden?: boolean
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

export interface TimeSeriesRenderPlan {
  kind: 'time-series'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  series: readonly TimeSeriesPlannedSeries[]
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

export function buildTimeSeriesRenderPlan(
  data: TimeSeriesDataSet,
  options: TimeSeriesRenderOptions = {},
): TimeSeriesRenderPlan {
  const xRange = options.xRange ? normalizeRange(options.xRange) : finiteRange(data.timestamps)
  const xOrigin = xRange[0]
  const xRelativeRange = relativeRange(xRange, xOrigin)
  const yPaddingRatio = options.yPaddingRatio ?? 0.05
  const plannedSeries: TimeSeriesPlannedSeries[] = []
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
    sourcePointCount,
    includedSampleCount,
    renderedPointCount,
    segmentCount,
    warnings,
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
