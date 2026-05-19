export type TimeSeriesDerivedColumnKind =
  | 'scale-offset'
  | 'delta'
  | 'rate-of-change'
  | 'moving-average'

export interface TimeSeriesDerivedColumn {
  kind: TimeSeriesDerivedColumnKind
  sourceField: string
  field: string
  windowSize?: number
  minimumSamples?: number
  per?: number
  scale?: number
  offset?: number
}

export interface TimeSeriesDerivedColumnData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
}

export interface AddTimeSeriesDerivedColumnsOptions {
  previousData?: TimeSeriesDerivedColumnData
  calculatedQualityCode?: number
}

export type TimeSeriesDerivedColumnResult<TData extends TimeSeriesDerivedColumnData> = Omit<
  TData,
  'columns' | 'quality'
> & {
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
}

const DEFAULT_CALCULATED_QUALITY_CODE = 6
const MAX_MOVING_AVERAGE_WINDOW = 1_000_000

export function addTimeSeriesDerivedColumns<TData extends TimeSeriesDerivedColumnData>(
  data: TData,
  derivedColumns: readonly TimeSeriesDerivedColumn[] = [],
  options: AddTimeSeriesDerivedColumnsOptions = {},
): TimeSeriesDerivedColumnResult<TData> {
  if (derivedColumns.length === 0) return data as TimeSeriesDerivedColumnResult<TData>

  const columns: Record<string, Float64Array> = { ...data.columns }
  let quality: Record<string, Uint8Array> | undefined = data.quality
    ? { ...data.quality }
    : undefined
  const calculatedQualityCode = options.calculatedQualityCode ?? DEFAULT_CALCULATED_QUALITY_CODE

  for (const derived of derivedColumns) {
    const source = data.columns[derived.sourceField]
    const output = buildDerivedColumn(data.timestamps, source, derived, options.previousData)
    columns[derived.field] = output
    quality = {
      ...(quality ?? {}),
      [derived.field]: buildDerivedQuality(
        data.timestamps.length,
        data.quality?.[derived.sourceField],
        calculatedQualityCode,
      ),
    }
  }

  const result: TimeSeriesDerivedColumnResult<TData> = {
    ...data,
    columns,
  }
  if (quality !== undefined) result.quality = quality
  return result
}

function buildDerivedColumn(
  timestamps: Float64Array,
  source: Float64Array | undefined,
  derived: TimeSeriesDerivedColumn,
  previousData: TimeSeriesDerivedColumnData | undefined,
): Float64Array {
  const output = filledNaN(timestamps.length)
  if (!source) return output

  if (derived.kind === 'scale-offset') {
    buildScaleOffset(source, output, derived)
  } else if (derived.kind === 'delta') {
    buildDelta(timestamps, source, output, derived, previousData)
  } else if (derived.kind === 'rate-of-change') {
    buildRateOfChange(timestamps, source, output, derived, previousData)
  } else {
    buildMovingAverage(source, output, derived, previousData)
  }

  return output
}

function buildScaleOffset(
  source: Float64Array,
  output: Float64Array,
  derived: TimeSeriesDerivedColumn,
) {
  const scale = derived.scale ?? 1
  const offset = derived.offset ?? 0
  const pointCount = Math.min(source.length, output.length)
  for (let i = 0; i < pointCount; i++) {
    const value = source[i]
    output[i] = isFiniteNumber(value) ? (value as number) * scale + offset : Number.NaN
  }
}

function buildDelta(
  timestamps: Float64Array,
  source: Float64Array,
  output: Float64Array,
  derived: TimeSeriesDerivedColumn,
  previousData: TimeSeriesDerivedColumnData | undefined,
) {
  const previousSource = previousData?.columns[derived.sourceField]
  let previousValue = previousSource?.[previousSource.length - 1]
  const scale = derived.scale ?? 1
  const offset = derived.offset ?? 0
  const pointCount = Math.min(timestamps.length, source.length)

  for (let i = 0; i < pointCount; i++) {
    const value = source[i]
    output[i] =
      isFiniteNumber(value) && isFiniteNumber(previousValue)
        ? ((value as number) - (previousValue as number)) * scale + offset
        : Number.NaN
    previousValue = value
  }
}

