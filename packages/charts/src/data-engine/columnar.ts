/**
 * E3.2 — Multi-Resolution Data Model API
 *
 * Columnar data format for zero-copy ingestion, format converters,
 * and viewport query types that wrap the existing DataEngine/LodPyramid.
 */

// ── Columnar Data Types ──────────────────────────────────────

/**
 * Columnar data format — zero-copy from typed array sources.
 * All arrays within a single ColumnarData must have the same length.
 */
export interface ColumnarData {
  /** Timestamps in ascending order (epoch milliseconds, microseconds, or nanoseconds). */
  timestamps: Float64Array
  /** Named value columns keyed by field name. */
  columns: Record<string, Float64Array>
  /** Optional OPC/industrial quality flags keyed by field name. 0 = good by convention. */
  quality?: Record<string, Uint8Array>
  /** Time unit. Default: 'ms'. */
  timeUnit?: 'ms' | 'us' | 'ns'
}

/**
 * Schema for decoding raw binary (ArrayBuffer) input.
 */
export interface BinarySchema {
  /** Column names in order (first is always treated as the timestamp column). */
  columns: string[]
  /** Byte type per column (default: 'float64' for all). */
  types?: ('float32' | 'float64' | 'int32' | 'uint32')[]
  /** Byte order (default: true = little-endian). */
  littleEndian?: boolean
}

/**
 * All supported input formats that can be converted to ColumnarData.
 */
export type DataInput =
  | ColumnarData
  | { timestamp: number; [key: string]: number }[]
  | ArrayBuffer
  | Float64Array

// ── Viewport Query Types ─────────────────────────────────────

/**
 * Query the data engine for a specific time range at appropriate resolution.
 */
export interface ViewportQuery {
  /** Start timestamp (inclusive). */
  start: number
  /** End timestamp (inclusive). */
  end: number
  /** Target pixel width of the output (used for LOD level selection). */
  targetPixels: number
  /** Which column keys to include (default: all). */
  columns?: string[]
}

/**
 * Result of a viewport query — decimated data at the appropriate LOD level.
 */
export interface ViewportResult {
  /** Decimated timestamps. */
  timestamps: Float64Array
  /** Decimated values per column (matches query columns). */
  columns: Record<string, Float64Array>
  /** Decimated quality flags per column (matches returned timestamps when available). */
  quality?: Record<string, Uint8Array>
  /** LOD level used (0 = raw, higher = more decimated). */
  lodLevel: number
  /** Total point count in this range at LOD 0 (raw). */
  rawPointCount: number
  /** Actual point count returned (after decimation). */
  returnedPointCount: number
  /** Indices of detected gaps in the returned data. */
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

// ── Validation ───────────────────────────────────────────────

export interface ValidationIssue {
  type:
    | 'not-ascending'
    | 'duplicate-timestamp'
    | 'nan-value'
    | 'nan-timestamp'
    | 'length-mismatch'
    | 'quality-length-mismatch'
  /** Human-readable description. */
  message: string
  /** Index in the data where the issue was detected. */
  index?: number
  /** Column name (for column-specific issues). */
  column?: string
}

/**
 * Validate columnar data for correctness.
 * Returns an empty array when the data is valid.
 */
export function validateColumnar(data: ColumnarData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { timestamps, columns } = data
  const n = timestamps.length

  // Check timestamps for NaN
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(timestamps[i])) {
      issues.push({
        type: 'nan-timestamp',
        message: `NaN timestamp at index ${i}`,
        index: i,
      })
    }
  }

  // Check ascending + duplicates
  for (let i = 1; i < n; i++) {
    const prev = timestamps[i - 1] as number
    const curr = timestamps[i] as number
    if (Number.isNaN(prev) || Number.isNaN(curr)) continue

    if (curr < prev) {
      issues.push({
        type: 'not-ascending',
        message: `Timestamps not ascending at index ${i}: ${prev} > ${curr}`,
        index: i,
      })
    } else if (curr === prev) {
      issues.push({
        type: 'duplicate-timestamp',
        message: `Duplicate timestamp at index ${i}: ${curr}`,
        index: i,
      })
    }
  }

  // Check column lengths + NaN values
  for (const [name, col] of Object.entries(columns)) {
    if (col.length !== n) {
      issues.push({
        type: 'length-mismatch',
        message: `Column "${name}" length (${col.length}) does not match timestamps length (${n})`,
        column: name,
      })
    }
    for (let i = 0; i < col.length; i++) {
      if (Number.isNaN(col[i])) {
        issues.push({
          type: 'nan-value',
          message: `NaN value in column "${name}" at index ${i}`,
          index: i,
          column: name,
        })
      }
    }
  }

  // Check quality lengths.
  for (const [name, quality] of Object.entries(data.quality ?? {})) {
    if (quality.length !== n) {
      issues.push({
        type: 'quality-length-mismatch',
        message: `Quality column "${name}" length (${quality.length}) does not match timestamps length (${n})`,
        column: name,
      })
    }
  }

  return issues
}

// ── Conversion ───────────────────────────────────────────────

const BYTES_PER_TYPE: Record<string, number> = {
  float32: 4,
  float64: 8,
  int32: 4,
  uint32: 4,
}

/**
 * Convert common data formats to the columnar ColumnarData format.
 *
 * Supported inputs:
 * - `ColumnarData` — passed through as-is.
 * - `{ timestamp, ...values }[]` — row-oriented JSON array.
 * - `ArrayBuffer` — raw binary with `schema`.
 * - `Float64Array` — single-column shorthand (generates sequential integer timestamps).
 */
