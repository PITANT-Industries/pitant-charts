import type { MarkBatchOptions } from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import type {
  TimeSeriesLineSegment,
  TimeSeriesMarkSample,
  TimeSeriesPlannedSeries,
} from './time-series.js'

/**
 * Tessellate a monotone cubic through the samples without overshooting either
 * endpoint. Dense sections stay linear when their interval fits in a few pixels.
 */
export function tessellateTimeSeriesSpline(
  buffer: Float32Array,
  transform: ViewTransform | undefined,
): Float32Array {
  const count = buffer.length / 2
  if (count < 3) return buffer

  let vertexCount = 1
  for (let i = 0; i < count - 1; i++) {
    vertexCount += splineSubdivisions(buffer, i, transform)
  }
  if (vertexCount === count) return buffer

  const vertices = new Float32Array(vertexCount * 2)
  vertices[0] = buffer[0] as number
  vertices[1] = buffer[1] as number
  let write = 2
  let m0 = splineTangent(buffer, 0)
  for (let i = 0; i < count - 1; i++) {
    const x0 = buffer[i * 2] as number
    const y0 = buffer[i * 2 + 1] as number
    const x1 = buffer[i * 2 + 2] as number
    const y1 = buffer[i * 2 + 3] as number
    const dx = x1 - x0
    const m1 = splineTangent(buffer, i + 1)
    const subdivisions = splineSubdivisions(buffer, i, transform)
    for (let j = 1; j < subdivisions; j++) {
      const t = j / subdivisions
      const t2 = t * t
      const t3 = t2 * t
      const y =
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * dx * m0 +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * dx * m1
      vertices[write++] = x0 + t * dx
      vertices[write++] = Math.max(Math.min(y0, y1), Math.min(Math.max(y0, y1), y))
    }
    vertices[write++] = x1
    vertices[write++] = y1
    m0 = m1
  }
  return vertices
}

export function buildTimeSeriesArea(
  buffer: Float32Array,
  baseline: number,
  stackedBase?: Float32Array,
): { upper: Float32Array; lower: Float32Array } {
  let crossings = 0
  for (let i = 3; i < buffer.length; i += 2) {
    const previous = (buffer[i - 2] as number) - (stackedBase?.[i - 2] ?? baseline)
    const current = (buffer[i] as number) - (stackedBase?.[i] ?? baseline)
    if (crossesBaseline(previous, current)) crossings++
  }
  if (crossings === 0 && stackedBase) return { upper: buffer, lower: stackedBase }

  const upper = crossings === 0 ? buffer : new Float32Array(buffer.length + crossings * 2)
  const lower = new Float32Array(upper.length)
  let write = 0
  for (let i = 0; i < buffer.length; i += 2) {
    const x = buffer[i] as number
    const y = buffer[i + 1] as number
    const base = stackedBase?.[i + 1] ?? baseline
    if (crossings > 0 && i > 0) {
      const previousBase = stackedBase?.[i - 1] ?? baseline
      const previous = (buffer[i - 1] as number) - previousBase
      const current = y - base
      if (crossesBaseline(previous, current)) {
        const previousX = buffer[i - 2] as number
        const ratio = -previous / (current - previous)
        const crossingX = previousX + ratio * (x - previousX)
        const crossingY = previousBase + ratio * (base - previousBase)
        upper[write] = crossingX
        lower[write++] = crossingX
        upper[write] = crossingY
        lower[write++] = crossingY
      }
    }
    if (crossings > 0) {
      upper[write] = x
      upper[write + 1] = y
    }
    lower[write++] = x
    lower[write++] = base
  }
  return { upper, lower }
}

export function buildTimeSeriesPointBounds(
  segments: readonly TimeSeriesLineSegment[],
  size: number,
  transform: ViewTransform | undefined,
): Float32Array {
  const bounds = new Float32Array(sampleCount(segments) * 4)
  let write = 0
  visitPointCenters(segments, transform, (_, _offset, x, y) => {
    bounds[write++] = x - size / 2
    bounds[write++] = y - size / 2
    bounds[write++] = size
    bounds[write++] = size
  })
  return bounds.subarray(0, write)
}

