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

export type TimeSeriesEventMarkerType =
  | 'start'
  | 'stop'
  | 'alarm'
  | 'comment'
  | 'batch'
  | 'hold'
  | 'investigation'
  | 'correction'
  | 'maintenance'

export type TimeSeriesEventMarkerPlacement = 'top-tick' | 'bottom-tick' | 'full-height'

export interface TimeSeriesEventMarker {
  key: string
  x: number
  label?: string
  eventType?: TimeSeriesEventMarkerType
  placement?: TimeSeriesEventMarkerPlacement
  color?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export type TimeSeriesAnomalyTrackPlacement = 'bottom' | 'top'

export type TimeSeriesAnomalyTrackReviewerState =
  | 'unreviewed'
  | 'review-pending'
  | 'approved'
  | 'rejected'

export interface TimeSeriesAnomalyTrack {
  key: string
  label?: string
  scoreField: string
  threshold?: number
  modelVersion?: string
  reviewerState?: TimeSeriesAnomalyTrackReviewerState
  placement?: TimeSeriesAnomalyTrackPlacement
  laneHeightRatio?: number
  laneOffsetRatio?: number
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  thresholdColor?: RgbaColor
  lineWidth?: number
  gapThreshold?: number
  visible?: boolean
}

export interface TimeSeriesDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  series: readonly TimeSeriesSeries[]
  bands?: readonly TimeSeriesBand[]
  annotations?: readonly TimeSeriesAnnotation[]
  eventMarkers?: readonly TimeSeriesEventMarker[]
  anomalyTracks?: readonly TimeSeriesAnomalyTrack[]
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
  defaultEventMarkerColor?: RgbaColor
  defaultEventMarkerLineWidth?: number
  defaultEventMarkerTextColor?: RgbaColor
  defaultAnomalyTrackFillColor?: RgbaColor
  defaultAnomalyTrackLineColor?: RgbaColor
  defaultAnomalyTrackThresholdColor?: RgbaColor
  defaultAnomalyTrackLineWidth?: number
  eventMarkerTickRatio?: number
  includeHidden?: boolean
  includeHiddenBands?: boolean
  includeHiddenAnnotations?: boolean
  includeHiddenEventMarkers?: boolean
  includeHiddenAnomalyTracks?: boolean
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

export interface TimeSeriesEventMarkerStyle {
  line: LineOptions
  text?: TextOptions
}

export interface TimeSeriesPlannedEventMarker {
  key: string
  label: string
  eventType: TimeSeriesEventMarkerType
  placement: TimeSeriesEventMarkerPlacement
  style: TimeSeriesEventMarkerStyle
  lineSegments: readonly TimeSeriesLineSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
  labelVisible: boolean
}

export interface TimeSeriesAnomalyTrackStyle {
  fill: FillOptions
  line?: LineOptions
  threshold?: LineOptions
}

export interface TimeSeriesPlannedAnomalyTrack {
  key: string
  label: string
  scoreField: string
  threshold?: number
  modelVersion?: string
  reviewerState: TimeSeriesAnomalyTrackReviewerState
  placement: TimeSeriesAnomalyTrackPlacement
  style: TimeSeriesAnomalyTrackStyle
  fillSegments: readonly TimeSeriesBandSegment[]
  lineSegments: readonly TimeSeriesLineSegment[]
  thresholdSegments: readonly TimeSeriesLineSegment[]
  laneRange: NumericRange
  scoreRange: NumericRange
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
  bands: readonly TimeSeriesPlannedBand[]
  annotations: readonly TimeSeriesPlannedAnnotation[]
  eventMarkers: readonly TimeSeriesPlannedEventMarker[]
  anomalyTracks: readonly TimeSeriesPlannedAnomalyTrack[]
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

interface EventMarkerBuildResult {
  lineSegments: TimeSeriesLineSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
}

interface AnomalyTrackBuildResult {
  fillSegments: TimeSeriesBandSegment[]
  lineSegments: TimeSeriesLineSegment[]
  thresholdSegments: TimeSeriesLineSegment[]
  laneRange: NumericRange
  scoreRange: NumericRange
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
  const plannedEventMarkers: TimeSeriesPlannedEventMarker[] = []
  const plannedAnomalyTracks: TimeSeriesPlannedAnomalyTrack[] = []
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

