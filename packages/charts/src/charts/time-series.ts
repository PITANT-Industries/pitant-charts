import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { FillOptions, LineOptions, RenderContext, TextOptions } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import {
  addChartGuidesToCommandList,
  type ChartGuideOptions,
  type ChartLayout,
  type ChartLayoutOptions,
  type ChartRect,
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

export interface TimeSeriesBaseAnnotation {
  key: string
  label?: string
  visible?: boolean
  includeInYRange?: boolean
  labelVisible?: boolean
}

export interface TimeSeriesXLineAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'x-line'
  x: number
  color?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesYLineAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'y-line'
  y: number
  color?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesXRangeAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'x-range'
  xStart: number
  xEnd: number
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesYRangeAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'y-range'
  yStart: number
  yEnd: number
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesRulerAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'ruler'
  xStart: number
  xEnd: number
  yStart: number
  yEnd: number
  color?: RgbaColor
  lineWidth?: number
}

export type TimeSeriesAnnotation =
  | TimeSeriesXLineAnnotation
  | TimeSeriesYLineAnnotation
  | TimeSeriesXRangeAnnotation
  | TimeSeriesYRangeAnnotation
  | TimeSeriesRulerAnnotation

export interface TimeSeriesDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  series: readonly TimeSeriesSeries[]
  bands?: readonly TimeSeriesBand[]
  annotations?: readonly TimeSeriesAnnotation[]
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
  defaultAnnotationColor?: RgbaColor
  defaultAnnotationFillColor?: RgbaColor
  defaultAnnotationLineColor?: RgbaColor
  defaultAnnotationLineWidth?: number
  defaultAnnotationTextColor?: RgbaColor
  includeHidden?: boolean
  includeHiddenBands?: boolean
  includeHiddenAnnotations?: boolean
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

export interface TimeSeriesAnnotationStyle {
  line?: LineOptions
  fill?: FillOptions
  text?: TextOptions
}

export interface TimeSeriesPlannedAnnotation {
  kind: TimeSeriesAnnotation['kind']
  key: string
  label: string
  style: TimeSeriesAnnotationStyle
  lineSegments: readonly TimeSeriesLineSegment[]
  fillSegments: readonly TimeSeriesBandSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
  includeInYRange: boolean
  labelVisible: boolean
}

export interface TimeSeriesRenderPlan {
  kind: 'time-series'
  xRange: NumericRange
  xOrigin: number
  xRelativeRange: NumericRange
  yRange: NumericRange
  series: readonly TimeSeriesPlannedSeries[]
  bands: readonly TimeSeriesPlannedBand[]
  annotations: readonly TimeSeriesPlannedAnnotation[]
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

interface AnnotationBuildResult {
  lineSegments: TimeSeriesLineSegment[]
  fillSegments: TimeSeriesBandSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
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
  const plannedAnnotations: TimeSeriesPlannedAnnotation[] = []
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

  const annotations = data.annotations ?? []
  for (const annotation of annotations) {
    if (annotation.visible === false && options.includeHiddenAnnotations !== true) continue
    if (annotation.includeInYRange === true) {
      const extent = annotationYExtent(annotation)
      if (extent) {
        minY = Math.min(minY, extent[0])
        maxY = Math.max(maxY, extent[1])
      }
    }
  }

  const inferredYRange: NumericRange =
    minY === Number.POSITIVE_INFINITY ? [0, 1] : expandRange([minY, maxY], yPaddingRatio)
  const yRange = options.yRange ? normalizeRange(options.yRange) : inferredYRange

