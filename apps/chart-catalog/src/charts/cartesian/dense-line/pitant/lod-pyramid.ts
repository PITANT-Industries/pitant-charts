import type { IngestOptions, SeriesStats } from './types.js'

/**
 * A single LOD level storing min-max bucket data.
 * Level 0 = raw data. Level k = 2^k aggregation.
 *
 * For level 0: quads are [timestamp, value, timestamp, value] (min==max).
 * For level k>0: quads are [tMin, vMin, tMax, vMax] per bucket.
 */
interface LodLevel {
  /** Interleaved [tMin, vMin, tMax, vMax] quads. Length = count * 4. */
  data: Float64Array
  /** Number of logical points (quads) in this level. */
  count: number
}

/**
 * Gap in the data stream where the line should break.
 */
interface Gap {
  startIndex: number
  endIndex: number
}

/**
 * Min-max LOD pyramid for a single time series.
 *
 * Build: O(N) per level, total O(N) (geometric series).
 * Memory: ≤ 2× raw data.
 * Query: O(log N) level selection + O(log N) binary search.
 * Append: O(1) amortized.
 */
export class LodPyramid {
  private _levels: LodLevel[] = []
  private _timestamps: BigInt64Array = new BigInt64Array(0)
  private _values: Float64Array = new Float64Array(0)
  private _count = 0
  private _stats: SeriesStats = emptyStats()
  private _gaps: Gap[] = []
  private _maxGapDuration = 0n
  private _maxPoints = 0

  /** Minimum points at deepest LOD level before we stop subdividing. */
  static readonly MIN_LEVEL_SIZE = 256

  get stats(): SeriesStats {
    return this._stats
  }

  get gaps(): ReadonlyArray<Gap> {
    return this._gaps
  }

  get pointCount(): number {
    return this._stats.count
  }

  get levelCount(): number {
    return this._levels.length
  }

  /**
   * Ingest full series data — replaces any existing data.
   */
  ingest(timestamps: BigInt64Array, values: Float64Array, options?: IngestOptions): SeriesStats {
    const n = Math.min(timestamps.length, values.length)
    if (n === 0) {
      this._reset()
      return this._stats
    }

    this._maxGapDuration = options?.maxGapDuration ?? 0n
    this._maxPoints = options?.maxPoints ?? 0

    // Apply ring buffer limit
    let startIdx = 0
    if (this._maxPoints > 0 && n > this._maxPoints) {
      startIdx = n - this._maxPoints
    }

    const effectiveN = n - startIdx
    const capacity = Math.max(effectiveN, this._maxPoints > 0 ? this._maxPoints : 0)
    this._timestamps = new BigInt64Array(capacity)
    this._values = new Float64Array(capacity)
    this._timestamps.set(timestamps.subarray(startIdx, startIdx + effectiveN))
    this._values.set(values.subarray(startIdx, startIdx + effectiveN))
    this._count = effectiveN

    // Compute stats
    this._stats = computeStats(this._timestamps, this._values, this._count)

    // Detect gaps
    this._gaps = detectGaps(this._timestamps, this._maxGapDuration, this._count)
    this._stats = { ...this._stats, gapCount: this._gaps.length }

    // Build pyramid
    this._buildPyramid()

    return this._stats
  }

