import { RenderCommandList, ZLayer } from '../renderer/render-command-list.js'
import type { FillOptions, LineOptions, RenderContext, TextOptions } from '../renderer/types.js'
import { ViewTransform } from '../renderer/view-transform.js'
import type { ChartScale } from './axis-scale.js'
import { type ChartFrameOptions, extendChartFrame, renderChartFrame } from './chart-frame.js'
import {
  addChartGuidesToCommandList,
  type ChartLayout,
  type ChartRect,
  createPlotViewportTransform,
  createViewportTransform,
  expandRange,
  finiteRange,
  getDefaultColor,
  isFiniteNumber,
  type NamedYAxisLayoutOptions,
  type NumericRange,
  normalizeRange,
  type RgbaColor,
  relativeRange,
  resolveChartLayout,
} from './common.js'
import { TimeSeriesSampleKind } from './time-series-alignment.js'
import {
  buildStyledTimeSeriesBarBatches,
  buildStyledTimeSeriesPointBatches,
  buildTimeSeriesArea,
  buildTimeSeriesBarBounds,
  buildTimeSeriesPointBounds,
  tessellateTimeSeriesSpline,
} from './time-series-geometry.js'
import { sameTimeSeriesTimestamps, stackTimeSeriesColumns } from './time-series-stack.js'

export type TimeSeriesInterpolation = 'linear' | 'step-after' | 'step-before' | 'spline'

export type TimeSeriesMark = 'line' | 'area' | 'bar' | 'point'

export interface TimeSeriesStackGroup {
  /** Series keys ordered from the baseline outward. */
  series: readonly string[]
  /** Split positive and negative contributions by default. */
  mode?: 'split' | 'cumulative'
}

export interface TimeSeriesStackOptions {
  groups: readonly TimeSeriesStackGroup[]
  /** Convert contributions and their bases to signed proportions. */
  percent?: boolean
}

/** Input sample used to style a point or bar in the current render plan. */
export interface TimeSeriesMarkSample {
  seriesKey: string
  field: string
  index: number
  timestamp: number
  value: number
  /** Value after stacking, if the series belongs to a stack. */
  plottedValue: number
  baseline?: number
}

export interface TimeSeriesPointStyle {
  visible?: boolean
  size?: number
  color?: RgbaColor
  shape?: 'square' | 'circle'
}

export interface TimeSeriesBarStyle {
  visible?: boolean
  color?: RgbaColor
  /** Bar width in CSS pixels. Takes precedence over widthRatio. */
  width?: number
  /** Fraction of the available space between neighboring samples. */
  widthRatio?: number
}

export type TimeSeriesBarStyleCallback = (
  sample: TimeSeriesMarkSample,
) => TimeSeriesBarStyle | undefined

export interface TimeSeriesPointOptions {
  /** Marker diameter in CSS pixels. */
  size?: number
  color?: RgbaColor
  shape?: 'square' | 'circle'
  /** Override styling or suppress individual sample markers. */
  style?: (sample: TimeSeriesMarkSample) => TimeSeriesPointStyle | undefined
}

export interface TimeSeriesPathContext {
  series: TimeSeriesPlannedSeries
  xRange: NumericRange
  xOrigin: number
  yRange: NumericRange
  /** The active axis transform is available when building a complete command frame. */
  transform?: ViewTransform
  commands: Pick<RenderCommandList, 'addLine' | 'addFill' | 'addRect' | 'addMarks' | 'addText'>
}

/** Replace the default series geometry with portable render commands. */
export type TimeSeriesPathBuilder = (context: TimeSeriesPathContext) => void

/** An independent vertical scale. The first configured axis is the primary scale. */
export interface TimeSeriesYAxisOptions extends NamedYAxisLayoutOptions {
  paddingRatio?: number
}

export interface TimeSeriesPlannedYAxis extends TimeSeriesYAxisOptions {
  range: NumericRange
}

export interface TimeSeriesSeries {
  key: string
  yAxisKey?: string
  label: string
  field: string
  color?: RgbaColor
  lineWidth?: number
  /** Dash and gap lengths in CSS pixels. */
  dash?: readonly number[]
  interpolation?: TimeSeriesInterpolation
  visible?: boolean
  gapThreshold?: number
  /** Draw through missing samples while still respecting the elapsed-time gap threshold. */
  spanGaps?: boolean
  mark?: TimeSeriesMark
  /** Fill color for bars, areas or a line filled to its baseline. */
  fillColor?: RgbaColor
  /** Baseline for bars and filled areas, defaulting to zero. */
  baseline?: number
  /** Fraction of local sample spacing occupied by a bar. Defaults to 0.75. */
  barWidthRatio?: number
  /** Override styling or suppress individual bars. */
  barStyle?: TimeSeriesBarStyleCallback
  /** Show markers at real sample coordinates on any enabled series. */
  points?: TimeSeriesPointOptions
  path?: TimeSeriesPathBuilder
}

export interface TimeSeriesValueBand {
  kind: 'value-band'
  key: string
  yAxisKey?: string
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
  yAxisKey?: string
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
  yAxisKey?: string
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
  yAxisKey?: string
  yStart: number
  yEnd: number
  fillColor?: RgbaColor
  lineColor?: RgbaColor
  lineWidth?: number
}

