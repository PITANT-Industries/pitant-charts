import { HISTORIAN_QUALITY_CODE } from '../adapters/historian.js'
import type { ColumnarData } from '../data-engine/columnar.js'

/** How a missing cell should affect the drawn series. */
export const TimeSeriesSampleKind = {
  Observed: 0,
  ExplicitGap: 1,
  AlignmentHole: 2,
} as const

export type TimeSeriesSampleKind = (typeof TimeSeriesSampleKind)[keyof typeof TimeSeriesSampleKind]

/** Preserve explicit gaps, bridge them, or extend them over adjacent alignment holes. */
export type TimeSeriesGapPolicy = 'preserve' | 'bridge' | 'expand'

export interface IndependentTimeSeriesColumn {
  key: string
  /** Finite, strictly increasing times in the same unit as the other columns. */
  timestamps: Float64Array
  /** null or non-finite means an explicit gap. undefined means no reading. */
  values: ArrayLike<number | null | undefined>
  quality?: Uint8Array
  /** Defaults to preserving explicit gaps and bridging alignment holes. */
  gapPolicy?: TimeSeriesGapPolicy
}

export interface AlignedTimeSeriesColumns extends ColumnarData {
  /** Per-field masks that distinguish gaps from alignment holes, both encoded as NaN in columns. */
  sampleKinds: Record<string, Uint8Array>
}

interface TimestampCursor {
  timestamps: Float64Array
  index: number
}

/** Align independently sampled channels onto the sorted union of their timestamps. */
export function alignTimeSeriesColumns(
  series: readonly IndependentTimeSeriesColumn[],
): AlignedTimeSeriesColumns {
  const keys = new Set<string>()
  const grids = new Set<Float64Array>()
  for (const column of series) {
    const { key, timestamps, values, quality } = column
    if (key.length === 0 || keys.has(key)) {
      throw new RangeError(`Expected a unique, nonempty series key: "${key}".`)
    }
    keys.add(key)
    if (values.length !== timestamps.length || (quality && quality.length !== timestamps.length)) {
      throw new RangeError(
        `Series "${key}" requires one value and at most one quality flag per timestamp.`,
      )
    }
    if (!grids.has(timestamps)) {
      validateTimestamps(timestamps, key)
      grids.add(timestamps)
    }
  }

  const timestamps = mergeTimestampGrids(grids)
  const columns = Object.fromEntries(
    series.map(({ key }) => [key, new Float64Array(timestamps.length)]),
  )
  const sampleKinds = Object.fromEntries(
    series.map(({ key }) => [key, new Uint8Array(timestamps.length)]),
  )
  const quality = Object.fromEntries(
    series
      .filter((column) => column.quality !== undefined)
      .map(({ key }) => [
        key,
        new Uint8Array(timestamps.length).fill(HISTORIAN_QUALITY_CODE.unknown),
      ]),
  )

  for (const column of series) {
    const values = columns[column.key] as Float64Array
    const kinds = sampleKinds[column.key] as Uint8Array
    const flags = Object.hasOwn(quality, column.key) ? quality[column.key] : undefined
    values.fill(Number.NaN)
    kinds.fill(TimeSeriesSampleKind.AlignmentHole)

    let alignedIndex = 0
    for (let sourceIndex = 0; sourceIndex < column.timestamps.length; sourceIndex++) {
      const timestamp = column.timestamps[sourceIndex] as number
      while ((timestamps[alignedIndex] as number) < timestamp) alignedIndex++

      const value = column.values[sourceIndex]
      if (typeof value === 'number' && Number.isFinite(value)) {
        values[alignedIndex] = value
        kinds[alignedIndex] = TimeSeriesSampleKind.Observed
      } else if (value !== undefined && column.gapPolicy !== 'bridge') {
        kinds[alignedIndex] = TimeSeriesSampleKind.ExplicitGap
      }
      if (flags && column.quality) flags[alignedIndex] = column.quality[sourceIndex] as number
    }

    if (column.gapPolicy === 'expand') expandGaps(kinds)
  }

  const aligned: AlignedTimeSeriesColumns = { timestamps, columns, sampleKinds }
  if (Object.keys(quality).length > 0) aligned.quality = quality
  return aligned
}

function validateTimestamps(timestamps: Float64Array, key: string): void {
  let previous = Number.NEGATIVE_INFINITY
  for (const timestamp of timestamps) {
    if (!Number.isFinite(timestamp) || timestamp <= previous) {
      throw new RangeError(`Timestamps for series "${key}" must be finite and strictly increasing.`)
    }
    previous = timestamp
  }
}

function mergeTimestampGrids(grids: ReadonlySet<Float64Array>): Float64Array {
  const heap: TimestampCursor[] = []
  let capacity = 0
  for (const timestamps of grids) {
    if (timestamps.length === 0) continue
    heap.push({ timestamps, index: 0 })
    capacity = Math.max(capacity, timestamps.length)
  }
  if (heap.length <= 1) return heap[0]?.timestamps.slice() ?? new Float64Array()

  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index--) siftDown(heap, index)
  let merged = new Float64Array(capacity)
  let length = 0
  while (heap.length > 0) {
    const next = heap[0] as TimestampCursor
    const timestamp = cursorValue(next)
    if (length === 0 || merged[length - 1] !== timestamp) {
      if (length === merged.length) {
        const expanded = new Float64Array(length * 2)
        expanded.set(merged)
        merged = expanded
      }
      merged[length++] = timestamp
    }
    next.index++
    if (next.index === next.timestamps.length) {
      const last = heap.pop() as TimestampCursor
      if (heap.length === 0) break
      heap[0] = last
    }
    siftDown(heap, 0)
  }
  return length === merged.length ? merged : merged.slice(0, length)
}

function cursorValue(cursor: TimestampCursor): number {
  return cursor.timestamps[cursor.index] as number
}

function siftDown(heap: TimestampCursor[], start: number): void {
  let index = start
  const cursor = heap[index] as TimestampCursor
  const value = cursorValue(cursor)
  while (index * 2 + 1 < heap.length) {
    let child = index * 2 + 1
    const right = heap[child + 1]
    if (right && cursorValue(right) < cursorValue(heap[child] as TimestampCursor)) child++
    const candidate = heap[child] as TimestampCursor
    if (value <= cursorValue(candidate)) break
    heap[index] = candidate
    index = child
  }
  heap[index] = cursor
}

function expandGaps(kinds: Uint8Array): void {
  let index = 0
  while (index < kinds.length) {
    if (kinds[index] === TimeSeriesSampleKind.Observed) {
      index++
      continue
    }

    const start = index
    let hasGap = false
    while (index < kinds.length && kinds[index] !== TimeSeriesSampleKind.Observed) {
      if (kinds[index] === TimeSeriesSampleKind.ExplicitGap) hasGap = true
      index++
    }
    if (hasGap) kinds.fill(TimeSeriesSampleKind.ExplicitGap, start, index)
  }
}
