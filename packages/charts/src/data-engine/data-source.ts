/**
 * DataSource — High-level facade over DataEngine using the columnar API.
 *
 * Accepts DataInput (JSON rows, ArrayBuffer, Float64Array, or ColumnarData),
 * converts to columnar format, validates, ingests each column into the
 * DataEngine as a separate series, and provides viewport queries that
 * return columnar ViewportResult.
 */

import {
  type BinarySchema,
  type ColumnarData,
  type DataInput,
  timestampFromNanoseconds,
  timestampToNanoseconds,
  toBigIntTimestamps,
  toColumnar,
  type ViewportQuery,
  type ViewportResult,
  validateColumnar,
} from './columnar.js'
import { DataEngine } from './data-engine.js'
import type { IngestOptions, SeriesStats } from './types.js'

export interface DataSourceOptions {
  /** Options passed to DataEngine.ingest(). */
  ingestOptions?: IngestOptions
  /** Time unit of the input data. Default: 'ms'. */
  timeUnit?: 'ms' | 'us' | 'ns'
  /** Throw on validation issues instead of silently accepting. Default: false. */
  strict?: boolean
}

/**
 * High-level data API for time-series charting.
 *
 * Converts arbitrary data formats to columnar, validates, and manages
 * a DataEngine instance with per-column series.
 */
export class DataSource {
  private readonly _engine: DataEngine
  private readonly _options: DataSourceOptions
  private readonly _columns = new Set<string>()
  private _columnarCache: ColumnarData | null = null
  private _destroyed = false

  constructor(options?: DataSourceOptions) {
    // Each column shares the timestamp input buffer. Copy worker inputs
    // rather than detaching this buffer or the caller's value arrays.
    this._engine = new DataEngine({ transferInputBuffers: false })
    this._options = options ?? {}
  }

  /** The set of ingested column names. */
  get columns(): ReadonlySet<string> {
    return this._columns
  }

  /** Access the underlying DataEngine (for advanced use, e.g. streaming). */
  get engine(): DataEngine {
    return this._engine
  }

  /** The last ingested ColumnarData (after toColumnar + validation). */
  get lastColumnar(): ColumnarData | null {
    return this._columnarCache
  }

  /**
   * Load data from any supported format.
   * Converts to columnar, validates, and ingests every column as a DataEngine series.
   *
   * @returns Stats per column keyed by column name.
   */
  async load(input: DataInput, schema?: BinarySchema): Promise<Record<string, SeriesStats>> {
    this._assertNotDestroyed()

    const columnar = toColumnar(input, schema)
    const timeUnit = this._options.timeUnit ?? columnar.timeUnit ?? 'ms'

    if (this._options.strict) {
      const issues = validateColumnar(columnar)
      if (issues.length > 0) {
        throw new Error(
          `Data validation failed:\n${issues.map((i) => `  - ${i.message}`).join('\n')}`,
        )
      }
    }

    this._columnarCache = cloneColumnarCache(columnar)

    // Convert timestamps to BigInt nanoseconds for the low-level engine
    const bigTimestamps = toBigIntTimestamps(columnar.timestamps, timeUnit, 'nanosecond')

    // Ingest each column as a separate series
    const stats: Record<string, SeriesStats> = {}
    for (const [name, values] of Object.entries(columnar.columns)) {
      this._columns.add(name)
      stats[name] = await this._engine.ingest(
        name,
        bigTimestamps,
        values,
        this._options.ingestOptions,
      )
    }

    return stats
  }

  /**
   * Append new data points (same format as load; must include all existing columns).
   *
   * @returns New total point count per column.
   */
  async append(input: DataInput, schema?: BinarySchema): Promise<Record<string, number>> {
    this._assertNotDestroyed()

    const columnar = toColumnar(input, schema)
    const timeUnit =
      this._options.timeUnit ?? columnar.timeUnit ?? this._columnarCache?.timeUnit ?? 'ms'

    if (this._options.strict) {
      const issues = validateColumnar(columnar)
      if (issues.length > 0) {
        throw new Error(
          `Data validation failed:\n${issues.map((i) => `  - ${i.message}`).join('\n')}`,
        )
      }
    }

    const cacheAppend = cloneColumnarCache(columnar)
    const bigTimestamps = toBigIntTimestamps(columnar.timestamps, timeUnit, 'nanosecond')

    const counts: Record<string, number> = {}
    for (const [name, values] of Object.entries(columnar.columns)) {
      if (!this._columns.has(name)) {
        this._columns.add(name)
      }
      counts[name] = await this._engine.append(name, bigTimestamps, values)
    }

    this._columnarCache = this._columnarCache
      ? appendColumnarCache(this._columnarCache, cacheAppend)
      : cacheAppend

    return counts
  }