export interface TimeSeriesRulerAnnotation extends TimeSeriesBaseAnnotation {
  kind: 'ruler'
  yAxisKey?: string
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

export type TimeSeriesSpcChartKind =
  | 'individual'
  | 'moving-range'
  | 'xbar'
  | 'range'
  | 's'
  | 'p'
  | 'np'
  | 'c'
  | 'u'

export type TimeSeriesSpcRuleSeverity = 'warning' | 'violation'

export interface TimeSeriesSpcRuleMarker {
  key: string
  x: number
  label?: string
  rule?: string
  severity?: TimeSeriesSpcRuleSeverity
  color?: RgbaColor
  lineWidth?: number
  visible?: boolean
  labelVisible?: boolean
}

export interface TimeSeriesSpcTrack {
  key: string
  yAxisKey?: string
  label?: string
  chartKind?: TimeSeriesSpcChartKind
  centerLine: number
  upperControlLimit?: number
  lowerControlLimit?: number
  upperWarningLimit?: number
  lowerWarningLimit?: number
  xRange?: NumericRange
  zoneFillColor?: RgbaColor
  warningFillColor?: RgbaColor
  centerLineColor?: RgbaColor
  controlLineColor?: RgbaColor
  warningLineColor?: RgbaColor
  markerColor?: RgbaColor
  markerLineWidth?: number
  lineWidth?: number
  markers?: readonly TimeSeriesSpcRuleMarker[]
  visible?: boolean
  includeInYRange?: boolean
}

export interface TimeSeriesDataSet {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  /** Optional field-specific timestamps for independently sampled series. */
  seriesTimestamps?: Record<string, Float64Array>
  /** Optional sample kinds from alignTimeSeriesColumns. */
  sampleKinds?: Record<string, Uint8Array>
  series: readonly TimeSeriesSeries[]
  bands?: readonly TimeSeriesBand[]
  annotations?: readonly TimeSeriesAnnotation[]
  eventMarkers?: readonly TimeSeriesEventMarker[]
  anomalyTracks?: readonly TimeSeriesAnomalyTrack[]
  spcTracks?: readonly TimeSeriesSpcTrack[]
}

export interface TimeSeriesRenderOptions {
  xRange?: NumericRange
  yRange?: NumericRange
  /** Scale for primary-domain inference when using a legacy Y axis. */
  yScale?: ChartScale
  yAxes?: readonly TimeSeriesYAxisOptions[]
  stack?: TimeSeriesStackOptions
  gapThreshold?: number
  interpolation?: TimeSeriesInterpolation
  spanGaps?: boolean
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
  defaultSpcZoneFillColor?: RgbaColor
  defaultSpcWarningFillColor?: RgbaColor
  defaultSpcCenterLineColor?: RgbaColor
  defaultSpcControlLineColor?: RgbaColor
  defaultSpcWarningLineColor?: RgbaColor
  defaultSpcMarkerColor?: RgbaColor
  defaultSpcLineWidth?: number
  defaultSpcMarkerLineWidth?: number
  defaultSpcTextColor?: RgbaColor
  eventMarkerTickRatio?: number
  spcMarkerTickRatio?: number
  includeHidden?: boolean
  includeHiddenBands?: boolean
  includeHiddenAnnotations?: boolean
  includeHiddenEventMarkers?: boolean
  includeHiddenAnomalyTracks?: boolean
  includeHiddenSpcTracks?: boolean
  yPaddingRatio?: number
}

export interface TimeSeriesLineSegment {
  buffer: Float32Array
  pointCount: number
  /** Interleaved X/Y coordinates of the corresponding stacked baseline. */
  lower?: Float32Array
  /** Indices into the input arrays for opt-in mark callbacks. */
  sampleIndices?: Uint32Array
}

export interface TimeSeriesPlannedSeries {
  key: string
  yAxisKey?: string
  label: string
  field: string
  style: LineOptions
  interpolation: TimeSeriesInterpolation
  segments: readonly TimeSeriesLineSegment[]
  mark?: TimeSeriesMark
  fillColor?: RgbaColor
  baseline?: number
  barWidthRatio?: number
  barStyle?: TimeSeriesBarStyleCallback
  points?: TimeSeriesPointOptions
  path?: TimeSeriesPathBuilder
  /** Unprojected input columns for mark callbacks. */
  markSource?: {
    timestamps: Float64Array
    values: Float64Array
    plottedValues: Float64Array
  }
  /** Actual samples for point markers on a stepped line. */
  pointSegments?: readonly TimeSeriesLineSegment[]
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
  yAxisKey?: string
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
  yAxisKey?: string
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

export interface TimeSeriesSpcRuleMarkerStyle {
  line: LineOptions
  text?: TextOptions
}

export interface TimeSeriesSpcPlannedRuleMarker {
  key: string
  label: string
  rule?: string
  severity: TimeSeriesSpcRuleSeverity
  x: number
  style: TimeSeriesSpcRuleMarkerStyle
  lineSegments: readonly TimeSeriesLineSegment[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  droppedPointCount: number
  labelVisible: boolean
}

export interface TimeSeriesSpcTrackStyle {
  zoneFill?: FillOptions
  warningFill?: FillOptions
  centerLine: LineOptions
  controlLine?: LineOptions
  warningLine?: LineOptions
}

export interface TimeSeriesPlannedSpcTrack {
  key: string
  yAxisKey?: string
  label: string
  chartKind: TimeSeriesSpcChartKind
  centerLine: number
  upperControlLimit?: number
  lowerControlLimit?: number
  upperWarningLimit?: number
  lowerWarningLimit?: number
  style: TimeSeriesSpcTrackStyle
  zoneSegments: readonly TimeSeriesBandSegment[]
  warningZoneSegments: readonly TimeSeriesBandSegment[]
  centerLineSegments: readonly TimeSeriesLineSegment[]
  controlLimitSegments: readonly TimeSeriesLineSegment[]
  warningLimitSegments: readonly TimeSeriesLineSegment[]
  markers: readonly TimeSeriesSpcPlannedRuleMarker[]
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
  yAxes?: readonly TimeSeriesPlannedYAxis[]
  series: readonly TimeSeriesPlannedSeries[]
  bands: readonly TimeSeriesPlannedBand[]
  annotations: readonly TimeSeriesPlannedAnnotation[]
  eventMarkers: readonly TimeSeriesPlannedEventMarker[]
  anomalyTracks: readonly TimeSeriesPlannedAnomalyTrack[]
  spcTracks: readonly TimeSeriesPlannedSpcTrack[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  segmentCount: number
  warnings: readonly string[]
}

export type TimeSeriesFrameOptions = ChartFrameOptions<TimeSeriesRenderPlan>

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

interface SpcTrackBuildResult {
  zoneSegments: TimeSeriesBandSegment[]
  warningZoneSegments: TimeSeriesBandSegment[]
  centerLineSegments: TimeSeriesLineSegment[]
  controlLimitSegments: TimeSeriesLineSegment[]
  warningLimitSegments: TimeSeriesLineSegment[]
  markers: TimeSeriesSpcPlannedRuleMarker[]
  sourcePointCount: number
  includedSampleCount: number
  renderedPointCount: number
  minY: number
  maxY: number
}

interface TimeSeriesAxisState {
  options: TimeSeriesYAxisOptions
  min: number
  max: number
  range: NumericRange
}

function createAxisState(options: TimeSeriesYAxisOptions): TimeSeriesAxisState {
  return {
    options,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    range: [0, 1],
  }
}

function collectYAxes(
  definitions: readonly TimeSeriesYAxisOptions[],
  warnings: string[],
): Map<string, TimeSeriesAxisState> {
  const axes = new Map<string, TimeSeriesAxisState>()
  for (const axis of definitions) {
    if (axis.key.trim().length === 0) {
      warnings.push('A Y axis with an empty key was ignored.')
    } else if (axes.has(axis.key)) {
      warnings.push(`Duplicate Y axis "${axis.key}" was ignored.`)
    } else if (axis.from && !axes.has(axis.from.key)) {
      warnings.push(
        `Y axis "${axis.key}" was ignored because source axis "${axis.from.key}" must precede it.`,
      )
    } else {
      axes.set(axis.key, createAxisState(axis))
    }
  }
  return axes
}

function resolveAxisRange(
  axis: TimeSeriesAxisState,
  legacyRange: NumericRange | undefined,
  legacyPadding: number | undefined,
): NumericRange {
  const fixedRange = axis.options.range ?? legacyRange
  const scale = axis.options.scale
  if (scale?.type !== 'log') {
    if (fixedRange) return normalizeRange(fixedRange)
    if (axis.min === Number.POSITIVE_INFINITY) return axis.range
    return expandRange([axis.min, axis.max], axis.options.paddingRatio ?? legacyPadding ?? 0.05)
  }
  const base = scale.base ?? 10
  if (fixedRange?.every((value) => Number.isFinite(value) && value > 0)) {
    if (fixedRange[0] !== fixedRange[1]) return normalizeRange(fixedRange)
    return [fixedRange[0] / base, fixedRange[0] * base]
  }
  if (axis.min === Number.POSITIVE_INFINITY) return [1, base]
  if (axis.min === axis.max) return [axis.min / base, axis.max * base]
  const padding = axis.options.paddingRatio ?? legacyPadding ?? 0.05
  if (padding === 0) return [axis.min, axis.max]
  const minLog = Math.log(axis.min)
  const maxLog = Math.log(axis.max)
  const logPadding = Math.max(padding, 0) * (maxLog - minLog)
  return [
    Math.max(Number.MIN_VALUE, Math.exp(minLog - logPadding)),
    Math.min(Number.MAX_VALUE, Math.exp(maxLog + logPadding)),
  ]
}

function propagateDependentExtents(axisStates: ReadonlyMap<string, TimeSeriesAxisState>): void {
  const axes = Array.from(axisStates.values()).reverse()
  for (const axis of axes) {
    const conversion = axis.options.from
    if (!conversion || axis.min === Number.POSITIVE_INFINITY) continue
    const source = axisStates.get(conversion.key)
    const bounds = normalizeFiniteRange(
      conversion.toSource(axis.min),
      conversion.toSource(axis.max),
    )
    if (source && bounds) includeAxisExtent(source, bounds[0], bounds[1])
  }
}

function planNamedYAxis(
  axis: TimeSeriesAxisState,
  axisStates: ReadonlyMap<string, TimeSeriesAxisState>,
  warnings: string[],
): TimeSeriesPlannedYAxis {
  const { from, ...options } = axis.options
  if (from) {
    const source = axisStates.get(from.key)
    const range =
      source &&
      normalizeFiniteRange(from.fromSource(source.range[0]), from.fromSource(source.range[1]))
    if (range && range[0] !== range[1]) {
      axis.range = range
      return { ...axis.options, range }
    }
    warnings.push(`Y axis "${axis.options.key}" could not convert source axis "${from.key}".`)
  }
  return { ...options, range: axis.range }
}

function includeAxisExtent(axis: TimeSeriesAxisState, min: number, max: number): void {
  if (axis.options.scale?.type === 'log') {
    if (!(max > 0)) return
    if (!(min > 0)) min = max
  }
  axis.min = Math.min(axis.min, min)
  axis.max = Math.max(axis.max, max)
}

function annotationYAxisKey(annotation: TimeSeriesAnnotation): string | undefined {
  if (annotation.kind === 'x-line' || annotation.kind === 'x-range') return undefined
  return annotation.yAxisKey
}

function timeSeriesExtent(data: TimeSeriesDataSet): NumericRange {
  if (!data.seriesTimestamps) return finiteRange(data.timestamps)
  const timestampColumns = new Set([data.timestamps, ...Object.values(data.seriesTimestamps)])
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const column of timestampColumns) {
    for (const value of column) {
      if (!Number.isFinite(value)) continue
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  }
  return min === Number.POSITIVE_INFINITY ? [0, 1] : expandRange([min, max], 0)
}

function envelopeTimestamps(
  data: TimeSeriesDataSet,
  band: TimeSeriesEnvelopeBand,
): Float64Array | undefined {
  const lower = data.seriesTimestamps?.[band.lowerField] ?? data.timestamps
  const upper = data.seriesTimestamps?.[band.upperField] ?? data.timestamps
  return sameTimeSeriesTimestamps(lower, upper) ? lower : undefined
}

export function buildTimeSeriesRenderPlan(
  data: TimeSeriesDataSet,
  options: TimeSeriesRenderOptions = {},
): TimeSeriesRenderPlan {
  const xRange = options.xRange ? normalizeRange(options.xRange) : timeSeriesExtent(data)
  const xOrigin = xRange[0]
  const xRelativeRange = relativeRange(xRange, xOrigin)
  const plannedSeries: TimeSeriesPlannedSeries[] = []
  const plannedBands: TimeSeriesPlannedBand[] = []
  const plannedAnnotations: TimeSeriesPlannedAnnotation[] = []
  const plannedEventMarkers: TimeSeriesPlannedEventMarker[] = []
  const plannedAnomalyTracks: TimeSeriesPlannedAnomalyTrack[] = []
  const plannedSpcTracks: TimeSeriesPlannedSpcTrack[] = []
  const warnings: string[] = []
  const axisStates = options.yAxes?.length ? collectYAxes(options.yAxes, warnings) : undefined
  const primaryAxis = axisStates?.values().next().value ?? createAxisState({ key: 'y' })
  if (!primaryAxis.options.scale && options.yScale) {
    primaryAxis.options = { ...primaryAxis.options, scale: options.yScale }
  }
  const getYAxis = (axisKey: string | undefined): TimeSeriesAxisState | undefined =>
    axisKey === undefined || axisKey === primaryAxis.options.key
      ? primaryAxis
      : axisStates?.get(axisKey)
  const stacked = options.stack
    ? stackTimeSeriesColumns(
        data,
        options.stack,
        primaryAxis.options.key,
        options.includeHidden,
        warnings,
      )
    : undefined
  let sourcePointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let segmentCount = 0

  for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
    const series = data.series[seriesIndex] as TimeSeriesSeries
    if (series.visible === false && options.includeHidden !== true) continue
    const axis = getYAxis(series.yAxisKey)
    if (!axis) {
      warnings.push(
        `Series "${series.key}" skipped because Y axis "${series.yAxisKey}" is missing.`,
      )
      continue
    }

    const stack = stacked?.get(series.key)
    const sourceValues = data.columns[series.field]
    if (!sourceValues) {
      warnings.push(`Series "${series.key}" skipped because column "${series.field}" is missing.`)
      continue
    }

    const values = stack?.values ?? sourceValues
    const timestamps = data.seriesTimestamps?.[series.field] ?? data.timestamps
    const pointCount = Math.min(timestamps.length, values.length)
    if (timestamps.length !== values.length) {
      warnings.push(
        `Series "${series.key}" uses ${pointCount} points because timestamp and value lengths differ.`,
      )
    }

    const interpolation = series.interpolation ?? options.interpolation ?? 'linear'
    const pointOrBar = series.mark === 'point' || series.mark === 'bar'
    const steppedMarkers =
      !pointOrBar &&
      series.points !== undefined &&
      (interpolation === 'step-before' || interpolation === 'step-after')
    const stylePoints = series.points?.style !== undefined
    const styleBars = series.mark === 'bar' && series.barStyle !== undefined
    const samples = {
      pointCount,
      xRange,
      xOrigin,
      gapThreshold: series.gapThreshold ?? options.gapThreshold ?? 0,
      spanGaps: series.spanGaps ?? options.spanGaps ?? false,
      sampleKinds: data.sampleKinds?.[series.field],
      lowerValues: stack?.lower,
      positiveOnly: axis.options.scale?.type === 'log',
      trackSampleIndices: !series.path && ((stylePoints && !steppedMarkers) || styleBars),
      keepSingletons: pointOrBar || series.points !== undefined,
      interpolation: pointOrBar ? ('linear' as const) : interpolation,
    }
    const build = buildSeriesSegments(timestamps, values, samples)
    const pointSegments = steppedMarkers
      ? buildSeriesSegments(timestamps, values, {
          ...samples,
          trackSampleIndices: !series.path && stylePoints,
          interpolation: 'linear',
        }).segments
      : undefined

    sourcePointCount += pointCount
    includedSampleCount += build.includedSampleCount
    renderedPointCount += build.renderedPointCount
    segmentCount += build.segments.length

    if (build.includedSampleCount > 0) {
      includeAxisExtent(axis, build.minY, build.maxY)
      if (
        !stack &&
        (series.mark === 'bar' ||
          series.mark === 'area' ||
          (series.mark !== 'point' && series.fillColor !== undefined))
      ) {
        const baseline = series.baseline ?? 0
        if (Number.isFinite(baseline)) includeAxisExtent(axis, baseline, baseline)
      }
    }

    plannedSeries.push({
      key: series.key,
      ...(series.yAxisKey !== undefined ? { yAxisKey: series.yAxisKey } : {}),
      label: series.label,
      field: series.field,
      style: {
        color: series.color ?? getDefaultColor(seriesIndex, options.defaultColor),
        width: series.lineWidth ?? options.defaultLineWidth ?? 1.5,
        ...(series.dash !== undefined ? { dash: series.dash } : {}),
      },
      interpolation,
      segments: build.segments,
      ...(series.mark !== undefined ? { mark: series.mark } : {}),
      ...(series.fillColor !== undefined ? { fillColor: series.fillColor } : {}),
      ...(series.baseline !== undefined ? { baseline: series.baseline } : {}),
      ...(series.barWidthRatio !== undefined ? { barWidthRatio: series.barWidthRatio } : {}),
      ...(styleBars && series.barStyle ? { barStyle: series.barStyle } : {}),
      ...(!series.path && (styleBars || stylePoints)
        ? { markSource: { timestamps, values: sourceValues, plottedValues: values } }
        : {}),
      ...(series.points !== undefined ? { points: series.points } : {}),
      ...(series.path !== undefined ? { path: series.path } : {}),
      ...(pointSegments ? { pointSegments } : {}),
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
    const axis = getYAxis(band.yAxisKey)
    if (!axis) {
      warnings.push(`Band "${band.key}" skipped because Y axis "${band.yAxisKey}" is missing.`)
      continue
    }

    const timestamps = band.kind === 'envelope' ? envelopeTimestamps(data, band) : data.timestamps
    if (!timestamps) {
      warnings.push(`Band "${band.key}" skipped because envelope fields use different timestamps.`)
      continue
    }
    const build =
      band.kind === 'value-band'
        ? buildValueBandSegments(band, { xRange, xOrigin })
        : buildEnvelopeBandSegments(timestamps, data.columns, band, {
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
      includeAxisExtent(axis, build.minY, build.maxY)
    }

    const plannedBand: TimeSeriesPlannedBand = {
      kind: band.kind,
      key: band.key,
      ...(band.yAxisKey !== undefined ? { yAxisKey: band.yAxisKey } : {}),
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
      const axis = getYAxis(annotationYAxisKey(annotation))
      const extent = annotationYExtent(annotation)
      if (axis && extent) includeAxisExtent(axis, extent[0], extent[1])
    }
  }

  const spcTracks = data.spcTracks ?? []
  for (const track of spcTracks) {
    if (track.visible === false && options.includeHiddenSpcTracks !== true) continue
    if (track.includeInYRange === false) continue
    const axis = getYAxis(track.yAxisKey)
    const extent = spcTrackYExtent(track)
    if (axis && extent) includeAxisExtent(axis, extent[0], extent[1])
  }

  if (axisStates?.size) propagateDependentExtents(axisStates)
  primaryAxis.range = resolveAxisRange(primaryAxis, options.yRange, options.yPaddingRatio)
  const yAxes = axisStates?.size
    ? Array.from(axisStates.values(), (axis): TimeSeriesPlannedYAxis => {
        if (axis !== primaryAxis) axis.range = resolveAxisRange(axis, undefined, undefined)
        return planNamedYAxis(axis, axisStates, warnings)
      })
    : undefined
  const yRange = primaryAxis.range

  for (let annotationIndex = 0; annotationIndex < annotations.length; annotationIndex++) {
    const annotation = annotations[annotationIndex] as TimeSeriesAnnotation
    if (annotation.visible === false && options.includeHiddenAnnotations !== true) continue
    const axisKey = annotationYAxisKey(annotation)
    const axis = getYAxis(axisKey)
    if (!axis) {
      warnings.push(
        `Annotation "${annotation.key}" skipped because Y axis "${axisKey}" is missing.`,
      )
      continue
    }

    const build = buildAnnotationSegments(annotation, {
      xRange,
      xOrigin,
      xRelativeRange,
      yRange: axis.range,
    })

    if (build.includedSampleCount === 0) {
      warnings.push(`Annotation "${annotation.key}" has no geometry inside the visible range.`)
      continue
    }

    plannedAnnotations.push({
      kind: annotation.kind,
      key: annotation.key,
      ...(axisKey !== undefined ? { yAxisKey: axisKey } : {}),
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

  for (let trackIndex = 0; trackIndex < spcTracks.length; trackIndex++) {
    const track = spcTracks[trackIndex] as TimeSeriesSpcTrack
    if (track.visible === false && options.includeHiddenSpcTracks !== true) continue
    const axis = getYAxis(track.yAxisKey)
    if (!axis) {
      warnings.push(
        `SPC track "${track.key}" skipped because Y axis "${track.yAxisKey}" is missing.`,
      )
      continue
    }

    const build = buildSpcTrackSegments(track, trackIndex, {
      xRange,
      xOrigin,
      yRange: axis.range,
      markerTickRatio: options.spcMarkerTickRatio ?? 0.08,
      options,
    })

    if (build.includedSampleCount === 0) {
      warnings.push(`SPC track "${track.key}" has no geometry inside the visible range.`)
      continue
    }

    plannedSpcTracks.push({
      key: track.key,
      ...(track.yAxisKey !== undefined ? { yAxisKey: track.yAxisKey } : {}),
      label: track.label ?? track.key,
      chartKind: track.chartKind ?? 'individual',
      centerLine: track.centerLine,
      ...(track.upperControlLimit !== undefined
        ? { upperControlLimit: track.upperControlLimit }
        : {}),
      ...(track.lowerControlLimit !== undefined
        ? { lowerControlLimit: track.lowerControlLimit }
        : {}),
      ...(track.upperWarningLimit !== undefined
        ? { upperWarningLimit: track.upperWarningLimit }
        : {}),
      ...(track.lowerWarningLimit !== undefined
        ? { lowerWarningLimit: track.lowerWarningLimit }
        : {}),
      style: resolveSpcTrackStyle(track, trackIndex, options),
      zoneSegments: build.zoneSegments,
      warningZoneSegments: build.warningZoneSegments,
      centerLineSegments: build.centerLineSegments,
      controlLimitSegments: build.controlLimitSegments,
      warningLimitSegments: build.warningLimitSegments,
      markers: build.markers,
      sourcePointCount: build.sourcePointCount,
      includedSampleCount: build.includedSampleCount,
      renderedPointCount: build.renderedPointCount,
      droppedPointCount: build.sourcePointCount - build.includedSampleCount,
      includeInYRange: track.includeInYRange !== false,
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

    const timestamps = data.seriesTimestamps?.[track.scoreField] ?? data.timestamps
    const build = buildAnomalyTrackSegments(timestamps, values, track, {
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
    ...(yAxes ? { yAxes } : {}),
    series: plannedSeries,
    bands: plannedBands,
    annotations: plannedAnnotations,
    eventMarkers: plannedEventMarkers,
    anomalyTracks: plannedAnomalyTracks,
    spcTracks: plannedSpcTracks,
    sourcePointCount,
    includedSampleCount,
    renderedPointCount,
    segmentCount,
    warnings,
  }
}

type YAxisTransforms = ReadonlyMap<string, ViewTransform>

function getAxisTransform(
  transforms: YAxisTransforms | undefined,
  axisKey: string | undefined,
): ViewTransform | undefined {
  return axisKey === undefined ? undefined : transforms?.get(axisKey)
}

export function addTimeSeriesBandsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  boundaryZ: ZLayer = ZLayer.Overlay,
  axisTransforms?: YAxisTransforms,
): void {
  for (const band of plan.bands) {
    const transform = getAxisTransform(axisTransforms, band.yAxisKey)
    for (const segment of band.segments) {
      commands.addFill(segment.upper, segment.lower, band.style.fill, fillZ, transform)
      if (band.style.boundary) {
        commands.addLine(segment.upper, band.style.boundary, boundaryZ, transform)
        commands.addLine(segment.lower, band.style.boundary, boundaryZ, transform)
      }
    }
  }
}

export function addTimeSeriesAnnotationsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Overlay,
  axisTransforms?: YAxisTransforms,
): void {
  for (const annotation of plan.annotations) {
    const transform = getAxisTransform(axisTransforms, annotation.yAxisKey)
    if (annotation.style.fill) {
      for (const segment of annotation.fillSegments) {
        commands.addFill(segment.upper, segment.lower, annotation.style.fill, fillZ, transform)
      }
    }
    if (annotation.style.line) {
      for (const segment of annotation.lineSegments) {
        commands.addLine(segment.buffer, annotation.style.line, lineZ, transform)
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

export function addTimeSeriesSpcTracksToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  fillZ: ZLayer = ZLayer.Fill,
  lineZ: ZLayer = ZLayer.Overlay,
  axisTransforms?: YAxisTransforms,
): void {
  for (const track of plan.spcTracks) {
    const transform = getAxisTransform(axisTransforms, track.yAxisKey)
    if (track.style.zoneFill) {
      for (const segment of track.zoneSegments) {
        commands.addFill(segment.upper, segment.lower, track.style.zoneFill, fillZ, transform)
      }
    }
    if (track.style.warningFill) {
      for (const segment of track.warningZoneSegments) {
        commands.addFill(segment.upper, segment.lower, track.style.warningFill, fillZ, transform)
      }
    }
    for (const segment of track.centerLineSegments) {
      commands.addLine(segment.buffer, track.style.centerLine, lineZ, transform)
    }
    if (track.style.controlLine) {
      for (const segment of track.controlLimitSegments) {
        commands.addLine(segment.buffer, track.style.controlLine, lineZ, transform)
      }
    }
    if (track.style.warningLine) {
      for (const segment of track.warningLimitSegments) {
        commands.addLine(segment.buffer, track.style.warningLine, lineZ, transform)
      }
    }
    for (const marker of track.markers) {
      for (const segment of marker.lineSegments) {
        commands.addLine(segment.buffer, marker.style.line, lineZ, transform)
      }
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
  axisTransforms?: YAxisTransforms,
  defaultTransform?: ViewTransform,
): void {
  let pixelTransform: ViewTransform | undefined
  for (const series of plan.series) {
    const transform = getAxisTransform(axisTransforms, series.yAxisKey)
    if (
      series.mark === undefined &&
      series.interpolation !== 'spline' &&
      !series.fillColor &&
      !series.points &&
      !series.path
    ) {
      for (const segment of series.segments) {
        commands.addLine(segment.buffer, series.style, z, transform)
      }
      continue
    }

    const seriesTransform = transform ?? defaultTransform
    const yRange = plan.yAxes?.find((axis) => axis.key === series.yAxisKey)?.range ?? plan.yRange
    if (series.path) {
      series.path({
        series,
        xRange: plan.xRange,
        xOrigin: plan.xOrigin,
        yRange,
        ...(seriesTransform ? { transform: seriesTransform } : {}),
        commands: {
          addLine: (buffer, style, layer, override = transform) =>
            commands.addLine(buffer, style, layer ?? z, override),
          addFill: (upper, lower, style, layer, override = transform) =>
            commands.addFill(upper, lower, style, layer, override),
          addRect: (x, y, width, height, style, layer, override = transform) =>
            commands.addRect(x, y, width, height, style, layer, override),
          addMarks: (bounds, style, layer, override = transform) =>
            commands.addMarks(bounds, style, layer, override),
          addText: commands.addText.bind(commands),
        },
      })
      continue
    }

    const baseline = resolveMarkBaseline(series.baseline ?? 0, yRange, seriesTransform)
    const bar = series.mark === 'bar'
    const point = series.mark === 'point'
    if ((bar || point || series.points) && seriesTransform && !pixelTransform) {
      const { viewportWidth, viewportHeight } = seriesTransform
      pixelTransform = new ViewTransform(viewportWidth, viewportHeight)
      pixelTransform.setTranslate(-viewportWidth / 2, -viewportHeight / 2)
    }

    if (bar) {
      const widthRatio = clampNumber(series.barWidthRatio ?? 0.75, 0.02, 1)
      const color = series.fillColor ?? series.style.color
      if (series.barStyle && series.markSource) {
        for (const batch of buildStyledTimeSeriesBarBatches(
          series,
          baseline,
          widthRatio,
          color,
          seriesTransform,
        )) {
          commands.addMarks(batch.bounds, batch.options, z, pixelTransform)
        }
      } else {
        const bounds = buildTimeSeriesBarBounds(
          series.segments,
          baseline,
          widthRatio,
          seriesTransform,
        )
        commands.addMarks(bounds, { color }, z, pixelTransform)
      }
    } else if (!point) {
      addTimeSeriesLine(commands, series, baseline, z, transform, seriesTransform)
    }

    if (point || series.points) {
      const size = clampNumber(series.points?.size ?? 5, 1, 128)
      const color = series.points?.color ?? series.style.color
      const shape = series.points?.shape === 'square' ? 'rect' : 'ellipse'
      if (series.points?.style && series.markSource) {
        for (const batch of buildStyledTimeSeriesPointBatches(
          series,
          size,
          { color, shape },
          seriesTransform,
        )) {
          commands.addMarks(batch.bounds, batch.options, ZLayer.Overlay, pixelTransform)
        }
      } else {
        const bounds = buildTimeSeriesPointBounds(
          series.pointSegments ?? series.segments,
          size,
          seriesTransform,
        )
        commands.addMarks(bounds, { color, shape }, ZLayer.Overlay, pixelTransform)
      }
    }
  }
}

function addTimeSeriesLine(
  commands: RenderCommandList,
  series: TimeSeriesPlannedSeries,
  baseline: number,
  z: ZLayer,
  commandTransform: ViewTransform | undefined,
  seriesTransform: ViewTransform | undefined,
): void {
  const [r, g, b, a] = series.style.color
  const fill =
    series.fillColor ?? (series.mark === 'area' ? ([r, g, b, a * 0.25] as const) : undefined)
  for (const { buffer, pointCount, lower } of series.segments) {
    if (pointCount < 2) continue
    const line =
      series.interpolation === 'spline'
        ? tessellateTimeSeriesSpline(buffer, seriesTransform)
        : buffer
    if (fill) {
      const validLower = lower && projectedBaseline(lower, baseline, seriesTransform)
      const areaBase =
        validLower && series.interpolation === 'spline'
          ? tessellateTimeSeriesSpline(validLower, seriesTransform)
          : validLower
      const area = buildTimeSeriesArea(line, baseline, areaBase)
      commands.addFill(area.upper, area.lower, { color: fill }, ZLayer.Fill, commandTransform)
    }
    commands.addLine(line, series.style, z, commandTransform)
  }
}

function projectedBaseline(
  lower: Float32Array,
  baseline: number,
  transform: ViewTransform | undefined,
): Float32Array {
  if (!transform?.hasProjection) return lower
  let result = lower
  for (let index = 1; index < lower.length; index += 2) {
    const y = lower[index] as number
    if (Number.isFinite(transform.mapY(y))) continue
    if (result === lower) result = lower.slice()
    result[index] = baseline
  }
  return result
}

function resolveMarkBaseline(
  value: number,
  yRange: NumericRange,
  transform: ViewTransform | undefined,
): number {
  if (!Number.isFinite(value)) return yRange[0]
  return transform && !Number.isFinite(transform.mapY(value)) ? yRange[0] : value
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
  let layoutOptions = options.layout
  if (plan.yAxes?.length && !(layoutOptions && 'plotArea' in layoutOptions)) {
    const base = layoutOptions ?? { width, height, xAxis: { visible: true } }
    const { side: legacySide, ...legacyYAxis } = base.yAxis ?? {}
    const axisLayout = new Map(base.yAxes?.map((axis) => [axis.key, axis]))
    layoutOptions = {
      ...base,
      yRange: plan.yRange,
      yAxes: plan.yAxes.map((axis, index) => ({
        visible: true,
        ...(index === 0 ? legacyYAxis : {}),
        ...(index === 0 && (legacySide === 'left' || legacySide === 'right')
          ? { side: legacySide }
          : {}),
        ...axis,
        ...axisLayout.get(axis.key),
        key: axis.key,
        range: axis.range,
      })),
    }
  }
  const layout = resolveChartLayout(layoutOptions, width, height, plan.xRelativeRange, plan.yRange)
  const plotArea = layout?.plotArea ?? { x: 0, y: 0, width, height }
  const transform = layout
    ? createPlotViewportTransform(plan.xRelativeRange, plan.yRange, width, height, plotArea, layout)
    : createTimeSeriesViewTransform(plan, width, height)
  const secondaryAxes = plan.yAxes?.slice(1)
  const axisTransforms = secondaryAxes?.length
    ? new Map(
        secondaryAxes.map((axis) => {
          const projection = layout?.yAxes?.find((item) => item.key === axis.key)?.projection
          return [
            axis.key,
            createPlotViewportTransform(plan.xRelativeRange, axis.range, width, height, plotArea, {
              ...(layout?.xProjection ? { xProjection: layout.xProjection } : {}),
              ...(projection ? { yProjection: projection } : {}),
            }),
          ]
        }),
      )
    : undefined
  const commands = new RenderCommandList()
  if (layout && options.guides !== false) {
    addChartGuidesToCommandList(commands, layout, plan.xRelativeRange, plan.yRange, options.guides)
  }
  addTimeSeriesBandsToCommandList(commands, plan, undefined, undefined, axisTransforms)
  addTimeSeriesAnnotationsToCommandList(commands, plan, undefined, undefined, axisTransforms)
  addTimeSeriesSpcTracksToCommandList(commands, plan, undefined, undefined, axisTransforms)
  addTimeSeriesAnomalyTracksToCommandList(commands, plan)
  addTimeSeriesToCommandList(commands, plan, undefined, axisTransforms, transform)
  addTimeSeriesEventMarkersToCommandList(commands, plan)
  addTimeSeriesAnnotationLabelsToCommandList(commands, plan, transform, plotArea, axisTransforms)
  addTimeSeriesEventMarkerLabelsToCommandList(commands, plan, transform, plotArea)
  addTimeSeriesSpcMarkerLabelsToCommandList(commands, plan, transform, plotArea, axisTransforms)

  return extendChartFrame(
    {
      width,
      height,
      layout,
      commands,
      transform,
    },
    plan,
    options.plugins,
  )
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

function spcTrackYExtent(track: TimeSeriesSpcTrack): NumericRange | null {
  const values = [
    track.centerLine,
    track.upperControlLimit,
    track.lowerControlLimit,
    track.upperWarningLimit,
    track.lowerWarningLimit,
  ].filter((value): value is number => value !== undefined && isFiniteNumber(value))

  if (values.length === 0) return null
  return [Math.min(...values), Math.max(...values)]
}

function buildSpcTrackSegments(
  track: TimeSeriesSpcTrack,
  index: number,
  input: {
    xRange: NumericRange
    xOrigin: number
    yRange: NumericRange
    markerTickRatio: number
    options: TimeSeriesRenderOptions
  },
): SpcTrackBuildResult {
  const trackXRange = track.xRange ? normalizeRange(track.xRange) : input.xRange
  const xStart = Math.max(input.xRange[0], trackXRange[0])
  const xEnd = Math.min(input.xRange[1], trackXRange[1])
  const relativeStart = xStart - input.xOrigin
  const relativeEnd = xEnd - input.xOrigin
  const zoneSegments: TimeSeriesBandSegment[] = []
  const warningZoneSegments: TimeSeriesBandSegment[] = []
  const centerLineSegments: TimeSeriesLineSegment[] = []
  const controlLimitSegments: TimeSeriesLineSegment[] = []
  const warningLimitSegments: TimeSeriesLineSegment[] = []
  const markers: TimeSeriesSpcPlannedRuleMarker[] = []
  let sourcePointCount = 0
  let includedSampleCount = 0
  let renderedPointCount = 0
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const includeY = (value: number) => {
    minY = Math.min(minY, value)
    maxY = Math.max(maxY, value)
  }

  const addLine = (target: TimeSeriesLineSegment[], y: number) => {
    sourcePointCount += 2
    if (
      !isFiniteNumber(y) ||
      !isFiniteNumber(relativeStart) ||
      !isFiniteNumber(relativeEnd) ||
      xEnd <= xStart
    ) {
      return
    }
    target.push({
      buffer: new Float32Array([relativeStart, y, relativeEnd, y]),
      pointCount: 2,
    })
    includedSampleCount += 2
    renderedPointCount += 2
    includeY(y)
  }

  const addBand = (
    target: TimeSeriesBandSegment[],
    yA: number | undefined,
    yB: number | undefined,
  ) => {
    sourcePointCount += 2
    if (
      yA === undefined ||
      yB === undefined ||
      !isFiniteNumber(yA) ||
      !isFiniteNumber(yB) ||
      !isFiniteNumber(relativeStart) ||
      !isFiniteNumber(relativeEnd) ||
      xEnd <= xStart ||
      yA === yB
    ) {
      return
    }
    const yRange = normalizeRange([yA, yB])
    target.push({
      lower: new Float32Array([relativeStart, yRange[0], relativeEnd, yRange[0]]),
      upper: new Float32Array([relativeStart, yRange[1], relativeEnd, yRange[1]]),
      pointCount: 2,
    })
    includedSampleCount += 2
    renderedPointCount += 2
    includeY(yRange[0])
    includeY(yRange[1])
  }

  addBand(zoneSegments, track.lowerControlLimit, track.upperControlLimit)
  addBand(warningZoneSegments, track.upperWarningLimit, track.upperControlLimit)
  addBand(warningZoneSegments, track.lowerControlLimit, track.lowerWarningLimit)
  addLine(centerLineSegments, track.centerLine)
  if (track.upperControlLimit !== undefined) addLine(controlLimitSegments, track.upperControlLimit)
  if (track.lowerControlLimit !== undefined) addLine(controlLimitSegments, track.lowerControlLimit)
  if (track.upperWarningLimit !== undefined) addLine(warningLimitSegments, track.upperWarningLimit)
  if (track.lowerWarningLimit !== undefined) addLine(warningLimitSegments, track.lowerWarningLimit)

  const ySpan = Math.max(Number.EPSILON, input.yRange[1] - input.yRange[0])
  const tickHeight = ySpan * clampNumber(input.markerTickRatio, 0.01, 0.5)
  const markerBase = input.yRange[1]
  const markerEnd = markerBase - tickHeight
  const rawMarkers = track.markers ?? []

  for (let markerIndex = 0; markerIndex < rawMarkers.length; markerIndex++) {
    const marker = rawMarkers[markerIndex] as TimeSeriesSpcRuleMarker
    sourcePointCount += 2
    if (marker.visible === false) continue
    if (!isFiniteNumber(marker.x) || marker.x < input.xRange[0] || marker.x > input.xRange[1]) {
      continue
    }

    const relativeX = marker.x - input.xOrigin
    const plannedMarker: TimeSeriesSpcPlannedRuleMarker = {
      key: marker.key,
      label: marker.label ?? marker.rule ?? marker.key,
      ...(marker.rule !== undefined ? { rule: marker.rule } : {}),
      severity: marker.severity ?? 'violation',
      x: marker.x,
      style: resolveSpcRuleMarkerStyle(marker, track, index + markerIndex, input.options),
      lineSegments: [
        {
          buffer: new Float32Array([relativeX, markerBase, relativeX, markerEnd]),
          pointCount: 2,
        },
      ],
      sourcePointCount: 2,
      includedSampleCount: 2,
      renderedPointCount: 2,
      droppedPointCount: 0,
      labelVisible: marker.labelVisible === true,
    }
    markers.push(plannedMarker)
    includedSampleCount += 2
    renderedPointCount += 2
  }

  return {
    zoneSegments,
    warningZoneSegments,
    centerLineSegments,
    controlLimitSegments,
    warningLimitSegments,
    markers,
    sourcePointCount,
    includedSampleCount,
    renderedPointCount,
    minY,
    maxY,
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

function resolveSpcTrackStyle(
  track: TimeSeriesSpcTrack,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesSpcTrackStyle {
  const base = getDefaultColor(index, options.defaultSpcControlLineColor)
  const zoneFill = track.zoneFillColor ??
    options.defaultSpcZoneFillColor ?? [base[0], base[1], base[2], 0.07]
  const warningFill = track.warningFillColor ??
    options.defaultSpcWarningFillColor ?? [0.95, 0.61, 0.07, 0.12]
  const lineWidth = track.lineWidth ?? options.defaultSpcLineWidth ?? 1
  const controlLineColor = track.controlLineColor ??
    options.defaultSpcControlLineColor ?? [0.82, 0.12, 0.08, 0.82]
  const warningLineColor = track.warningLineColor ??
    options.defaultSpcWarningLineColor ?? [0.93, 0.47, 0.09, 0.72]
  const centerLineColor = track.centerLineColor ??
    options.defaultSpcCenterLineColor ?? [0.13, 0.13, 0.13, 0.72]

  return {
    zoneFill: { color: zoneFill },
    warningFill: { color: warningFill },
    centerLine: { color: centerLineColor, width: lineWidth },
    controlLine: { color: controlLineColor, width: Math.max(1, lineWidth) },
    warningLine: { color: warningLineColor, width: Math.max(1, lineWidth * 0.85) },
  }
}

function resolveSpcRuleMarkerStyle(
  marker: TimeSeriesSpcRuleMarker,
  track: TimeSeriesSpcTrack,
  index: number,
  options: TimeSeriesRenderOptions,
): TimeSeriesSpcRuleMarkerStyle {
  const fallbackColor: RgbaColor =
    marker.severity === 'warning' ? [0.93, 0.47, 0.09, 0.84] : [0.82, 0.12, 0.08, 0.9]
  const color =
    marker.color ??
    track.markerColor ??
    options.defaultSpcMarkerColor ??
    getDefaultColor(index, fallbackColor)
  return {
    line: {
      color,
      width: marker.lineWidth ?? track.markerLineWidth ?? options.defaultSpcMarkerLineWidth ?? 1.2,
    },
    text: {
      color: options.defaultSpcTextColor ?? color,
      fontSize: 11,
    },
  }
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
  axisTransforms?: YAxisTransforms,
): void {
  for (const annotation of plan.annotations) {
    if (!annotation.labelVisible || !annotation.label || !annotation.style.text) continue
    const anchor = annotationLabelAnchor(annotation, plan)
    if (!anchor) continue
    const activeTransform = getAxisTransform(axisTransforms, annotation.yAxisKey) ?? transform
    const point = activeTransform.dataToPixel(anchor.x, anchor.y)
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

function addTimeSeriesSpcMarkerLabelsToCommandList(
  commands: RenderCommandList,
  plan: TimeSeriesRenderPlan,
  transform: ViewTransform,
  plotArea: ChartRect,
  axisTransforms?: YAxisTransforms,
): void {
  for (const track of plan.spcTracks) {
    const activeTransform = getAxisTransform(axisTransforms, track.yAxisKey) ?? transform
    for (const marker of track.markers) {
      if (!marker.labelVisible || !marker.label || !marker.style.text) continue
      const segment = marker.lineSegments[0]
      const x = segment?.buffer[0]
      const y = segment?.buffer[3]
      if (x === undefined || y === undefined) continue

      const point = activeTransform.dataToPixel(x, y)
      const xPixel = clampNumber(point.x + 4, plotArea.x + 4, plotArea.x + plotArea.width - 4)
      const yPixel = clampNumber(point.y + 4, plotArea.y + 4, plotArea.y + plotArea.height - 4)
      commands.addText(
        marker.label,
        xPixel,
        yPixel,
        {
          ...marker.style.text,
          align: 'left',
          baseline: 'top',
        },
        ZLayer.Text,
      )
    }
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
  renderChartFrame(
    context,
    frame,
    plan,
    options.plugins,
    !!plan.yAxes?.length || frame.transform.hasProjection,
  )
}

interface SeriesWindow {
  pointCount: number
  xRange: NumericRange
  xOrigin: number
  gapThreshold: number
}

/** The standard line does not need per-sample flags or a paired baseline. */
function buildLinearSeriesSegments(
  timestamps: Float64Array,
  values: Float64Array,
  { pointCount, xRange: [startTime, endTime], xOrigin, gapThreshold }: SeriesWindow,
): SegmentBuildResult {
  const scratch = new Float32Array(pointCount * 2)
  const segments: TimeSeriesLineSegment[] = []
  let write = 0
  let start = 0
  let renderedPointCount = 0
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let previousTime = 0

  const closeSegment = () => {
    const pointCount = (write - start) / 2
    if (pointCount >= 2) {
      segments.push({ buffer: scratch.subarray(start, write), pointCount })
      renderedPointCount += pointCount
    }
    start = write
  }

  for (let i = 0; i < pointCount; i++) {
    const time = timestamps[i]
    const value = values[i]
    if (!isFiniteNumber(time) || !isFiniteNumber(value) || time < startTime || time > endTime) {
      closeSegment()
      continue
    }
    if (gapThreshold > 0 && write > start && time - previousTime > gapThreshold) closeSegment()
    scratch[write++] = time - xOrigin
    scratch[write++] = value
    minY = Math.min(minY, value)
    maxY = Math.max(maxY, value)
    previousTime = time
  }
  closeSegment()
  return { segments, includedSampleCount: write / 2, renderedPointCount, minY, maxY }
}

function buildSeriesSegments(
  timestamps: Float64Array,
  values: Float64Array,
  options: SeriesWindow & {
    interpolation: TimeSeriesInterpolation
    keepSingletons: boolean
    positiveOnly: boolean
    trackSampleIndices: boolean
    spanGaps: boolean
    sampleKinds: Uint8Array | undefined
    lowerValues: Float64Array | undefined
  },
): SegmentBuildResult {
  if (
    (options.interpolation === 'linear' || options.interpolation === 'spline') &&
    !options.keepSingletons &&
    !options.positiveOnly &&
    !options.trackSampleIndices &&
    !options.spanGaps &&
    !options.sampleKinds &&
    !options.lowerValues
  ) {
    return buildLinearSeriesSegments(timestamps, values, options)
  }
  const stepped = options.interpolation === 'step-before' || options.interpolation === 'step-after'
  const maxFloats = stepped ? Math.max(0, options.pointCount * 4 - 2) : options.pointCount * 2
  const scratch = new Float32Array(maxFloats)
  const { lowerValues, positiveOnly, sampleKinds, spanGaps } = options
  const lowerScratch = lowerValues ? new Float32Array(maxFloats) : undefined
  const sampleScratch = options.trackSampleIndices ? new Uint32Array(maxFloats / 2) : undefined
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
  let previousLower = 0

  const pushSegment = () => {
    if (segmentPointCount >= (options.keepSingletons ? 1 : 2)) {
      const buffer = scratch.subarray(segmentStart, write)
      segments.push({
        buffer,
        pointCount: segmentPointCount,
        ...(lowerScratch ? { lower: lowerScratch.subarray(segmentStart, write) } : {}),
        ...(sampleScratch
          ? { sampleIndices: sampleScratch.subarray(segmentStart / 2, write / 2) }
          : {}),
      })
      renderedPointCount += segmentPointCount
    }
    segmentPointCount = 0
    segmentStart = write
  }

  const appendPoint = lowerScratch
    ? (x: number, y: number, lower: number) => {
        lowerScratch[write] = x
        lowerScratch[write + 1] = lower
        scratch[write++] = x
        scratch[write++] = y
        segmentPointCount += 1
      }
    : (x: number, y: number) => {
        scratch[write++] = x
        scratch[write++] = y
        segmentPointCount += 1
      }

  for (let i = 0; i < options.pointCount; i++) {
    const timestamp = timestamps[i]
    const value = values[i]
    if (
      !isFiniteNumber(timestamp) ||
      timestamp < options.xRange[0] ||
      timestamp > options.xRange[1]
    ) {
      pushSegment()
      continue
    }
    if (!isFiniteNumber(value) || (positiveOnly && value <= 0)) {
      const kind = sampleKinds?.[i]
      if (!spanGaps && kind !== TimeSeriesSampleKind.AlignmentHole) pushSegment()
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

    const lower = lowerValues ? (lowerValues[i] as number) : value
    if (segmentPointCount === 0) {
      segmentStart = write
      appendPoint(x, value, lower)
    } else if (options.interpolation === 'step-after') {
      appendPoint(x, previousY, previousLower)
      appendPoint(x, value, lower)
    } else if (options.interpolation === 'step-before') {
      appendPoint(previousX, value, lower)
      appendPoint(x, value, lower)
    } else {
      appendPoint(x, value, lower)
    }
    if (sampleScratch) sampleScratch[write / 2 - 1] = i

    includedSampleCount += 1
    if (lowerValues && (!positiveOnly || lower > 0)) {
      minY = Math.min(minY, value, lower)
      maxY = Math.max(maxY, value, lower)
    } else {
      minY = Math.min(minY, value)
      maxY = Math.max(maxY, value)
    }
    previousX = x
    previousY = value
    previousLower = lower
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
