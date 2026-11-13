/**
 * Statistics tracked for each ingested series.
 */
export interface SeriesStats {
  count: number
  min: number
  max: number
  mean: number
  stdDev: number
  firstTimestamp: bigint
  lastTimestamp: bigint
  gapCount: number
  badQualityCount: number
}

/**
 * Options for ingesting data into the engine.
 */
export interface IngestOptions {
  /** Maximum points to retain (ring buffer mode). 0 = unlimited. */
  maxPoints?: number
  /** Gap detection threshold in nanoseconds. */
  maxGapDuration?: bigint
}

/**
 * Result of a viewport query.
 */
export interface QueryResult {
  /** Interleaved [x, y] pairs ready for GPU vertex buffer upload. */
  data: Float32Array
  /** LOD level used. 0 = raw data. */
  level: number
  /** Number of logical points returned. */
  pointCount: number
  /** Indices of gaps in the data (line should break). */
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

/**
 * Commands sent from main thread to data engine worker.
 */
export type WorkerCommand =
  | {
      type: 'ingest'
      seriesId: string
      timestamps: BigInt64Array
      values: Float64Array
      quality?: Uint8Array
    }
  | {
      type: 'append'
      seriesId: string
      timestamps: BigInt64Array
      values: Float64Array
    }
  | {
      type: 'query'
      seriesId: string
      startTime: bigint
      endTime: bigint
      viewportWidth: number
    }
  | { type: 'dispose'; seriesId: string }
  | { type: 'getStats'; seriesId: string }

/**
 * Responses sent from data engine worker to main thread.
 */
export type WorkerResponse =
  | { type: 'ingested'; seriesId: string; stats: SeriesStats }
  | { type: 'appended'; seriesId: string; newLength: number }
  | {
      type: 'queryResult'
      seriesId: string
      data: Float32Array
      level: number
      pointCount: number
      gaps: Array<{ startIndex: number; endIndex: number }>
    }
  | { type: 'stats'; seriesId: string; stats: SeriesStats }
  | { type: 'error'; seriesId: string; message: string }