  /**
   * Append new points to the series.
   * Returns the new total point count.
   */
  append(timestamps: BigInt64Array, values: Float64Array): number {
    const appendN = Math.min(timestamps.length, values.length)
    if (appendN === 0) return this._stats.count

    const oldN = this._count
    const newN = oldN + appendN

    // Check ring buffer
    if (this._maxPoints > 0 && newN > this._maxPoints) {
      // Need to evict oldest points
      const evictCount = newN - this._maxPoints
      const keepFromOld = Math.max(0, oldN - evictCount)
      const keepN = keepFromOld + appendN

      const newTs = new BigInt64Array(keepN)
      const newVals = new Float64Array(keepN)

      // Copy surviving old data
      if (keepFromOld > 0) {
        newTs.set(this._timestamps.subarray(oldN - keepFromOld, oldN))
        newVals.set(this._values.subarray(oldN - keepFromOld, oldN))
      }
      // Copy new data
      newTs.set(timestamps.subarray(0, appendN), keepFromOld)
      newVals.set(values.subarray(0, appendN), keepFromOld)

      this._timestamps = newTs
      this._values = newVals
      this._count = keepN

      // Full rebuild after ring buffer eviction
      this._stats = computeStats(this._timestamps, this._values, this._count)
      this._gaps = detectGaps(this._timestamps, this._maxGapDuration, this._count)
      this._stats = { ...this._stats, gapCount: this._gaps.length }
      this._buildPyramid()

      return this._count
    }

    this._ensureCapacity(newN)
    this._timestamps.set(timestamps.subarray(0, appendN), oldN)
    this._values.set(values.subarray(0, appendN), oldN)
    this._count = newN

    // Update stats incrementally
    this._updateStatsIncremental(timestamps.subarray(0, appendN), values.subarray(0, appendN))

    // Detect new gaps in appended range
    if (this._maxGapDuration > 0n) {
      this._detectGapsIncremental(oldN, appendN)
      this._stats.gapCount = this._gaps.length
    }

    // Propagate pyramid levels incrementally
    this._propagateAppend(oldN, appendN)

    return this._count
  }

  /**
   * Query the pyramid for a viewport range.
   * Returns interleaved [x, y] Float32Array suitable for GPU upload.
   */
  query(
    startTime: bigint,
    endTime: bigint,
    viewportWidth: number,
  ): { data: Float32Array; level: number; pointCount: number; gaps: Gap[] } {
    const n = this._count
    if (n === 0) {
      return { data: new Float32Array(0), level: 0, pointCount: 0, gaps: [] }
    }

    // Select appropriate LOD level
    const level = this._selectLevel(startTime, endTime, viewportWidth)

    if (level === 0) {
      // Raw data — binary search for range
      const startIdx = lowerBound(this._timestamps, startTime, n)
      const endIdx = upperBound(this._timestamps, endTime, n)
      const rangeN = endIdx - startIdx
      if (rangeN <= 0) {
        return { data: new Float32Array(0), level: 0, pointCount: 0, gaps: [] }
      }

      // Downcast to Float32 for GPU
      const result = new Float32Array(rangeN * 2)
      for (let i = 0; i < rangeN; i++) {
        result[i * 2] = Number(this._timestamps[startIdx + i])
        result[i * 2 + 1] = this._values[startIdx + i] as number
      }

      // Filter gaps to range
      const rangeGaps = this._gapsInRange(startIdx, endIdx, 0)
      return { data: result, level: 0, pointCount: rangeN, gaps: rangeGaps }
    }

    // LOD level — extract from pyramid
    const lodLevel = this._levels[level - 1] as LodLevel
    const lodData = lodLevel.data
    const lodCount = lodLevel.count

    // Binary search in LOD level for time range
    // Each quad is [tMin, vMin, tMax, vMax] — search on tMin (offset 0)
    const lodStart = lowerBoundLod(lodData, lodCount, startTime)
    const lodEnd = upperBoundLod(lodData, lodCount, endTime)
    const rangeCount = lodEnd - lodStart
    if (rangeCount <= 0) {
      return { data: new Float32Array(0), level, pointCount: 0, gaps: [] }
    }

    // Each LOD quad produces 2 points: (tMin, vMin) and (tMax, vMax)
    const result = new Float32Array(rangeCount * 4)
    for (let i = 0; i < rangeCount; i++) {
      const base = (lodStart + i) * 4
      const tMin = lodData[base] as number
      const vMin = lodData[base + 1] as number
      const tMax = lodData[base + 2] as number
      const vMax = lodData[base + 3] as number
      // Order by time: always show min-time point first
      result[i * 4] = tMin
      result[i * 4 + 1] = vMin
      result[i * 4 + 2] = tMax
      result[i * 4 + 3] = vMax
    }

    const rangeGaps = this._gapsInRange(lodStart, lodEnd, level)
    return { data: result, level, pointCount: rangeCount * 2, gaps: rangeGaps }
  }

