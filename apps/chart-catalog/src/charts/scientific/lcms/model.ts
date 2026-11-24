export type LcMsPoint = readonly [rtSeconds: number, mz: number]
export type LcMsSample = readonly [scanId: string, rtSeconds: number, intensity: number | null]

export interface LcMsMassTrace {
  id: string
  mz: number
  hull: readonly LcMsPoint[]
  samples?: readonly LcMsSample[]
  mzWindow?: readonly [minMz: number, maxMz: number]
}

export interface LcMsFeature {
  id: string
  rtSeconds: number
  mz: number
  intensity: number
  charge?: number
  traces: readonly LcMsMassTrace[]
}

export interface LcMsFeatureData {
  features: readonly LcMsFeature[]
}

export interface LcMsBounds {
  minRt: number
  maxRt: number
  minMz: number
  maxMz: number
}

export interface PreparedLcMsTrace extends LcMsMassTrace {
  bounds?: LcMsBounds
}

export interface PreparedLcMsFeature extends LcMsFeature {
  bounds: LcMsBounds
  traces: readonly PreparedLcMsTrace[]
}

export interface PreparedLcMsFeatures {
  features: readonly PreparedLcMsFeature[]
  byId: ReadonlyMap<string, PreparedLcMsFeature>
  bounds: LcMsBounds
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function nonnegative(value: number) {
  return Number.isFinite(value) && value >= 0
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0
}

function pointBounds(rt: number, mz: number): LcMsBounds {
  return { minRt: rt, maxRt: rt, minMz: mz, maxMz: mz }
}

function includeBounds(bounds: LcMsBounds, added: LcMsBounds) {
  bounds.minRt = Math.min(bounds.minRt, added.minRt)
  bounds.maxRt = Math.max(bounds.maxRt, added.maxRt)
  bounds.minMz = Math.min(bounds.minMz, added.minMz)
  bounds.maxMz = Math.max(bounds.maxMz, added.maxMz)
}

function prepareTrace(trace: LcMsMassTrace, scanTimes: Map<string, number>): PreparedLcMsTrace | null {
  if (!trace || !nonblank(trace.id) || !positive(trace.mz) || !Array.isArray(trace.hull)) return null
  const { mzWindow, samples } = trace
  if (mzWindow !== undefined && (!Array.isArray(mzWindow) || mzWindow.length !== 2 ||
    !positive(mzWindow[0]) || !positive(mzWindow[1]) || mzWindow[0] > mzWindow[1])) return null

  let bounds: LcMsBounds | undefined
  for (const point of trace.hull) {
    if (!Array.isArray(point) || point.length !== 2 || !nonnegative(point[0]) || !positive(point[1])) return null
    const added = pointBounds(point[0], point[1])
    if (bounds) includeBounds(bounds, added)
    else bounds = added
  }

  if (samples === undefined) return { ...trace, bounds }
  if (!Array.isArray(samples)) return null
  const traceScanIds = new Set<string>()
  for (const sample of samples) {
    if (!Array.isArray(sample) || sample.length !== 3 || !nonblank(sample[0]) ||
      !nonnegative(sample[1]) || (sample[2] !== null && !nonnegative(sample[2]))) return null
    const [scanId, rt] = sample
    const knownRt = scanTimes.get(scanId)
    if (traceScanIds.has(scanId) || (knownRt !== undefined && knownRt !== rt)) return null
    traceScanIds.add(scanId)
    scanTimes.set(scanId, rt)
  }
  // The stable sort keeps the original scan order within coincident retention times.
  return { ...trace, bounds, samples: [...samples].sort((a, b) => a[1] - b[1]) }
}

export function prepareLcMsFeatures(data: LcMsFeatureData): PreparedLcMsFeatures | null {
  if (!Array.isArray(data?.features) || !data.features.length) return null
  let bounds: LcMsBounds | undefined
  const features: PreparedLcMsFeature[] = []
  const byId = new Map<string, PreparedLcMsFeature>()
  const scanTimes = new Map<string, number>()
  for (const feature of data.features) {
    if (!feature || !nonblank(feature.id) || byId.has(feature.id) || !nonnegative(feature.rtSeconds) ||
      !positive(feature.mz) || !nonnegative(feature.intensity) ||
      (feature.charge !== undefined && !Number.isInteger(feature.charge)) || !Array.isArray(feature.traces)) return null
    const featureBounds = pointBounds(feature.rtSeconds, feature.mz)
    const traces: PreparedLcMsTrace[] = []
    const traceIds = new Set<string>()
    for (const trace of feature.traces) {
      const prepared = prepareTrace(trace, scanTimes)
      if (!prepared || traceIds.has(prepared.id)) return null
      traceIds.add(prepared.id)
      if (prepared.bounds) includeBounds(featureBounds, prepared.bounds)
      traces.push(prepared)
    }
    const prepared = { ...feature, traces, bounds: featureBounds }
    byId.set(feature.id, prepared)
    features.push(prepared)
    if (bounds) includeBounds(bounds, featureBounds)
    else bounds = { ...featureBounds }
  }
  return bounds ? { features, byId, bounds } : null
}

// Pointer inspection prefers the earlier acquisition on a tie. Keyboard navigation can still visit every scan by index.
export function nearestLcMsSampleIndex(samples: readonly LcMsSample[], rtSeconds: number): number | undefined {
  if (!samples.length || !Number.isFinite(rtSeconds)) return undefined
  let low = 0
  let high = samples.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (samples[middle][1] < rtSeconds) low = middle + 1
    else high = middle
  }
  const left = samples[low - 1]
  const right = samples[low]
  const time = !right || (left && rtSeconds - left[1] <= right[1] - rtSeconds) ? left[1] : right[1]
  while (low > 0 && samples[low - 1][1] === time) low--
  return low
}
