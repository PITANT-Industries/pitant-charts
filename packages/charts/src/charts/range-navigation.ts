import { type NumericRange, normalizeRange } from './common.js'

export interface PanRangeByPixelsInput {
  range: NumericRange
  deltaPixels: number
  plotWidth: number
  bounds: NumericRange
}

export interface ZoomRangeAroundAnchorInput {
  range: NumericRange
  anchor: number
  factor: number
  bounds: NumericRange
  minSpanRatio?: number
}

export function clampRangeToBounds(range: NumericRange, bounds: NumericRange): NumericRange {
  const normalizedBounds = normalizeRange(bounds)
  const normalizedRange = normalizeRange(range)
  const boundsSpan = normalizedBounds[1] - normalizedBounds[0]
  if (boundsSpan <= Number.EPSILON) return normalizedBounds

  const span = Math.min(
    Math.max(Number.EPSILON, normalizedRange[1] - normalizedRange[0]),
    boundsSpan,
  )
  if (span >= boundsSpan) return normalizedBounds

  if (normalizedRange[0] < normalizedBounds[0]) {
    return [normalizedBounds[0], normalizedBounds[0] + span]
  }
  if (normalizedRange[1] > normalizedBounds[1]) {
    return [normalizedBounds[1] - span, normalizedBounds[1]]
  }
  return normalizedRange
}

export function panRangeByValue(
  range: NumericRange,
  delta: number,
  bounds: NumericRange,
): NumericRange {
  if (Math.abs(delta) < Number.EPSILON) return normalizeRange(range)

  return clampRangeToBounds([range[0] + delta, range[1] + delta], bounds)
}

export function panRangeByPixels(input: PanRangeByPixelsInput): NumericRange {
  const span = input.range[1] - input.range[0]
  if (span <= Number.EPSILON || input.plotWidth <= Number.EPSILON) {
    return normalizeRange(input.range)
  }

  return panRangeByValue(input.range, (input.deltaPixels / input.plotWidth) * span, input.bounds)
}

export function zoomRangeAroundCenter(
  range: NumericRange,
  factor: number,
  bounds: NumericRange,
  minSpanRatio = 1e-9,
): NumericRange {
  const normalizedRange = normalizeRange(range)
  const center = (normalizedRange[0] + normalizedRange[1]) / 2
  return zoomRangeAroundAnchor({
    range: normalizedRange,
    anchor: center,
    factor,
    bounds,
    minSpanRatio,
  })
}

export function zoomRangeAroundAnchor(input: ZoomRangeAroundAnchorInput): NumericRange {
  const range = normalizeRange(input.range)
  const bounds = normalizeRange(input.bounds)
  const currentSpan = range[1] - range[0]
  const boundsSpan = bounds[1] - bounds[0]
  if (currentSpan <= Number.EPSILON || boundsSpan <= Number.EPSILON) return range

  const anchor = clamp(input.anchor, range[0], range[1])
  const anchorRatio = clamp((anchor - range[0]) / currentSpan, 0, 1)
  const minSpan = Math.max(Number.EPSILON, boundsSpan * (input.minSpanRatio ?? 1e-9))
  const nextSpan = clamp(currentSpan * input.factor, minSpan, boundsSpan)

  return clampRangeToBounds(
    [anchor - nextSpan * anchorRatio, anchor + nextSpan * (1 - anchorRatio)],
    bounds,
  )
}

export function rangesEqual(
  left: NumericRange,
  right: NumericRange,
  epsilon = Number.EPSILON,
): boolean {
  return Math.abs(left[0] - right[0]) <= epsilon && Math.abs(left[1] - right[1]) <= epsilon
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