  /**
   * Free all memory.
   */
  dispose(): void {
    this._reset()
  }

  // --- Private ---

  private _reset(): void {
    this._levels = []
    this._timestamps = new BigInt64Array(0)
    this._values = new Float64Array(0)
    this._count = 0
    this._stats = emptyStats()
    this._gaps = []
  }

  private _ensureCapacity(required: number): void {
    if (this._timestamps.length >= required && this._values.length >= required) return

    const doubled = Math.max(required, this._timestamps.length * 2, 1)
    const capacity =
      this._maxPoints > 0 && this._maxPoints >= required
        ? Math.max(required, this._maxPoints)
        : doubled
    const nextTimestamps = new BigInt64Array(capacity)
    const nextValues = new Float64Array(capacity)
    nextTimestamps.set(this._timestamps.subarray(0, this._count))
    nextValues.set(this._values.subarray(0, this._count))
    this._timestamps = nextTimestamps
    this._values = nextValues
  }

  /**
   * Build the full pyramid from raw data.
   * Level 0 is implicit (raw timestamps + values).
   * Pyramid levels store [tMin, vMin, tMax, vMax] quads.
   */
  private _buildPyramid(): void {
    this._levels = []
    const n = this._count

    if (n < LodPyramid.MIN_LEVEL_SIZE) return

    // Build first LOD level from raw data
    let prevCount = n
    const firstLevel = buildLevelFromRaw(this._timestamps, this._values, prevCount)
    this._levels.push(firstLevel)
    prevCount = firstLevel.count

    // Build subsequent levels from previous LOD level
    while (prevCount >= LodPyramid.MIN_LEVEL_SIZE) {
      const prev = this._levels[this._levels.length - 1] as LodLevel
      const nextLevel = buildLevelFromLod(prev.data, prev.count)
      this._levels.push(nextLevel)
      prevCount = nextLevel.count
    }
  }

  /**
   * Select the appropriate LOD level for a viewport query.
   * Returns 0 for raw data, 1+ for pyramid levels.
   */
  private _selectLevel(startTime: bigint, endTime: bigint, viewportWidth: number): number {
    if (viewportWidth <= 0) return 0

    const n = this._count
    if (n === 0) return 0

    // Estimate raw points in range
    const startIdx = lowerBound(this._timestamps, startTime, n)
    const endIdx = upperBound(this._timestamps, endTime, n)
    const rawPointsInRange = endIdx - startIdx

    // If raw data fits in viewport, use raw
    const maxPoints = viewportWidth * 2
    if (rawPointsInRange <= maxPoints) return 0

    // Walk pyramid levels to find suitable one
    for (let level = 0; level < this._levels.length; level++) {
      const lodLevel = this._levels[level] as LodLevel
      const lodStart = lowerBoundLod(lodLevel.data, lodLevel.count, startTime)
      const lodEnd = upperBoundLod(lodLevel.data, lodLevel.count, endTime)
      const pointsAtLevel = (lodEnd - lodStart) * 2 // each quad = 2 visual points
      if (pointsAtLevel <= maxPoints) return level + 1
    }

    // Use deepest level if nothing fits
    return this._levels.length
  }

  /**
   * Incrementally propagate appended data through pyramid levels.
   */
  private _propagateAppend(oldN: number, appendN: number): void {
    const n = this._count

    // Rebuild first LOD level from raw — only the tail
    if (this._levels.length === 0) {
      if (n >= LodPyramid.MIN_LEVEL_SIZE) {
        this._buildPyramid()
      }
      return
    }

    // Strategy: rebuild affected buckets at each level
    // For simplicity and correctness, rebuild from scratch when more than
    // 10% of data was appended. Otherwise, incremental update.
    if (appendN > n * 0.1) {
      this._buildPyramid()
      return
    }

    // Incrementally extend each level
    this._extendLevel0(oldN)

    for (let i = 1; i < this._levels.length; i++) {
      this._extendUpperLevel(i)
    }

    // Check if we need a new level
    const lastLevel = this._levels[this._levels.length - 1] as LodLevel
    if (lastLevel.count >= LodPyramid.MIN_LEVEL_SIZE) {
      const newLevel = buildLevelFromLod(lastLevel.data, lastLevel.count)
      this._levels.push(newLevel)
    }
  }