  /**
   * Query for viewport-resolution data across all or selected columns.
   *
   */
  async query(query: ViewportQuery): Promise<ViewportResult> {
    this._assertNotDestroyed()

    const cached = this._columnarCache
    const timeUnit = this._options.timeUnit ?? cached?.timeUnit ?? 'ms'
    const nsMultiplier = timeUnit === 'ns' ? 1n : timeUnit === 'us' ? 1_000n : 1_000_000n
    const startNs = timestampToNanoseconds(query.start, nsMultiplier)
    const endNs = timestampToNanoseconds(query.end, nsMultiplier)
    const targetColumns = query.columns ?? [...this._columns]

    // Query first column to get timestamps + gaps + LOD level
    const firstColumn = targetColumns[0]
    if (!firstColumn) {
      return {
        timestamps: new Float64Array(0),
        columns: {},
        lodLevel: 0,
        rawPointCount: 0,
        returnedPointCount: 0,
        gaps: [],
      }
    }

    const [firstResult, stats, ...otherValues] = await Promise.all([
      this._engine.queryColumns(firstColumn, startNs, endNs, query.targetPixels),
      this._engine.getStats(firstColumn),
      ...targetColumns
        .slice(1)
        .map((column) => this._engine.queryValues(column, startNs, endNs, query.targetPixels)),
    ])

    // Divide the exact engine timestamps before converting to numbers.
    const pointCount = firstResult.pointCount
    const timestamps = new Float64Array(pointCount)
    for (let i = 0; i < pointCount; i++) {
      timestamps[i] = timestampFromNanoseconds(firstResult.timestamps[i] as bigint, nsMultiplier)
    }

    const columns: Record<string, Float64Array> = {}
    const quality: Record<string, Uint8Array> = {}
    const sourceQuality = cached?.quality
    const qualityIndices =
      cached && sourceQuality && targetColumns.some((column) => sourceQuality[column] !== undefined)
        ? indicesForTimestamps(timestamps, cached.timestamps)
        : undefined

    for (let index = 0; index < targetColumns.length; index++) {
      const column = targetColumns[index] as string
      columns[column] = index === 0 ? firstResult.values : (otherValues[index - 1] as Float64Array)

      const flags = sourceQuality?.[column]
      if (qualityIndices && flags) {
        quality[column] = Uint8Array.from(qualityIndices, (sourceIndex) => flags[sourceIndex] ?? 0)
      }
    }

    const result: ViewportResult = {
      timestamps,
      columns,
      lodLevel: firstResult.level,
      rawPointCount: stats.count,
      returnedPointCount: pointCount,
      gaps: firstResult.gaps,
    }
    if (Object.keys(quality).length > 0) {
      result.quality = quality
    }

    return result
  }

  /**
   * Get the full time range across all columns.
   */
  async getTimeRange(): Promise<{ start: number; end: number } | null> {
    this._assertNotDestroyed()

    const cols = [...this._columns]
    if (cols.length === 0) return null

    const timeUnit = this._options.timeUnit ?? this._columnarCache?.timeUnit ?? 'ms'
    const nsDivisor = timeUnit === 'ns' ? 1n : timeUnit === 'us' ? 1_000n : 1_000_000n

    // Use the first column's stats (all columns share timestamps)
    const firstCol = cols[0] as string
    const stats = await this._engine.getStats(firstCol)

    return {
      start: timestampFromNanoseconds(stats.firstTimestamp, nsDivisor),
      end: timestampFromNanoseconds(stats.lastTimestamp, nsDivisor),
    }
  }

  /**
   * Get statistics for a specific column.
   */
  async getStats(column: string): Promise<SeriesStats> {
    this._assertNotDestroyed()
    return this._engine.getStats(column)
  }

  /**
   * Clear a specific column.
   */
  async clear(column: string): Promise<void> {
    this._assertNotDestroyed()
    await this._engine.dispose(column)
    this._columns.delete(column)
    if (this._columnarCache) {
      const { [column]: _value, ...columns } = this._columnarCache.columns
      const quality = this._columnarCache.quality
      if (quality) {
        const { [column]: _qualityValue, ...remainingQuality } = quality
        this._columnarCache = withOptionalQuality(
          {
            timestamps: this._columnarCache.timestamps,
            columns,
            ...(this._columnarCache.timeUnit ? { timeUnit: this._columnarCache.timeUnit } : {}),
          },
          remainingQuality,
        )
      } else {
        this._columnarCache = {
          timestamps: this._columnarCache.timestamps,
          columns,
          ...(this._columnarCache.timeUnit ? { timeUnit: this._columnarCache.timeUnit } : {}),
        }
      }
    }
  }

  /**
   * Destroy the data source and free all resources.
   */
  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this._columnarCache = null
    this._columns.clear()
    this._engine.destroy()
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('DataSource has been destroyed')
    }
  }
}