export function toColumnar(input: DataInput, schema?: BinarySchema): ColumnarData {
  // Pass-through for ColumnarData
  if (isColumnarData(input)) {
    return input
  }

  // Row-oriented JSON array
  if (Array.isArray(input)) {
    return rowsToColumnar(input)
  }

  // Raw binary ArrayBuffer
  if (input instanceof ArrayBuffer) {
    if (!schema) {
      throw new Error('BinarySchema is required when converting ArrayBuffer to ColumnarData')
    }
    return bufferToColumnar(input, schema)
  }

  // Float64Array single-column shorthand
  if (input instanceof Float64Array) {
    return float64ToColumnar(input)
  }

  throw new Error('Unsupported DataInput format')
}

// ── Internal helpers ─────────────────────────────────────────

function isColumnarData(input: DataInput): input is ColumnarData {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    !(input instanceof ArrayBuffer) &&
    !(input instanceof Float64Array) &&
    'timestamps' in input &&
    'columns' in input &&
    input.timestamps instanceof Float64Array
  )
}

function rowsToColumnar(rows: { timestamp: number; [key: string]: number }[]): ColumnarData {
  const n = rows.length
  if (n === 0) {
    return { timestamps: new Float64Array(0), columns: {} }
  }

  // Discover column names from first row (excluding 'timestamp')
  const firstRow = rows[0] as { timestamp: number; [key: string]: number }
  const columnNames = Object.keys(firstRow).filter((k) => k !== 'timestamp')

  const timestamps = new Float64Array(n)
  const columns: Record<string, Float64Array> = {}
  for (const name of columnNames) {
    columns[name] = new Float64Array(n)
  }

  for (let i = 0; i < n; i++) {
    const row = rows[i] as { timestamp: number; [key: string]: number }
    timestamps[i] = row.timestamp
    for (const name of columnNames) {
      const col = columns[name] as Float64Array
      col[i] = row[name] ?? 0
    }
  }

  return { timestamps, columns }
}

function bufferToColumnar(buffer: ArrayBuffer, schema: BinarySchema): ColumnarData {
  if (schema.columns.length === 0) {
    throw new Error('BinarySchema must define at least one column (timestamp)')
  }

  const types = schema.types ?? schema.columns.map(() => 'float64' as const)
  if (types.length !== schema.columns.length) {
    throw new Error(
      `BinarySchema types length (${types.length}) must match columns length (${schema.columns.length})`,
    )
  }

  const littleEndian = schema.littleEndian ?? true
  const rowSize = types.reduce((sum, t) => sum + (BYTES_PER_TYPE[t] ?? 8), 0)
  const rowCount = Math.floor(buffer.byteLength / rowSize)

  if (rowCount === 0) {
    return { timestamps: new Float64Array(0), columns: {} }
  }

  const view = new DataView(buffer)
  const timestamps = new Float64Array(rowCount)
  const columns: Record<string, Float64Array> = {}

  // First column is always the timestamp
  const valueColumnNames = schema.columns.slice(1)
  for (const name of valueColumnNames) {
    columns[name] = new Float64Array(rowCount)
  }

  for (let row = 0; row < rowCount; row++) {
    let offset = row * rowSize

    // Read timestamp (first column)
    timestamps[row] = readTypedValue(view, offset, types[0] as string, littleEndian)
    offset += BYTES_PER_TYPE[types[0] as string] ?? 8

    // Read value columns
    for (let col = 0; col < valueColumnNames.length; col++) {
      const colType = types[col + 1] as string
      const colName = valueColumnNames[col] as string
      const colArr = columns[colName] as Float64Array
      colArr[row] = readTypedValue(view, offset, colType, littleEndian)
      offset += BYTES_PER_TYPE[colType] ?? 8
    }
  }

  return { timestamps, columns }
}

function readTypedValue(
  view: DataView,
  offset: number,
  type: string,
  littleEndian: boolean,
): number {
  switch (type) {
    case 'float32':
      return view.getFloat32(offset, littleEndian)
    case 'float64':
      return view.getFloat64(offset, littleEndian)
    case 'int32':
      return view.getInt32(offset, littleEndian)
    case 'uint32':
      return view.getUint32(offset, littleEndian)
    default:
      return view.getFloat64(offset, littleEndian)
  }
}

function float64ToColumnar(values: Float64Array): ColumnarData {
  const n = values.length
  const timestamps = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    timestamps[i] = i
  }
  return {
    timestamps,
    columns: { value: values },
  }
}

// ── Conversion: ColumnarData → DataEngine (BigInt64Array) ────

/**
 * Time unit multipliers to convert to nanoseconds (BigInt).
 * The existing DataEngine uses BigInt64Array timestamps in nanoseconds.
 */
const TIME_UNIT_TO_NS: Record<string, bigint> = {
  ms: 1_000_000n,
  us: 1_000n,
  ns: 1n,
}

/**
 * Convert ColumnarData timestamps to the BigInt64Array nanosecond format
 * required by the existing DataEngine / LodPyramid.
 */
export function toBigIntTimestamps(
  timestamps: Float64Array,
  timeUnit: 'ms' | 'us' | 'ns' = 'ms',
): BigInt64Array {
  const multiplier = TIME_UNIT_TO_NS[timeUnit] ?? 1_000_000n
  const result = new BigInt64Array(timestamps.length)
  for (let i = 0; i < timestamps.length; i++) {
    result[i] = BigInt(Math.round(timestamps[i] as number)) * multiplier
  }
  return result
}