  /**
   * Extend level 0 (first pyramid level) with new raw data points.
   */
  private _extendLevel0(oldRawN: number): void {
    const level0 = this._levels[0]
    if (!level0) return

    const n = this._count
    // Old bucket count based on old raw count
    const oldBuckets = Math.ceil(oldRawN / 2)
    const newBuckets = Math.ceil(n / 2)
    const addedBuckets = newBuckets - oldBuckets

    if (addedBuckets <= 0) {
      // The last bucket may have changed (became complete)
      if (oldRawN % 2 === 1 && n > oldRawN) {
        // Recompute last bucket
        const bucketIdx = oldBuckets - 1
        const i = bucketIdx * 2
        const base = bucketIdx * 4
        const t0 = Number(this._timestamps[i])
        const v0 = this._values[i] as number
        const t1 = Number(this._timestamps[i + 1])
        const v1 = this._values[i + 1] as number
        level0.data[base] = Math.min(t0, t1)
        level0.data[base + 1] = Math.min(v0, v1)
        level0.data[base + 2] = Math.max(t0, t1)
        level0.data[base + 3] = Math.max(v0, v1)
      }
      return
    }

    // Grow level data
    const newData = new Float64Array(newBuckets * 4)
    newData.set(level0.data.subarray(0, oldBuckets * 4))

    // Recompute last old bucket if it was incomplete
    if (oldRawN % 2 === 1 && oldBuckets > 0) {
      const bucketIdx = oldBuckets - 1
      const i = bucketIdx * 2
      const base = bucketIdx * 4
      const t0 = Number(this._timestamps[i])
      const v0 = this._values[i] as number
      const t1 = i + 1 < n ? Number(this._timestamps[i + 1]) : t0
      const v1 = i + 1 < n ? (this._values[i + 1] as number) : v0
      newData[base] = Math.min(t0, t1)
      newData[base + 1] = Math.min(v0, v1)
      newData[base + 2] = Math.max(t0, t1)
      newData[base + 3] = Math.max(v0, v1)
    }

    // Compute new buckets
    for (let b = Math.max(oldBuckets, 0); b < newBuckets; b++) {
      const i = b * 2
      const base = b * 4
      const t0 = Number(this._timestamps[i])
      const v0 = this._values[i] as number
      if (i + 1 < n) {
        const t1 = Number(this._timestamps[i + 1])
        const v1 = this._values[i + 1] as number
        newData[base] = Math.min(t0, t1)
        newData[base + 1] = Math.min(v0, v1)
        newData[base + 2] = Math.max(t0, t1)
        newData[base + 3] = Math.max(v0, v1)
      } else {
        // Incomplete bucket (single point)
        newData[base] = t0
        newData[base + 1] = v0
        newData[base + 2] = t0
        newData[base + 3] = v0
      }
    }

    level0.data = newData
    level0.count = newBuckets
  }

  /**
   * Extend upper LOD level based on the level below it.
   */
  private _extendUpperLevel(levelIdx: number): void {
    const level = this._levels[levelIdx]
    const prevLevel = this._levels[levelIdx - 1]
    if (!level || !prevLevel) return

    const newCount = Math.ceil(prevLevel.count / 2)
    if (newCount <= level.count) return

    const newData = new Float64Array(newCount * 4)
    newData.set(level.data.subarray(0, level.count * 4))

    // Recompute last old bucket if it was incomplete
    if (level.count > 0 && prevLevel.count > level.count * 2 - 1) {
      const b = level.count - 1
      const pi = b * 2
      recomputeBucket(newData, b, prevLevel.data, pi, prevLevel.count)
    }

    // Compute new buckets
    for (let b = level.count; b < newCount; b++) {
      const pi = b * 2
      recomputeBucket(newData, b, prevLevel.data, pi, prevLevel.count)
    }

    level.data = newData
    level.count = newCount
  }