export function buildTimeSeriesBarBounds(
  segments: readonly TimeSeriesLineSegment[],
  baseline: number,
  widthRatio: number,
  transform: ViewTransform | undefined,
): Float32Array {
  const bounds = new Float32Array(sampleCount(segments) * 4)
  let write = 0
  visitBarPositions(segments, baseline, transform, (_, _offset, x, top, height, spacing) => {
    const width = spacing * widthRatio
    bounds[write++] = x - width / 2
    bounds[write++] = top
    bounds[write++] = width
    bounds[write++] = height
  })
  return bounds.subarray(0, write)
}

interface TimeSeriesMarkBatch {
  bounds: Float32Array
  options: MarkBatchOptions
}

interface MarkRun {
  bounds: number[]
  options: MarkBatchOptions
}

export function buildStyledTimeSeriesPointBatches(
  series: TimeSeriesPlannedSeries,
  size: number,
  defaults: MarkBatchOptions,
  transform: ViewTransform | undefined,
): TimeSeriesMarkBatch[] {
  const runs: MarkRun[] = []
  visitPointCenters(series.pointSegments ?? series.segments, transform, (segment, offset, x, y) => {
    const sample = markSample(series, segment, offset)
    const style = sample && series.points?.style?.(sample)
    if (style?.visible === false) return
    const diameter = boundedSize(style?.size, size, 1, 128)
    const shape =
      style?.shape === undefined
        ? (defaults.shape ?? 'ellipse')
        : style.shape === 'circle'
          ? 'ellipse'
          : 'rect'
    const run = markRun(runs, style?.color ?? defaults.color, shape)
    run.bounds.push(x - diameter / 2, y - diameter / 2, diameter, diameter)
  })
  return packMarkRuns(runs)
}

export function buildStyledTimeSeriesBarBatches(
  series: TimeSeriesPlannedSeries,
  baseline: number,
  widthRatio: number,
  color: MarkBatchOptions['color'],
  transform: ViewTransform | undefined,
): TimeSeriesMarkBatch[] {
  const runs: MarkRun[] = []
  visitBarPositions(
    series.segments,
    baseline,
    transform,
    (segment, offset, x, top, height, spacing, base) => {
      const sample = markSample(series, segment, offset, base)
      const style = sample && series.barStyle?.(sample)
      if (style?.visible === false) return
      const width = boundedSize(
        style?.width,
        spacing * boundedSize(style?.widthRatio, widthRatio, 0.02, 1),
        0.01,
        Number.POSITIVE_INFINITY,
      )
      markRun(runs, style?.color ?? color, 'rect').bounds.push(x - width / 2, top, width, height)
    },
  )
  return packMarkRuns(runs)
}

function boundedSize(
  value: number | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  return value === undefined || !Number.isFinite(value)
    ? defaultValue
    : Math.max(min, Math.min(max, value))
}

function markSample(
  series: TimeSeriesPlannedSeries,
  segment: TimeSeriesLineSegment,
  offset: number,
  baseline?: number,
): TimeSeriesMarkSample | undefined {
  const index = segment.sampleIndices?.[offset / 2]
  const source = series.markSource
  if (!source || index === undefined) return undefined
  const timestamp = source.timestamps[index]
  const value = source.values[index]
  const plottedValue = source.plottedValues[index]
  if (timestamp === undefined || value === undefined || plottedValue === undefined) return undefined
  return {
    index,
    seriesKey: series.key,
    field: series.field,
    timestamp,
    value,
    plottedValue,
    ...(baseline !== undefined ? { baseline } : {}),
  }
}

function markRun(
  runs: MarkRun[],
  color: MarkBatchOptions['color'],
  shape: NonNullable<MarkBatchOptions['shape']>,
): MarkRun {
  const last = runs[runs.length - 1]
  if (
    last?.options.shape === shape &&
    color.every((channel, index) => last.options.color[index] === channel)
  ) {
    return last
  }
  const run: MarkRun = { bounds: [], options: { color, shape } }
  runs.push(run)
  return run
}

function packMarkRuns(runs: MarkRun[]): TimeSeriesMarkBatch[] {
  return runs.map(({ bounds, options }) => ({ bounds: Float32Array.from(bounds), options }))
}