  for (let annotationIndex = 0; annotationIndex < annotations.length; annotationIndex++) {
    const annotation = annotations[annotationIndex] as TimeSeriesAnnotation
    if (annotation.visible === false && options.includeHiddenAnnotations !== true) continue

    const build = buildAnnotationSegments(annotation, {
      xRange,
      xOrigin,
      xRelativeRange,
      yRange,
    })

    if (build.includedSampleCount === 0) {
      warnings.push(`Annotation "${annotation.key}" has no geometry inside the visible range.`)
      continue
    }

    plannedAnnotations.push({
      kind: annotation.kind,
      key: annotation.key,
      label: annotation.label ?? annotation.key,
      style: resolveAnnotationStyle(annotation, annotationIndex, options),
      lineSegments: build.lineSegments,
      fillSegments: build.fillSegments,
      sourcePointCount: build.sourcePointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: build.sourcePointCount - build.includedSampleCount,
      includeInYRange: annotation.includeInYRange === true,
      labelVisible: annotation.labelVisible !== false,
    })
  }

  return {
    kind: 'time-series',
    xRange,
    xOrigin,
    xRelativeRange,
    yRange,
    series: plannedSeries,
    bands: plannedBands,
    annotations: plannedAnnotations,
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

export function addTimeSeriesAnnotationsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Overlay,
): void {
  for (const annotation of plan.annotations) {
    if (annotation.style.fill) {
      for (const segment of annotation.fillSegments) {
        commands.addFill(segment.upper, segment.lower, annotation.style.fill, fillZ)
      }
    }
    if (annotation.style.line) {
      for (const segment of annotation.lineSegments) {
        commands.addLine(segment.buffer, annotation.style.line, lineZ)
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
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, layout.plotArea)
    : createTimeSeriesViewTransform(plan, width, height)
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addTimeSeriesBandsToCommandList(commands, plan)
  addTimeSeriesAnnotationsToCommandList(commands, plan)
  addTimeSeriesToCommandList(commands, plan)
  addTimeSeriesAnnotationLabelsToCommandList(
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

function buildAnnotationSegments(
  annotation: TimeSeriesAnnotation,
  options: {
    xRange: NumericRange
    xOrigin: number
    xRelativeRange: NumericRange
    yRange: NumericRange
  },
): AnnotationBuildResult {
  switch (annotation.kind) {
    case 'x-line': {
      if (!isFiniteNumber(annotation.x) || !valueInRange(annotation.x, options.xRange)) {
        return emptyAnnotationBuildResult(2)
      }
      const x = annotation.x - options.xOrigin
      return lineAnnotationBuildResult(
        new Float32Array([x, options.yRange[0], x, options.yRange[1]]),
      )
    }
    case 'y-line': {
      if (!isFiniteNumber(annotation.y) || !valueInRange(annotation.y, options.yRange)) {
        return emptyAnnotationBuildResult(2)
      }
      return lineAnnotationBuildResult(
        new Float32Array([
          options.xRelativeRange[0],
          annotation.y,
          options.xRelativeRange[1],
          annotation.y,
        ]),
      )
    }
    case 'x-range': {
      const xRange = normalizeFiniteRange(annotation.xStart, annotation.xEnd)
      if (!xRange) return emptyAnnotationBuildResult(2)
      const visibleRange = intersectRanges(xRange, options.xRange)
      if (!visibleRange) return emptyAnnotationBuildResult(2)
      const xStart = visibleRange[0] - options.xOrigin
      const xEnd = visibleRange[1] - options.xOrigin
      const lower = new Float32Array([xStart, options.yRange[0], xEnd, options.yRange[0]])
      const upper = new Float32Array([xStart, options.yRange[1], xEnd, options.yRange[1]])
      return rangeAnnotationBuildResult(upper, lower, [
        new Float32Array([xStart, options.yRange[0], xStart, options.yRange[1]]),
        new Float32Array([xEnd, options.yRange[0], xEnd, options.yRange[1]]),
      ])
    }
    case 'y-range': {
      const yRange = normalizeFiniteRange(annotation.yStart, annotation.yEnd)
      if (!yRange) return emptyAnnotationBuildResult(2)
      const visibleRange = intersectRanges(yRange, options.yRange)
      if (!visibleRange) return emptyAnnotationBuildResult(2)
      const lower = new Float32Array([
        options.xRelativeRange[0],
        visibleRange[0],
        options.xRelativeRange[1],
        visibleRange[0],
      ])
      const upper = new Float32Array([
        options.xRelativeRange[0],
        visibleRange[1],
        options.xRelativeRange[1],
        visibleRange[1],
      ])
      return rangeAnnotationBuildResult(upper, lower, [
        new Float32Array([
          options.xRelativeRange[0],
          visibleRange[0],
          options.xRelativeRange[1],
          visibleRange[0],
        ]),
        new Float32Array([
          options.xRelativeRange[0],
          visibleRange[1],
          options.xRelativeRange[1],
          visibleRange[1],
        ]),
      ])
    }
    case 'ruler': {
      if (
        !isFiniteNumber(annotation.xStart) ||
        !isFiniteNumber(annotation.xEnd) ||
        !isFiniteNumber(annotation.yStart) ||
        !isFiniteNumber(annotation.yEnd)
      ) {
        return emptyAnnotationBuildResult(2)
      }
      const xRange = normalizeRange([annotation.xStart, annotation.xEnd])
      const yRange = normalizeRange([annotation.yStart, annotation.yEnd])
      if (!intersectRanges(xRange, options.xRange) || !intersectRanges(yRange, options.yRange)) {
        return emptyAnnotationBuildResult(2)
      }
      return lineAnnotationBuildResult(
        new Float32Array([
          annotation.xStart - options.xOrigin,
          annotation.yStart,
          annotation.xEnd - options.xOrigin,
          annotation.yEnd,
        ]),
      )
    }
  }
}

function lineAnnotationBuildResult(buffer: Float32Array): AnnotationBuildResult {
  return {
    lineSegments: [{ buffer, pointCount: 2 }],
    fillSegments: [],
    sourcePointCount: 2,
    includedSampleCount: 2,
    renderedPointCount: 2,
  }
}

function rangeAnnotationBuildResult(
  upper: Float32Array,
  lower: Float32Array,
  boundaries: readonly Float32Array[],
): AnnotationBuildResult {
  return {
    lineSegments: boundaries.map((buffer) => ({ buffer, pointCount: 2 })),
    fillSegments: [{ upper, lower, pointCount: 2 }],
    sourcePointCount: 2,
    includedSampleCount: 2,
    renderedPointCount: 2 + boundaries.length * 2,
  }
}

function emptyAnnotationBuildResult(sourcePointCount: number): AnnotationBuildResult {
  return {
    lineSegments: [],
    fillSegments: [],
    sourcePointCount,
    includedSampleCount: 0,
    renderedPointCount: 0,
  }
}

function annotationYExtent(annotation: TimeSeriesAnnotation): NumericRange | null {
  switch (annotation.kind) {
    case 'y-line':
      return isFiniteNumber(annotation.y) ? [annotation.y, annotation.y] : null
    case 'y-range':
      return normalizeFiniteRange(annotation.yStart, annotation.yEnd)
    case 'ruler':
      return normalizeFiniteRange(annotation.yStart, annotation.yEnd)
    case 'x-line':
    case 'x-range':
      return null
  }
}

function resolveAnnotationStyle(
  annotation: TimeSeriesAnnotation,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesAnnotationStyle {
  const base = getDefaultColor(index, options.defaultAnnotationColor)
  const defaultLineColor = options.defaultAnnotationLineColor ?? base
  const defaultFillColor = options.defaultAnnotationFillColor ?? [
    base[0],
    base[1],
    base[2],
    Math.min(base[3], 0.1),
  ]
  const width = annotation.lineWidth ?? options.defaultAnnotationLineWidth ?? 1
  const style: TimeSeriesAnnotationStyle = {
    text: {
      color:
        options.defaultAnnotationTextColor ??
        annotationTextColor(annotation, defaultLineColor, defaultFillColor),
      fontSize: 11,
    },
  }

  if (annotation.kind === 'x-range' || annotation.kind === 'y-range') {
    style.fill = { color: annotation.fillColor ?? defaultFillColor }
    const lineColor = annotation.lineColor ?? options.defaultAnnotationLineColor
    if (lineColor) {
      style.line = {
        color: lineColor,
        width,
      }
    }
    return style
  }

  style.line = {
    color: annotation.color ?? defaultLineColor,
    width,
  }
  return style
}

function annotationTextColor(
  annotation: TimeSeriesAnnotation,
  defaultLineColor: RgbaColor,
  defaultFillColor: RgbaColor,
): RgbaColor {
  if (annotation.kind === 'x-range' || annotation.kind === 'y-range') {
    return (
      annotation.lineColor ??
      annotation.fillColor ?? [defaultFillColor[0], defaultFillColor[1], defaultFillColor[2], 1]
    )
  }
  return annotation.color ?? defaultLineColor
}

function addTimeSeriesAnnotationLabelsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  transform: ViewTransform,
  plotArea: ChartRect,
): void {
  for (const annotation of plan.annotations) {
    if (!annotation.labelVisible || !annotation.label || !annotation.style.text) continue
    const anchor = annotationLabelAnchor(annotation, plan)
    if (!anchor) continue
    const point = transform.dataToPixel(anchor.x, anchor.y)
    const x = clampNumber(point.x + anchor.dx, plotArea.x + 4, plotArea.x + plotArea.width - 4)
    const y = clampNumber(point.y + anchor.dy, plotArea.y + 4, plotArea.y + plotArea.height - 4)
    commands.addText(
      annotation.label,
      x,
      y,
      {
        ...annotation.style.text,
        align: anchor.align,
        baseline: anchor.baseline,
      },
      ZLayer.Text,
    )
  }
}

interface AnnotationLabelAnchor {
  x: number
  y: number
  dx: number
  dy: number
  align: NonNullable<TextOptions['align']>
  baseline: NonNullable<TextOptions['baseline']>
}

function annotationLabelAnchor(
  annotation: TimeSeriesPlannedAnnotation,
  plan: TimeSeriesRenderPlan,
): AnnotationLabelAnchor | null {
  switch (annotation.kind) {
    case 'x-line': {
      const segment = annotation.lineSegments[0]
      const x = segment?.buffer[0]
      if (x === undefined) return null
      return { x, y: plan.yRange[1], dx: 4, dy: 4, align: 'left', baseline: 'top' }
    }
    case 'y-line': {
      const segment = annotation.lineSegments[0]
      const y = segment?.buffer[1]
      if (y === undefined) return null
      return { x: plan.xRelativeRange[0], y, dx: 4, dy: -4, align: 'left', baseline: 'bottom' }
    }
    case 'x-range': {
      const segment = annotation.fillSegments[0]
      const xStart = segment?.upper[0]
      const xEnd = segment?.upper[2]
      if (xStart === undefined || xEnd === undefined) return null
      return {
        x: (xStart + xEnd) / 2,
        y: plan.yRange[1],
        dx: 0,
        dy: 4,
        align: 'center',
        baseline: 'top',
      }
    }
    case 'y-range': {
      const segment = annotation.fillSegments[0]
      const yLow = segment?.lower[1]
      const yHigh = segment?.upper[1]
      if (yLow === undefined || yHigh === undefined) return null
      return {
        x: plan.xRelativeRange[0],
        y: (yLow + yHigh) / 2,
        dx: 4,
        dy: 0,
        align: 'left',
        baseline: 'middle',
      }
    }
    case 'ruler': {
      const segment = annotation.lineSegments[0]
      const x0 = segment?.buffer[0]
      const y0 = segment?.buffer[1]
      const x1 = segment?.buffer[2]
      const y1 = segment?.buffer[3]
      if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) {
        return null
      }
      return {
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
        dx: 4,
        dy: -4,
        align: 'left',
        baseline: 'bottom',
      }
    }
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

function normalizeFiniteRange(start: number, end: number): NumericRange | null {
  if (!isFiniteNumber(start) || !isFiniteNumber(end)) return null
  return normalizeRange([start, end])
}

function valueInRange(value: number, range: NumericRange): boolean {
  return value >= range[0] && value <= range[1]
}

function intersectRanges(left: NumericRange, right: NumericRange): NumericRange | null {
  const start = Math.max(left[0], right[0])
  const end = Math.min(left[1], right[1])
  return start <= end ? [start, end] : null
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