  /**
   * Incrementally update stats with new data points.
   */
  private _updateStatsIncremental(timestamps: BigInt64Array, values: Float64Array): void {
    const n = values.length
    const s = this._stats
    const oldCount = s.count
    const oldMean = s.mean

    let min = s.min
    let max = s.max
    let sum = oldMean * oldCount
    let sumSq = (s.stdDev * s.stdDev + oldMean * oldMean) * oldCount

    for (let i = 0; i < n; i++) {
      const v = values[i] as number
      if (v < min) min = v
      if (v > max) max = v
      sum += v
      sumSq += v * v
    }

    const newCount = oldCount + n
    const newMean = sum / newCount
    const variance = sumSq / newCount - newMean * newMean

    s.count = newCount
    s.min = min
    s.max = max
    s.mean = newMean
    s.stdDev = Math.sqrt(Math.max(0, variance))
    if (n > 0) {
      s.lastTimestamp = timestamps[n - 1] as bigint
    }
  }

  /**
   * Detect gaps in newly appended data.
   */
  private _detectGapsIncremental(oldN: number, appendN: number): void {
    if (this._maxGapDuration <= 0n) return

    const ts = this._timestamps
    // Check boundary between old and new data
    const startIdx = Math.max(0, oldN - 1)
    const endIdx = oldN + appendN

    for (let i = startIdx; i < endIdx - 1; i++) {
      const dt = (ts[i + 1] as bigint) - (ts[i] as bigint)
      if (dt > this._maxGapDuration) {
        this._gaps.push({ startIndex: i, endIndex: i + 1 })
      }
    }
  }

  /**
   * Map raw-data gap indices to the equivalent range in a LOD level.
   */
  private _gapsInRange(startIdx: number, endIdx: number, level: number): Gap[] {
    if (this._gaps.length === 0) return []

    const result: Gap[] = []
    const divisor = level === 0 ? 1 : 2 ** level

    for (const gap of this._gaps) {
      const gapStart = Math.floor(gap.startIndex / divisor)
      const gapEnd = Math.ceil(gap.endIndex / divisor)
      if (gapStart < endIdx && gapEnd > startIdx) {
        result.push({
          startIndex: Math.max(gapStart - startIdx, 0),
          endIndex: Math.min(gapEnd - startIdx, endIdx - startIdx),
        })
      }
    }

    return result
  }
}

// --- Pure helper functions ---

function emptyStats(): SeriesStats {
  return {
    count: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    mean: 0,
    stdDev: 0,
    firstTimestamp: 0n,
    lastTimestamp: 0n,
    gapCount: 0,
    badQualityCount: 0,
  }
}

function computeStats(
  timestamps: BigInt64Array,
  values: Float64Array,
  count = values.length,
): SeriesStats {
  const n = Math.min(count, timestamps.length, values.length)
  if (n === 0) return emptyStats()

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  let sumSq = 0

  for (let i = 0; i < n; i++) {
    const v = values[i] as number
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    sumSq += v * v
  }

  const mean = sum / n
  const variance = sumSq / n - mean * mean

  return {
    count: n,
    min,
    max,
    mean,
    stdDev: Math.sqrt(Math.max(0, variance)),
    firstTimestamp: timestamps[0] as bigint,
    lastTimestamp: timestamps[n - 1] as bigint,
    gapCount: 0,
    badQualityCount: 0,
  }
}

function detectGaps(
  timestamps: BigInt64Array,
  maxGapDuration: bigint,
  count = timestamps.length,
): Gap[] {
  if (maxGapDuration <= 0n) return []
  const n = Math.min(count, timestamps.length)
  const gaps: Gap[] = []
  for (let i = 0; i < n - 1; i++) {
    const dt = (timestamps[i + 1] as bigint) - (timestamps[i] as bigint)
    if (dt > maxGapDuration) {
      gaps.push({ startIndex: i, endIndex: i + 1 })
    }
  }
  return gaps
}