  const eventMarkers = data.eventMarkers ?? []
  const eventMarkerTickRatio = options.eventMarkerTickRatio ?? 0.1
  for (let markerIndex = 0; markerIndex < eventMarkers.length; markerIndex++) {
    const marker = eventMarkers[markerIndex] as TimeSeriesEventMarker
    if (marker.visible === false && options.includeHiddenEventMarkers !== true) continue

    const build = buildEventMarkerSegments(marker, {
      xRange,
      xOrigin,
      yRange,
      tickRatio: eventMarkerTickRatio,
    })

    if (build.includedSampleCount === 0) {
      warnings.push(`Event marker "${marker.key}" has no geometry inside the visible range.`)
      continue
    }

    plannedEventMarkers.push({
      key: marker.key,
      label: marker.label ?? marker.key,
      eventType: marker.eventType ?? 'comment',
      placement: marker.placement ?? 'top-tick',
      style: resolveEventMarkerStyle(marker, markerIndex, options),
      lineSegments: build.lineSegments,
      sourcePointCount: build.sourcePointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: build.sourcePointCount - build.includedSampleCount,
      labelVisible: marker.labelVisible === true,
    })
  }

  const anomalyTracks = data.anomalyTracks ?? []
  const trackOffsets = {
    bottom: 0,
    top: 0,
  }
  for (let trackIndex = 0; trackIndex < anomalyTracks.length; trackIndex++) {
    const track = anomalyTracks[trackIndex] as TimeSeriesAnomalyTrack
    if (track.visible === false && options.includeHiddenAnomalyTracks !== true) continue

    const values = data.columns[track.scoreField]
    if (!values) {
      warnings.push(
        `Anomaly track "${track.key}" skipped because column "${track.scoreField}" is missing.`,
      )
      continue
    }

    const placement = track.placement ?? 'bottom'
    const laneHeightRatio = clampNumber(track.laneHeightRatio ?? 0.12, 0.02, 0.45)
    const laneOffsetRatio =
      track.laneOffsetRatio ?? trackOffsets[placement] * (laneHeightRatio + 0.015)
    trackOffsets[placement] += 1

    const build = buildAnomalyTrackSegments(data.timestamps, values, track, {
      xRange,
      xOrigin,
      yRange,
      placement,
      laneHeightRatio,
      laneOffsetRatio,
      gapThreshold: track.gapThreshold ?? options.gapThreshold ?? 0,
    })

    if (build.includedSampleCount === 0) {
      warnings.push(`Anomaly track "${track.key}" has no samples inside the visible x-range.`)
      continue
    }

    plannedAnomalyTracks.push({
      key: track.key,
      label: track.label ?? track.key,
      scoreField: track.scoreField,
      ...(track.threshold !== undefined ? { threshold: clampNumber(track.threshold, 0, 1) } : {}),
      ...(track.modelVersion !== undefined ? { modelVersion: track.modelVersion } : {}),
      reviewerState: track.reviewerState ?? 'unreviewed',
      placement,
      style: resolveAnomalyTrackStyle(track, trackIndex, options),
      fillSegments: build.fillSegments,
      lineSegments: build.lineSegments,
      thresholdSegments: build.thresholdSegments,
      laneRange: build.laneRange,
      scoreRange: build.scoreRange,
      sourcePointCount: build.sourcePointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: build.sourcePointCount - build.includedSampleCount,
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
    eventMarkers: plannedEventMarkers,
    anomalyTracks: plannedAnomalyTracks,
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

export function addTimeSeriesEventMarkersToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  z: ZLayer = ZLayer.Overlay,
): void {
  for (const marker of plan.eventMarkers) {
    for (const segment of marker.lineSegments) {
      commands.addLine(segment.buffer, marker.style.line, z)
    }
  }
}

export function addTimeSeriesAnomalyTracksToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Overlay,
): void {
  for (const track of plan.anomalyTracks) {
    for (const segment of track.fillSegments) {
      commands.addFill(segment.upper, segment.lower, track.style.fill, fillZ)
    }
    if (track.style.line) {
      for (const segment of track.lineSegments) {
        commands.addLine(segment.buffer, track.style.line, lineZ)
      }
    }
    if (track.style.threshold) {
      for (const segment of track.thresholdSegments) {
        commands.addLine(segment.buffer, track.style.threshold, lineZ)
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
  addTimeSeriesAnomalyTracksToCommandList(commands, plan)
  addTimeSeriesToCommandList(commands, plan)
  addTimeSeriesEventMarkersToCommandList(commands, plan)
  addTimeSeriesAnnotationLabelsToCommandList(
    commands,
    plan,
    transform,
    layout?.plotArea ?? { x: 0, y: 0, width, height },
  )
  addTimeSeriesEventMarkerLabelsToCommandList(
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

function buildEventMarkerSegments(
  marker: TimeSeriesEventMarker,
  options: {
    xRange: NumericRange
    xOrigin: number
    yRange: NumericRange
    tickRatio: number
  },
): EventMarkerBuildResult {
  if (!isFiniteNumber(marker.x) || !valueInRange(marker.x, options.xRange)) {
    return emptyEventMarkerBuildResult()
  }

  const x = marker.x - options.xOrigin
  const ySpan = options.yRange[1] - options.yRange[0]
  const tickSpan = Math.max(Number.EPSILON, ySpan * clampNumber(options.tickRatio, 0.02, 1))
  const placement = marker.placement ?? 'top-tick'
  const yStart =
    placement === 'full-height'
      ? options.yRange[0]
      : placement === 'bottom-tick'
        ? options.yRange[0]
        : options.yRange[1] - tickSpan
  const yEnd =
    placement === 'full-height'
      ? options.yRange[1]
      : placement === 'bottom-tick'
        ? options.yRange[0] + tickSpan
        : options.yRange[1]

  return {
    lineSegments: [{ buffer: new Float32Array([x, yStart, x, yEnd]), pointCount: 2 }],
    sourcePointCount: 1,
    includedSampleCount: 1,
    renderedPointCount: 2,
  }
}

function emptyEventMarkerBuildResult(): EventMarkerBuildResult {
  return {
    lineSegments: [],
    sourcePointCount: 1,
    includedSampleCount: 0,
    renderedPointCount: 0,
  }
}

function buildAnomalyTrackSegments(
  timestamps: Float64Array,
  scores: Float64Array,
  track: TimeSeriesAnomalyTrack,
  options: {
    xRange: NumericRange
    xOrigin: number
    yRange: NumericRange
    placement: TimeSeriesAnomalyTrackPlacement
    laneHeightRatio: number
    laneOffsetRatio: number
    gapThreshold: number
  },
): AnomalyTrackBuildResult {
  const pointCount = Math.min(timestamps.length, scores.length)
  const fillUpperScratch = new Float32Array(pointCount * 2)
  const fillLowerScratch = new Float32Array(pointCount * 2)
  const lineScratch = new Float32Array(pointCount * 2)
  const fillSegments: TimeSeriesBandSegment[] = []
  const lineSegments: TimeSeriesLineSegment[] = []
  let write = 0
  let segmentStart = 0
  let segmentPointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let minScore = Number.POSITIVE_INFINITY
  let maxScore = Number.NEGATIVE_INFINITY
  let previousTimestamp = 0

  const ySpan = Math.max(Number.EPSILON, options.yRange[1] - options.yRange[0])
  const laneHeight = ySpan * options.laneHeightRatio
  const laneOffset = ySpan * clampNumber(options.laneOffsetRatio, 0, 0.9)
  const laneRange: NumericRange =
    options.placement === 'top'
      ? [options.yRange[1] - laneOffset - laneHeight, options.yRange[1] - laneOffset]
      : [options.yRange[0] + laneOffset, options.yRange[0] + laneOffset + laneHeight]
  const laneBase = laneRange[0]

  const pushSegment = () => {
    if (segmentPointCount >= 2) {
      fillSegments.push({
        upper: fillUpperScratch.subarray(segmentStart, write),
        lower: fillLowerScratch.subarray(segmentStart, write),
        pointCount: segmentPointCount,
      })
      lineSegments.push({
        buffer: lineScratch.subarray(segmentStart, write),
        pointCount: segmentPointCount,
      })
      renderedPointCount += segmentPointCount * 2
    }
    segmentPointCount = 0
    segmentStart = write
  }

  const appendPoint = (x: number, score: number) => {
    const y = laneBase + score * laneHeight
    fillLowerScratch[write] = x
    fillLowerScratch[write + 1] = laneBase
    fillUpperScratch[write] = x
    fillUpperScratch[write + 1] = y
    lineScratch[write] = x
    lineScratch[write + 1] = y
    write += 2
    segmentPointCount += 1
  }

  for (let i = 0; i < pointCount; i++) {
    const timestamp = timestamps[i]
    const rawScore = scores[i]
    if (
      !isFiniteNumber(timestamp) ||
      !isFiniteNumber(rawScore) ||
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

    const score = clampNumber(rawScore, 0, 1)
    appendPoint(timestamp - options.xOrigin, score)
    includedSampleCount += 1
    minScore = Math.min(minScore, score)
    maxScore = Math.max(maxScore, score)
    previousTimestamp = timestamp
  }

  pushSegment()

  const thresholdSegments: TimeSeriesLineSegment[] = []
  const threshold = track.threshold === undefined ? undefined : clampNumber(track.threshold, 0, 1)
  if (threshold !== undefined && isFiniteNumber(threshold)) {
    const y = laneBase + threshold * laneHeight
    thresholdSegments.push({
      buffer: new Float32Array([
        options.xRange[0] - options.xOrigin,
        y,
        options.xRange[1] - options.xOrigin,
        y,
      ]),
      pointCount: 2,
    })
    renderedPointCount += 2
  }

  return {
    fillSegments,
    lineSegments,
    thresholdSegments,
    laneRange,
    scoreRange: includedSampleCount === 0 ? [0, 0] : [minScore, maxScore],
    sourcePointCount: pointCount,
    includedSampleCount,
    renderedPointCount,
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

function resolveEventMarkerStyle(
  marker: TimeSeriesEventMarker,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesEventMarkerStyle {
  const color =
    marker.color ??
    options.defaultEventMarkerColor ??
    eventMarkerDefaultColor(marker.eventType ?? 'comment', index)
  return {
    line: {
      color,
      width: marker.lineWidth ?? options.defaultEventMarkerLineWidth ?? 1,
    },
    text: {
      color: options.defaultEventMarkerTextColor ?? color,
      fontSize: 11,
    },
  }
}

function resolveAnomalyTrackStyle(
  track: TimeSeriesAnomalyTrack,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesAnomalyTrackStyle {
  const base = getDefaultColor(index, options.defaultAnomalyTrackLineColor)
  const fillColor = track.fillColor ??
    options.defaultAnomalyTrackFillColor ?? [base[0], base[1], base[2], Math.min(base[3], 0.2)]
  const lineColor = track.lineColor ?? options.defaultAnomalyTrackLineColor ?? base
  const thresholdColor = track.thresholdColor ??
    options.defaultAnomalyTrackThresholdColor ?? [0.82, 0.12, 0.08, 0.82]
  const width = track.lineWidth ?? options.defaultAnomalyTrackLineWidth ?? 1
  const style: TimeSeriesAnomalyTrackStyle = {
    fill: { color: fillColor },
    line: {
      color: lineColor,
      width,
    },
  }
  if (track.threshold !== undefined) {
    style.threshold = {
      color: thresholdColor,
      width: Math.max(1, width),
    }
  }
  return style
}

function eventMarkerDefaultColor(type: TimeSeriesEventMarkerType, index: number): RgbaColor {
  switch (type) {
    case 'alarm':
      return [0.9, 0.12, 0.08, 0.85]
    case 'batch':
      return [0.1, 0.35, 0.9, 0.85]
    case 'hold':
      return [0.95, 0.62, 0.05, 0.85]
    case 'investigation':
      return [0.56, 0.22, 0.86, 0.85]
    case 'correction':
      return [0.02, 0.62, 0.45, 0.85]
    case 'maintenance':
      return [0.45, 0.45, 0.45, 0.85]
    case 'start':
      return [0.1, 0.65, 0.25, 0.85]
    case 'stop':
      return [0.78, 0.12, 0.12, 0.85]
    case 'comment':
      return getDefaultColor(index, [0.25, 0.25, 0.25, 0.8])
  }
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

function addTimeSeriesEventMarkerLabelsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  transform: ViewTransform,
  plotArea: ChartRect,
): void {
  for (const marker of plan.eventMarkers) {
    if (!marker.labelVisible || !marker.label || !marker.style.text) continue
    const segment = marker.lineSegments[0]
    const x = segment?.buffer[0]
    const y0 = segment?.buffer[1]
    const y1 = segment?.buffer[3]
    if (x === undefined || y0 === undefined || y1 === undefined) continue

    const anchorY = marker.placement === 'bottom-tick' ? y0 : y1
    const point = transform.dataToPixel(x, anchorY)
    const xPixel = clampNumber(point.x + 4, plotArea.x + 4, plotArea.x + plotArea.width - 4)
    const yPixel = clampNumber(
      point.y + (marker.placement === 'bottom-tick' ? -4 : 4),
      plotArea.y + 4,
      plotArea.y + plotArea.height - 4,
    )
    commands.addText(
      marker.label,
      xPixel,
      yPixel,
      {
        ...marker.style.text,
        align: 'left',
        baseline: marker.placement === 'bottom-tick' ? 'bottom' : 'top',
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
