import type { ColumnarQueryResult, IngestOptions, QueryResult, SeriesStats } from './types.js'

/** A level stores two extrema per bucket. Bucket bounds index the raw timestamps. */
interface LodLevel {
  data: Float64Array
  count: number
}

interface LodRange {
  level: number
  start: number
  end: number
  bucketSize: number
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

  /** Query interleaved Float32 pairs for legacy renderers. */
  query(startTime: bigint, endTime: bigint, viewportWidth: number): QueryResult {
    const range = this._queryRange(startTime, endTime, viewportWidth)
    const { level, start, end, bucketSize } = range
    const pointCount = (end - start) * (level === 0 ? 1 : 2)
    const data = new Float32Array(pointCount * 2)

    if (level === 0) {
      for (let i = start; i < end; i++) {
        const offset = (i - start) * 2
        data[offset] = Number(this._timestamps[i])
        data[offset + 1] = this._values[i] as number
      }
    } else {
      const buckets = this._levels[level - 1] as LodLevel
      for (let i = start; i < end; i++) {
        const offset = (i - start) * 4
        data[offset] = Number(this._timestamps[i * bucketSize])
        data[offset + 1] = buckets.data[i * 2] as number
        data[offset + 2] = Number(this._timestamps[Math.min((i + 1) * bucketSize, this._count) - 1])
        data[offset + 3] = buckets.data[i * 2 + 1] as number
      }
    }

    return { data, level, pointCount, gaps: this._gapsInRange(start, end, level) }
  }

  /** Query independent timestamps and values without any precision loss. */
  queryColumns(startTime: bigint, endTime: bigint, viewportWidth: number): ColumnarQueryResult {
    const { level, start, end, bucketSize } = this._queryRange(startTime, endTime, viewportWidth)
    const gaps = this._gapsInRange(start, end, level)
    if (level === 0) {
      return {
        timestamps: this._timestamps.slice(start, end),
        values: this._values.slice(start, end),
        pointCount: end - start,
        level,
        gaps,
      }
    }

    const buckets = this._levels[level - 1] as LodLevel
    const pointCount = (end - start) * 2
    const timestamps = new BigInt64Array(pointCount)
    for (let i = start; i < end; i++) {
      const offset = (i - start) * 2
      timestamps[offset] = this._timestamps[i * bucketSize] as bigint
      timestamps[offset + 1] = this._timestamps[
        Math.min((i + 1) * bucketSize, this._count) - 1
      ] as bigint
    }
    return {
      timestamps,
      values: buckets.data.slice(start * 2, end * 2),
      pointCount,
      level,
      gaps,
    }
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

  private _buildPyramid(): void {
    this._levels = []
    if (this._count < LodPyramid.MIN_LEVEL_SIZE) return

    let previous = buildLevel(this._values, this._count, 1)
    this._levels.push(previous)
    while (previous.count >= LodPyramid.MIN_LEVEL_SIZE) {
      previous = buildLevel(previous.data, previous.count, 2)
      this._levels.push(previous)
    }
  }

  private _queryRange(startTime: bigint, endTime: bigint, viewportWidth: number): LodRange {
    const count = this._count
    const startIndex = lowerBound(this._timestamps, startTime, count)
    const endIndex = Math.max(startIndex, upperBound(this._timestamps, endTime, count))
    const maxPoints = viewportWidth * 2
    if (viewportWidth <= 0 || endIndex - startIndex <= maxPoints || this._levels.length === 0) {
      return { level: 0, start: startIndex, end: endIndex, bucketSize: 1 }
    }

    // Use exact raw bounds to find complete buckets, including the partial tail
    // bucket when the viewport reaches the last sample.
    let range: LodRange = { level: 0, start: startIndex, end: endIndex, bucketSize: 1 }
    for (let index = 0; index < this._levels.length; index++) {
      const level = index + 1
      const bucketSize = 2 ** level
      const start = Math.ceil(startIndex / bucketSize)
      const end =
        endIndex === count
          ? (this._levels[index] as LodLevel).count
          : Math.floor(endIndex / bucketSize)
      range = { level, start, end: Math.max(start, end), bucketSize }
      if ((range.end - start) * 2 <= maxPoints) break
    }
    return range
  }

  /** Update the buckets touched by the appended samples and extend the pyramid if needed. */
  private _propagateAppend(oldCount: number, appendedCount: number): void {
    if (this._levels.length === 0) {
      if (this._count >= LodPyramid.MIN_LEVEL_SIZE) this._buildPyramid()
      return
    }
    if (appendedCount > this._count * 0.1) {
      this._buildPyramid()
      return
    }

    let previous: LodLevel = { data: this._values, count: this._count }
    for (let index = 0; index < this._levels.length; index++) {
      const level = this._levels[index] as LodLevel
      const stride = index === 0 ? 1 : 2
      const bucketCount = Math.ceil(previous.count / 2)
      const startBucket = Math.floor(oldCount / 2 ** (index + 1))
      if (bucketCount > level.count) {
        const next = new Float64Array(bucketCount * 2)
        next.set(level.data.subarray(0, startBucket * 2))
        level.data = next
        level.count = bucketCount
      }
      for (let bucket = startBucket; bucket < bucketCount; bucket++) {
        writeBucket(level.data, bucket, previous.data, previous.count, stride)
      }
      previous = level
    }

    if (previous.count >= LodPyramid.MIN_LEVEL_SIZE) {
      this._levels.push(buildLevel(previous.data, previous.count, 2))
    }
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
    if (this._gaps.length === 0 || startIdx >= endIdx) return []

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

function buildLevel(source: Float64Array, sourceCount: number, stride: 1 | 2): LodLevel {
  const count = Math.ceil(sourceCount / 2)
  const data = new Float64Array(count * 2)
  for (let bucket = 0; bucket < count; bucket++) {
    writeBucket(data, bucket, source, sourceCount, stride)
  }
  return { data, count }
}

/** Combine adjacent raw values or extrema pairs into one bucket. */
function writeBucket(
  data: Float64Array,
  bucket: number,
  source: Float64Array,
  sourceCount: number,
  stride: 1 | 2,
): void {
  const first = bucket * 2
  const second = Math.min(first + 1, sourceCount - 1)
  data[bucket * 2] = Math.min(source[first * stride] as number, source[second * stride] as number)
  data[bucket * 2 + 1] = Math.max(
    source[first * stride + stride - 1] as number,
    source[second * stride + stride - 1] as number,
  )
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