/**
 * Build the first LOD level from raw timestamps + values.
 * Each pair of consecutive points → one [tMin, vMin, tMax, vMax] quad.
 */
function buildLevelFromRaw(
  timestamps: BigInt64Array,
  values: Float64Array,
  count: number,
): LodLevel {
  const buckets = Math.ceil(count / 2)
  const data = new Float64Array(buckets * 4)

  for (let b = 0; b < buckets; b++) {
    const i = b * 2
    const base = b * 4
    const t0 = Number(timestamps[i])
    const v0 = values[i] as number

    if (i + 1 < count) {
      const t1 = Number(timestamps[i + 1])
      const v1 = values[i + 1] as number
      data[base] = Math.min(t0, t1)
      data[base + 1] = Math.min(v0, v1)
      data[base + 2] = Math.max(t0, t1)
      data[base + 3] = Math.max(v0, v1)
    } else {
      data[base] = t0
      data[base + 1] = v0
      data[base + 2] = t0
      data[base + 3] = v0
    }
  }

  return { data, count: buckets }
}

/**
 * Build a LOD level from the previous LOD level.
 * Each pair of quads → one merged quad.
 */
function buildLevelFromLod(prevData: Float64Array, prevCount: number): LodLevel {
  const buckets = Math.ceil(prevCount / 2)
  const data = new Float64Array(buckets * 4)

  for (let b = 0; b < buckets; b++) {
    const pi = b * 2
    recomputeBucket(data, b, prevData, pi, prevCount)
  }

  return { data, count: buckets }
}

/**
 * Recompute a single bucket from two consecutive quads in the previous level.
 */
function recomputeBucket(
  dst: Float64Array,
  dstIdx: number,
  src: Float64Array,
  srcPairIdx: number,
  srcCount: number,
): void {
  const base = dstIdx * 4
  const s0 = srcPairIdx * 4

  const tMin0 = src[s0] as number
  const vMin0 = src[s0 + 1] as number
  const tMax0 = src[s0 + 2] as number
  const vMax0 = src[s0 + 3] as number

  if (srcPairIdx + 1 < srcCount) {
    const s1 = (srcPairIdx + 1) * 4
    const tMin1 = src[s1] as number
    const vMin1 = src[s1 + 1] as number
    const tMax1 = src[s1 + 2] as number
    const vMax1 = src[s1 + 3] as number

    dst[base] = Math.min(tMin0, tMin1)
    dst[base + 1] = Math.min(vMin0, vMin1)
    dst[base + 2] = Math.max(tMax0, tMax1)
    dst[base + 3] = Math.max(vMax0, vMax1)
  } else {
    dst[base] = tMin0
    dst[base + 1] = vMin0
    dst[base + 2] = tMax0
    dst[base + 3] = vMax0
  }
}

/**
 * Lower bound binary search on a BigInt64Array.
 * Returns index of first element >= target.
 */
function lowerBound(arr: BigInt64Array, target: bigint, count = arr.length): number {
  let lo = 0
  let hi = Math.min(count, arr.length)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((arr[mid] as bigint) < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Upper bound binary search on a BigInt64Array.
 * Returns index of first element > target.
 */
function upperBound(arr: BigInt64Array, target: bigint, count = arr.length): number {
  let lo = 0
  let hi = Math.min(count, arr.length)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((arr[mid] as bigint) <= target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Lower bound on LOD level data.
 * Searches tMin (offset 0 of each quad).
 */
function lowerBoundLod(data: Float64Array, count: number, target: bigint): number {
  const targetNum = Number(target)
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((data[mid * 4] as number) < targetNum) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Upper bound on LOD level data.
 * Searches tMax (offset 2 of each quad).
 */
function upperBoundLod(data: Float64Array, count: number, target: bigint): number {
  const targetNum = Number(target)
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((data[mid * 4 + 2] as number) <= targetNum) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}
