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
    this._engine = new DataEngine()
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

    this._columnarCache = columnar

    // Convert timestamps to BigInt nanoseconds for the low-level engine
    const bigTimestamps = toBigIntTimestamps(columnar.timestamps, timeUnit)

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
    const timeUnit = this._options.timeUnit ?? columnar.timeUnit ?? 'ms'

    if (this._options.strict) {
      const issues = validateColumnar(columnar)
      if (issues.length > 0) {
        throw new Error(
          `Data validation failed:\n${issues.map((i) => `  - ${i.message}`).join('\n')}`,
        )
      }
    }

    const bigTimestamps = toBigIntTimestamps(columnar.timestamps, timeUnit)

    const counts: Record<string, number> = {}
    for (const [name, values] of Object.entries(columnar.columns)) {
      if (!this._columns.has(name)) {
        this._columns.add(name)
      }
      counts[name] = await this._engine.append(name, bigTimestamps, values)
    }

    return counts
  }

  /**
   * Query for viewport-resolution data across all or selected columns.
   *
   * The DataEngine returns interleaved [x, y] pairs from the LOD pyramid.
   * This method converts back to columnar ViewportResult format.
   */
  async query(query: ViewportQuery): Promise<ViewportResult> {
    this._assertNotDestroyed()

    const timeUnit = this._options.timeUnit ?? 'ms'
    const nsMultiplier = timeUnit === 'ns' ? 1n : timeUnit === 'us' ? 1_000n : 1_000_000n
    const startNs = BigInt(Math.round(query.start)) * nsMultiplier
    const endNs = BigInt(Math.round(query.end)) * nsMultiplier
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

    const firstResult = await this._engine.query(firstColumn, startNs, endNs, query.targetPixels)

    // Extract timestamps from the interleaved [x, y] pairs
    const pointCount = firstResult.pointCount
    const timestamps = new Float64Array(pointCount)
    const firstValues = new Float64Array(pointCount)
    const nsDivisor = Number(nsMultiplier)

    for (let i = 0; i < pointCount; i++) {
      // DataEngine timestamps are in nanoseconds — convert back
      timestamps[i] = (firstResult.data[i * 2] as number) / nsDivisor
      firstValues[i] = firstResult.data[i * 2 + 1] as number
    }

    const columns: Record<string, Float64Array> = {
      [firstColumn]: firstValues,
    }

    // Query remaining columns (they share the same timestamps/LOD level)
    for (let c = 1; c < targetColumns.length; c++) {
      const colName = targetColumns[c] as string
      const result = await this._engine.query(colName, startNs, endNs, query.targetPixels)
      const values = new Float64Array(result.pointCount)
      for (let i = 0; i < result.pointCount; i++) {
        values[i] = result.data[i * 2 + 1] as number
      }
      columns[colName] = values
    }

    // Compute raw point count from series stats
    const stats = await this._engine.getStats(firstColumn)
    const rawPointCount = stats.count

    return {
      timestamps,
      columns,
      lodLevel: firstResult.level,
      rawPointCount,
      returnedPointCount: pointCount,
      gaps: firstResult.gaps,
    }
  }

  /**
   * Get the full time range across all columns.
   */
  async getTimeRange(): Promise<{ start: number; end: number } | null> {
    this._assertNotDestroyed()

    const cols = [...this._columns]
    if (cols.length === 0) return null

    const timeUnit = this._options.timeUnit ?? 'ms'
    const nsDivisor = timeUnit === 'ns' ? 1n : timeUnit === 'us' ? 1_000n : 1_000_000n

    // Use the first column's stats (all columns share timestamps)
    const firstCol = cols[0] as string
    const stats = await this._engine.getStats(firstCol)

    return {
      start: Number(stats.firstTimestamp / nsDivisor),
      end: Number(stats.lastTimestamp / nsDivisor),
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
