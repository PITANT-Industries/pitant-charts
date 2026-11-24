export type ChromatogramSample = readonly [time: number, signal: number]
type Bounds = readonly [minimum: number, maximum: number]

export interface ChromatogramPeak {
  id: string
  label?: string
  start: number
  end: number
  baseline?: readonly [startSignal: number, endSignal: number]
}

export interface ChromatogramData {
  samples: readonly ChromatogramSample[]
  peaks: readonly ChromatogramPeak[]
  timeUnit?: string
  signalUnit?: string
}

export interface PreparedChromatogramData extends ChromatogramData {
  timeBounds: Bounds
  signalBounds: Bounds
  timeUnit: string
  signalUnit: string
}

export interface ChromatogramPeakApex {
  time: number
  signal: number
  baseline: number
  height: number
}

type RegionSign = 'above' | 'below'

export interface ChromatogramPeakRegion {
  sign: RegionSign
  points: readonly ChromatogramSample[]
}

export interface IntegratedChromatogramPeak {
  baseline: readonly [startSignal: number, endSignal: number]
  segments: readonly ChromatogramPeakRegion[]
  positiveArea: number
  negativeArea: number
  signedArea: number
  apex: ChromatogramPeakApex
}

function validPeak(peak: ChromatogramPeak, [minimum, maximum]: Bounds) {
  return peak &&
    Number.isFinite(peak.start) && Number.isFinite(peak.end) &&
    peak.start >= minimum && peak.end <= maximum && peak.end > peak.start &&
    (peak.baseline === undefined || (Array.isArray(peak.baseline) && peak.baseline.length === 2 &&
      Number.isFinite(peak.baseline[0]) && Number.isFinite(peak.baseline[1])))
}

export function prepareChromatogram(data: ChromatogramData): PreparedChromatogramData | null {
  if (!Array.isArray(data?.samples) || data.samples.length < 2 || !Array.isArray(data.peaks)) return null
  let previous = -Infinity
  let minimum = Infinity
  let maximum = -Infinity
  for (const sample of data.samples) {
    if (!Array.isArray(sample) || sample.length !== 2 || !Number.isFinite(sample[0]) ||
      !Number.isFinite(sample[1]) || sample[0] <= previous) return null
    previous = sample[0]
    minimum = Math.min(minimum, sample[1])
    maximum = Math.max(maximum, sample[1])
  }
  const timeBounds = [data.samples[0][0], previous] as const
  if (!Number.isFinite(timeBounds[1] - timeBounds[0]) || !Number.isFinite(maximum - minimum)) return null

  const ids = new Set<string>()
  for (const peak of data.peaks) {
    if (!validPeak(peak, timeBounds) || typeof peak.id !== 'string' || !peak.id.trim() || ids.has(peak.id)) return null
    if (peak.label !== undefined && typeof peak.label !== 'string') return null
    ids.add(peak.id)
  }
  const peaks = [...data.peaks].sort((a, b) => a.start - b.start)
  if (peaks.some((peak, index) => index > 0 && peak.start < peaks[index - 1].end)) return null
  if (data.timeUnit !== undefined && typeof data.timeUnit !== 'string') return null
  if (data.signalUnit !== undefined && typeof data.signalUnit !== 'string') return null

  return {
    samples: data.samples,
    peaks,
    timeBounds,
    signalBounds: [minimum, maximum],
    timeUnit: data.timeUnit?.trim() || 'time units',
    signalUnit: data.signalUnit?.trim() || 'a.u.',
  }
}

function firstAtOrAfter(samples: readonly ChromatogramSample[], time: number) {
  let low = 0
  let high = samples.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (samples[middle][0] < time) low = middle + 1
    else high = middle
  }
  return low
}

function interpolateSignal(first: ChromatogramSample, last: ChromatogramSample, time: number) {
  if (time === first[0] || first[1] === last[1]) return first[1]
  if (time === last[0]) return last[1]
  const fraction = (time - first[0]) / (last[0] - first[0])
  return first[1] * (1 - fraction) + last[1] * fraction
}