function visitPointCenters(
  segments: readonly TimeSeriesLineSegment[],
  transform: ViewTransform | undefined,
  visit: (segment: TimeSeriesLineSegment, offset: number, x: number, y: number) => void,
): void {
  for (const segment of segments) {
    const { buffer } = segment
    for (let i = 0; i < buffer.length; i += 2) {
      const { x, y } = project(buffer, i, transform)
      if (Number.isFinite(x) && Number.isFinite(y)) visit(segment, i, x, y)
    }
  }
}

function visitBarPositions(
  segments: readonly TimeSeriesLineSegment[],
  baseline: number,
  transform: ViewTransform | undefined,
  visit: (
    segment: TimeSeriesLineSegment,
    offset: number,
    x: number,
    top: number,
    height: number,
    spacing: number,
    baseline: number,
  ) => void,
): void {
  const baselineY = transform ? transform.dataToPixel(0, baseline).y : baseline
  for (const segment of segments) {
    const { buffer, lower } = segment
    if (buffer.length < 2) continue
    let current = project(buffer, 0, transform)
    let previousX: number | undefined
    for (let i = 0; i < buffer.length; i += 2) {
      const next = i + 2 < buffer.length ? project(buffer, i + 2, transform) : undefined
      const spacing = Math.min(
        projectedDistance(current.x, previousX),
        projectedDistance(current.x, next?.x),
      )
      const stackedY = lower ? project(lower, i, transform).y : baselineY
      const baseY = Number.isFinite(stackedY) ? stackedY : baselineY
      const height = Math.abs(current.y - baseY)
      if (Number.isFinite(current.x) && height > 0 && Number.isFinite(height)) {
        visit(
          segment,
          i,
          current.x,
          Math.min(current.y, baseY),
          height,
          Number.isFinite(spacing) ? spacing : 8,
          Number.isFinite(stackedY) ? (lower?.[i + 1] ?? baseline) : baseline,
        )
      }
      previousX = current.x
      if (next) current = next
    }
  }
}

function splineSubdivisions(
  buffer: Float32Array,
  index: number,
  transform: ViewTransform | undefined,
): number {
  const offset = index * 2
  if ((buffer[offset + 2] as number) <= (buffer[offset] as number)) return 1
  if (!transform) return 6
  const a = project(buffer, offset, transform)
  const b = project(buffer, offset + 2, transform)
  const pixels = Math.abs(a.x - b.x)
  return Number.isFinite(pixels) ? Math.max(1, Math.min(16, Math.ceil(pixels / 8))) : 1
}

function splineTangent(buffer: Float32Array, index: number): number {
  const previousWidth = intervalWidth(buffer, index - 1)
  const nextWidth = intervalWidth(buffer, index)
  const previousSlope = secant(buffer, index - 1, previousWidth)
  const nextSlope = secant(buffer, index, nextWidth)
  if (index === 0) return nextSlope
  if (index === buffer.length / 2 - 1) return previousSlope
  if (previousSlope === 0 || nextSlope === 0 || Math.sign(previousSlope) !== Math.sign(nextSlope)) {
    return 0
  }
  const previousWeight = 2 * nextWidth + previousWidth
  const nextWeight = nextWidth + 2 * previousWidth
  return (previousWeight + nextWeight) / (previousWeight / previousSlope + nextWeight / nextSlope)
}

function intervalWidth(buffer: Float32Array, index: number): number {
  if (index < 0 || index * 2 + 2 >= buffer.length) return 0
  return (buffer[index * 2 + 2] as number) - (buffer[index * 2] as number)
}

function secant(buffer: Float32Array, index: number, width: number): number {
  if (width <= 0) return 0
  return ((buffer[index * 2 + 3] as number) - (buffer[index * 2 + 1] as number)) / width
}

function crossesBaseline(a: number, b: number): boolean {
  return (a < 0 && b > 0) || (a > 0 && b < 0)
}

function sampleCount(segments: readonly TimeSeriesLineSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.pointCount, 0)
}

function project(buffer: Float32Array, index: number, transform: ViewTransform | undefined) {
  const x = buffer[index] as number
  const y = buffer[index + 1] as number
  return transform ? transform.dataToPixel(x, y) : { x, y }
}

function projectedDistance(x: number, adjacent: number | undefined): number {
  const distance = adjacent === undefined ? 0 : Math.abs(adjacent - x)
  return Number.isFinite(distance) && distance > 0 ? distance : Number.POSITIVE_INFINITY
}