function appendColumnarCache(current: ColumnarData, next: ColumnarData): ColumnarData {
  const timestamps = concatFloat64(current.timestamps, next.timestamps)
  const columns: Record<string, Float64Array> = {}
  const fields = new Set([...Object.keys(current.columns), ...Object.keys(next.columns)])

  for (const field of fields) {
    const left = current.columns[field] ?? filledFloat64(current.timestamps.length, Number.NaN)
    const right = next.columns[field] ?? filledFloat64(next.timestamps.length, Number.NaN)
    columns[field] = concatFloat64(left, right)
  }

  const quality = mergeQuality(current, next)
  const merged: ColumnarData = {
    timestamps,
    columns,
    ...((next.timeUnit ?? current.timeUnit)
      ? { timeUnit: (next.timeUnit ?? current.timeUnit) as 'ms' | 'us' | 'ns' }
      : {}),
  }

  return withOptionalQuality(merged, quality)
}

function cloneColumnarCache(data: ColumnarData): ColumnarData {
  const columns: Record<string, Float64Array> = {}
  for (const [field, values] of Object.entries(data.columns)) {
    columns[field] = new Float64Array(values)
  }

  const cloned: ColumnarData = {
    timestamps: new Float64Array(data.timestamps),
    columns,
    ...(data.timeUnit ? { timeUnit: data.timeUnit } : {}),
  }

  if (data.quality) {
    const quality: Record<string, Uint8Array> = {}
    for (const [field, values] of Object.entries(data.quality)) {
      quality[field] = new Uint8Array(values)
    }
    cloned.quality = quality
  }

  return cloned
}

function mergeQuality(
  current: ColumnarData,
  next: ColumnarData,
): Record<string, Uint8Array> | undefined {
  if (!current.quality && !next.quality) return undefined

  const quality: Record<string, Uint8Array> = {}
  const fields = new Set([...Object.keys(current.columns), ...Object.keys(next.columns)])
  for (const field of fields) {
    const left =
      current.quality?.[field] ?? filledUint8(current.timestamps.length, defaultQualityFor(field))
    const right =
      next.quality?.[field] ?? filledUint8(next.timestamps.length, defaultQualityFor(field))
    quality[field] = concatUint8(left, right)
  }

  return quality
}

function withOptionalQuality(data: ColumnarData, quality: Record<string, Uint8Array>): ColumnarData
function withOptionalQuality(
  data: ColumnarData,
  quality: Record<string, Uint8Array> | undefined,
): ColumnarData
function withOptionalQuality(
  data: ColumnarData,
  quality: Record<string, Uint8Array> | undefined,
): ColumnarData {
  if (!quality || Object.keys(quality).length === 0) return data
  return { ...data, quality }
}

function indicesForTimestamps(
  resultTimestamps: Float64Array,
  sourceTimestamps: Float64Array,
): Uint32Array {
  const indices = new Uint32Array(resultTimestamps.length)
  if (resultTimestamps.length === 0 || sourceTimestamps.length === 0) return indices

  // Start near the viewport instead of walking the full source history.
  const first = resultTimestamps[0] as number
  let low = 0
  let high = sourceTimestamps.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((sourceTimestamps[middle] as number) <= first) low = middle + 1
    else high = middle
  }

  let cursor = Math.max(0, low - 1)
  for (let index = 0; index < resultTimestamps.length; index++) {
    cursor = nearestTimestampIndex(sourceTimestamps, resultTimestamps[index] as number, cursor)
    indices[index] = cursor
  }
  return indices
}

function nearestTimestampIndex(timestamps: Float64Array, target: number, cursor: number): number {
  let index = Math.min(Math.max(cursor, 0), Math.max(0, timestamps.length - 1))

  while (index + 1 < timestamps.length && (timestamps[index + 1] as number) <= target) {
    index += 1
  }

  const current = timestamps[index] as number
  const next = timestamps[index + 1]
  if (next !== undefined && Math.abs(next - target) < Math.abs(current - target)) {
    return index + 1
  }

  return index
}

function concatFloat64(left: Float64Array, right: Float64Array): Float64Array {
  const merged = new Float64Array(left.length + right.length)
  merged.set(left, 0)
  merged.set(right, left.length)
  return merged
}

function concatUint8(left: Uint8Array, right: Uint8Array): Uint8Array {
  const merged = new Uint8Array(left.length + right.length)
  merged.set(left, 0)
  merged.set(right, left.length)
  return merged
}

function filledFloat64(length: number, value: number): Float64Array {
  const values = new Float64Array(length)
  values.fill(value)
  return values
}

function filledUint8(length: number, value: number): Uint8Array {
  const values = new Uint8Array(length)
  values.fill(value)
  return values
}

function defaultQualityFor(_field: string): number {
  return 0
}