/** Read an exact sample or interpolate within the prepared acquisition. */
export function chromatogramSignalAt(samples: readonly ChromatogramSample[], time: number): number | undefined {
  if (!Number.isFinite(time)) return undefined
  const index = firstAtOrAfter(samples, time)
  const right = samples[index]
  if (!right) return undefined
  if (right[0] === time) return right[1]
  return index > 0 ? interpolateSignal(samples[index - 1], right, time) : undefined
}

/** Integrate a window over prepared samples, splitting the filled region at each baseline crossing. */
export function integrateChromatogramPeak(
  samples: readonly ChromatogramSample[],
  peak: ChromatogramPeak,
): IntegratedChromatogramPeak | null {
  if (samples.length < 2 || !validPeak(peak, [samples[0][0], samples[samples.length - 1][0]])) return null
  const { start, end } = peak
  const startSignal = chromatogramSignalAt(samples, start)
  const endSignal = chromatogramSignalAt(samples, end)
  if (startSignal === undefined || endSignal === undefined) return null
  const baseline = peak.baseline ?? [startSignal, endSignal] as const
  const baselineStart = [start, baseline[0]] as const
  const baselineEnd = [end, baseline[1]] as const
  const baselineAt = (time: number) => interpolateSignal(baselineStart, baselineEnd, time)
  const vertex = (time: number, signal: number): ChromatogramPeakApex => {
    const base = baselineAt(time)
    return { time, signal, baseline: base, height: signal - base }
  }

  const segments: ChromatogramPeakRegion[] = []
  let region: { sign: RegionSign; vertices: ChromatogramPeakApex[] } | undefined
  let positiveArea = 0
  let negativeArea = 0

  function finishRegion() {
    if (!region) return
    const first = region.vertices[0]
    const last = region.vertices[region.vertices.length - 1]
    const points: ChromatogramSample[] = region.vertices.map(({ time, signal }) => [time, signal])
    if (last.height !== 0) points.push([last.time, last.baseline])
    if (first.height !== 0) points.push([first.time, first.baseline])
    segments.push({ sign: region.sign, points })
    region = undefined
  }

  function appendRegion(sign: RegionSign, a: ChromatogramPeakApex, b: ChromatogramPeakApex, area: number) {
    if (region?.sign !== sign) {
      finishRegion()
      region = { sign, vertices: [a] }
    }
    region.vertices.push(b)
    if (sign === 'above') positiveArea += area
    else negativeArea += area
  }

  function integratePair(a: ChromatogramPeakApex, b: ChromatogramPeakApex) {
    const span = b.time - a.time
    if (a.height === 0 && b.height === 0) {
      finishRegion()
      return
    }
    const sign = (a.height || b.height) > 0 ? 'above' : 'below'
    if ((a.height > 0 && b.height < 0) || (a.height < 0 && b.height > 0)) {
      const scale = Math.max(Math.abs(a.height), Math.abs(b.height))
      const weight = Math.abs(a.height) / scale
      const fraction = weight / (weight + Math.abs(b.height) / scale)
      const time = a.time + span * fraction
      const signal = baselineAt(time)
      const crossing = { time, signal, baseline: signal, height: 0 }
      appendRegion(sign, a, crossing, span * fraction * (a.height / 2))
      appendRegion(sign === 'above' ? 'below' : 'above', crossing, b, span * (1 - fraction) * (b.height / 2))
      return
    }
    appendRegion(sign, a, b, span * (a.height + (b.height - a.height) / 2))
  }

  let previous = vertex(start, startSignal)
  let apex = previous
  const first = firstAtOrAfter(samples, start)
  const last = firstAtOrAfter(samples, end)
  for (let index = first; index <= last; index++) {
    const [time, signal] = index === last ? [end, endSignal] : samples[index]
    if (time === start) continue
    const point = vertex(time, signal)
    if (point.height > apex.height) apex = point
    integratePair(previous, point)
    previous = point
  }
  finishRegion()
  const signedArea = positiveArea + negativeArea
  if (!Number.isFinite(signedArea) || !Number.isFinite(apex.height)) return null
  return { baseline, segments, positiveArea, negativeArea, signedArea, apex }
}