function buildRateOfChange(
  timestamps: Float64Array,
  source: Float64Array,
  output: Float64Array,
  derived: TimeSeriesDerivedColumn,
  previousData: TimeSeriesDerivedColumnData | undefined,
) {
  const previousSource = previousData?.columns[derived.sourceField]
  const previousTimestamps = previousData?.timestamps
  let previousValue = previousSource?.[previousSource.length - 1]
  let previousTimestamp = previousTimestamps?.[previousTimestamps.length - 1]
  const per = derived.per ?? 1
  const scale = derived.scale ?? 1
  const offset = derived.offset ?? 0
  const pointCount = Math.min(timestamps.length, source.length)

  for (let i = 0; i < pointCount; i++) {
    const value = source[i]
    const timestamp = timestamps[i]
    const deltaTime =
      isFiniteNumber(timestamp) && isFiniteNumber(previousTimestamp)
        ? (timestamp as number) - (previousTimestamp as number)
        : Number.NaN
    output[i] =
      isFiniteNumber(value) &&
      isFiniteNumber(previousValue) &&
      isFiniteNumber(deltaTime) &&
      (deltaTime as number) > 0
        ? (((value as number) - (previousValue as number)) / (deltaTime as number)) * per * scale +
          offset
        : Number.NaN
    previousValue = value
    previousTimestamp = timestamp
  }
}

function buildMovingAverage(
  source: Float64Array,
  output: Float64Array,
  derived: TimeSeriesDerivedColumn,
  previousData: TimeSeriesDerivedColumnData | undefined,
) {
  const windowSize = boundedInteger(derived.windowSize ?? 5, 1, MAX_MOVING_AVERAGE_WINDOW)
  const minimumSamples = boundedInteger(derived.minimumSamples ?? windowSize, 1, windowSize)
  const scale = derived.scale ?? 1
  const offset = derived.offset ?? 0
  const rolling = new RollingFiniteWindow(windowSize)
  const previousSource = previousData?.columns[derived.sourceField]

  if (previousSource) {
    const start = Math.max(0, previousSource.length - (windowSize - 1))
    for (let i = start; i < previousSource.length; i++) {
      rolling.push(previousSource[i])
    }
  }

  const pointCount = Math.min(source.length, output.length)
  for (let i = 0; i < pointCount; i++) {
    rolling.push(source[i])
    output[i] = rolling.finiteCount >= minimumSamples ? rolling.mean * scale + offset : Number.NaN
  }
}

class RollingFiniteWindow {
  private readonly values: Float64Array
  private readonly finite: Uint8Array
  private cursor = 0
  private size = 0
  private sum = 0
  finiteCount = 0

  constructor(private readonly capacity: number) {
    this.values = new Float64Array(capacity)
    this.finite = new Uint8Array(capacity)
  }

  get mean(): number {
    return this.finiteCount > 0 ? this.sum / this.finiteCount : Number.NaN
  }

  push(value: number | undefined): void {
    if (this.size === this.capacity) {
      if (this.finite[this.cursor] === 1) {
        this.sum -= this.values[this.cursor] as number
        this.finiteCount -= 1
      }
    } else {
      this.size += 1
    }

    if (isFiniteNumber(value)) {
      this.values[this.cursor] = value as number
      this.finite[this.cursor] = 1
      this.sum += value as number
      this.finiteCount += 1
    } else {
      this.values[this.cursor] = Number.NaN
      this.finite[this.cursor] = 0
    }

    this.cursor = (this.cursor + 1) % this.capacity
  }
}

function buildDerivedQuality(
  length: number,
  sourceQuality: Uint8Array | undefined,
  calculatedQualityCode: number,
): Uint8Array {
  const output = new Uint8Array(length)
  const calculated = clampQualityCode(calculatedQualityCode)
  for (let i = 0; i < length; i++) {
    const source = sourceQuality?.[i]
    output[i] = source !== undefined && source !== 0 ? source : calculated
  }
  return output
}

function filledNaN(length: number): Float64Array {
  const values = new Float64Array(length)
  values.fill(Number.NaN)
  return values
}

function boundedInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function clampQualityCode(value: number): number {
  return boundedInteger(value, 0, 255)
}

function isFiniteNumber(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}
