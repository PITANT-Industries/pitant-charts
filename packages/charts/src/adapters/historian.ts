import type { TimeSeriesSeries } from '../charts/time-series.js'
import type { ColumnarData } from '../data-engine/columnar.js'

export type HistorianQualityClass =
  | 'good'
  | 'uncertain'
  | 'bad'
  | 'stale'
  | 'substituted'
  | 'manual'
  | 'calculated'
  | 'clipped'
  | 'saturated'
  | 'out_of_service'
  | 'communication_failed'
  | 'stripped'
  | 'unknown'

export const HISTORIAN_QUALITY_CODE: Record<HistorianQualityClass, number> = {
  good: 0,
  uncertain: 1,
  bad: 2,
  stale: 3,
  substituted: 4,
  manual: 5,
  calculated: 6,
  clipped: 7,
  saturated: 8,
  out_of_service: 9,
  communication_failed: 10,
  stripped: 11,
  unknown: 12,
} as const

export interface HistorianObservationRow {
  kind: 'observation'
  tag_id: string
  value: number
  timestamp: string
  quality?: string
  normalized_quality?: string
  quality_class?: string
  engineering_unit?: string
}

export interface HistorianGapRow {
  kind: 'gap'
  start: string
  end: string
  reason?: string
  acknowledged?: boolean
}

export type HistorianQueryRow = HistorianObservationRow | HistorianGapRow

export interface HistorianQueryResponse {
  rows: readonly HistorianQueryRow[]
  next_cursor?: string | null
}

export interface HistorianTrendFixture {
  responses?: {
    'GET /query'?: HistorianQueryResponse
  }
}

export interface HistorianSeriesOption {
  tagId: string
  key?: string
  label?: string
  field?: string
  color?: TimeSeriesSeries['color']
  lineWidth?: number
}

export interface HistorianChartData extends ColumnarData {
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface HistorianTimeSeriesAdapterResult {
  data: HistorianChartData
  series: TimeSeriesSeries[]
  units: Record<string, string>
  nextCursor?: string | null
  warnings: readonly string[]
}

export interface HistorianAdapterOptions {
  series?: readonly HistorianSeriesOption[]
  includeUnknownTags?: boolean
}

interface ObservationRecord {
  tagId: string
  field: string
  timestamp: number
  value: number
  qualityCode: number
  unit?: string
}

export function historianTrendFixtureToTimeSeries(
  fixture: HistorianTrendFixture,
  options: HistorianAdapterOptions = {},
): HistorianTimeSeriesAdapterResult {
  return historianQueryToTimeSeries(fixture.responses?.['GET /query'] ?? { rows: [] }, options)
}

export function historianQueryToTimeSeries(
  response: HistorianQueryResponse,
  options: HistorianAdapterOptions = {},
): HistorianTimeSeriesAdapterResult {
  const warnings: string[] = []
  const configuredSeries = options.series ?? []
  const observedTagOrder: string[] = []
  const fieldByTag = new Map<string, string>()
  const unitByField: Record<string, string> = {}

  for (const series of configuredSeries) {
    fieldByTag.set(series.tagId, series.field ?? series.key ?? series.tagId)
  }

  const observations: ObservationRecord[] = []
  const gapRows: HistorianGapRow[] = []

  for (const row of response.rows) {
    if (row.kind === 'gap') {
      gapRows.push(row)
      continue
    }

    const timestamp = Date.parse(row.timestamp)
    if (!Number.isFinite(timestamp)) {
      warnings.push(`Observation for "${row.tag_id}" skipped because timestamp is invalid.`)
      continue
    }
    if (!Number.isFinite(row.value)) {
      warnings.push(`Observation for "${row.tag_id}" skipped because value is not finite.`)
      continue
    }

    if (!fieldByTag.has(row.tag_id)) {
      if (configuredSeries.length > 0 && options.includeUnknownTags !== true) {
        continue
      }
      observedTagOrder.push(row.tag_id)
      fieldByTag.set(row.tag_id, row.tag_id)
    }

    const field = fieldByTag.get(row.tag_id)
    if (!field) continue
    if (row.engineering_unit) {
      unitByField[field] = row.engineering_unit
    }

    observations.push({
      tagId: row.tag_id,
      field,
      timestamp,
      value: row.value,
      qualityCode: qualityCodeForHistorianRow(row),
      ...(row.engineering_unit ? { unit: row.engineering_unit } : {}),
    })
  }

  const series = buildSeries(configuredSeries, observedTagOrder, fieldByTag, unitByField)
  const data = buildColumnarData(observations, series, gapRows, warnings)

  const result: HistorianTimeSeriesAdapterResult = {
    data,
    series,
    units: unitByField,
    warnings,
  }
  if (response.next_cursor !== undefined) {
    result.nextCursor = response.next_cursor
  }
  return result
}

export function qualityCodeForHistorianRow(row: HistorianObservationRow): number {
  const normalized = normalizeQualityClass(
    row.quality_class ?? row.normalized_quality ?? row.quality,
  )
  return HISTORIAN_QUALITY_CODE[normalized]
}

export function normalizeQualityClass(value: string | undefined): HistorianQualityClass {
  const normalized = (value ?? '').trim().toLowerCase().replaceAll('-', '_')
  if (!normalized) return 'unknown'
  if (normalized.includes('communication') || normalized.includes('comm_loss')) {
    return 'communication_failed'
  }
  if (normalized.includes('out_of_service')) return 'out_of_service'
  if (normalized.includes('last_usable') || normalized.includes('uncertain')) return 'uncertain'
  if (normalized.includes('substituted')) return 'substituted'
  if (normalized.includes('calculated')) return 'calculated'
  if (normalized.includes('manual')) return 'manual'
  if (normalized.includes('clipped')) return 'clipped'
  if (normalized.includes('saturated')) return 'saturated'
  if (normalized.includes('stale')) return 'stale'
  if (normalized.includes('stripped')) return 'stripped'
  if (normalized.includes('bad')) return 'bad'
  if (normalized.includes('good')) return 'good'
  return 'unknown'
}

function buildSeries(
  configuredSeries: readonly HistorianSeriesOption[],
  observedTagOrder: readonly string[],
  fieldByTag: ReadonlyMap<string, string>,
  unitByField: Record<string, string>,
): TimeSeriesSeries[] {
  const series: TimeSeriesSeries[] = []

  for (const item of configuredSeries) {
    const field = fieldByTag.get(item.tagId) ?? item.field ?? item.key ?? item.tagId
    series.push({
      key: item.key ?? item.tagId,
      label: item.label ?? labelForTag(item.tagId, unitByField[field]),
      field,
      ...(item.color ? { color: item.color } : {}),
      ...(item.lineWidth !== undefined ? { lineWidth: item.lineWidth } : {}),
    })
  }

  for (const tagId of observedTagOrder) {
    if (configuredSeries.some((item) => item.tagId === tagId)) continue
    const field = fieldByTag.get(tagId) ?? tagId
    series.push({
      key: tagId,
      label: labelForTag(tagId, unitByField[field]),
      field,
    })
  }

  return series
}

function buildColumnarData(
  observations: readonly ObservationRecord[],
  series: readonly TimeSeriesSeries[],
  gapRows: readonly HistorianGapRow[],
  warnings: string[],
): HistorianChartData {
  const sorted = observations.slice().sort((a, b) => a.timestamp - b.timestamp)
  const timestamps = uniqueSortedTimestamps(sorted)
  const indexByTimestamp = new Map<number, number>()
  for (let i = 0; i < timestamps.length; i++) {
    indexByTimestamp.set(timestamps[i] as number, i)
  }

  const columns: Record<string, Float64Array> = {}
  const quality: Record<string, Uint8Array> = {}
  for (const item of series) {
    const values = new Float64Array(timestamps.length)
    values.fill(Number.NaN)
    columns[item.field] = values
    quality[item.field] = filledQuality(timestamps.length, HISTORIAN_QUALITY_CODE.unknown)
  }

  for (const row of sorted) {
    const index = indexByTimestamp.get(row.timestamp)
    const values = columns[row.field]
    const qualityColumn = quality[row.field]
    if (index === undefined || !values || !qualityColumn) continue
    if (Number.isFinite(values[index])) {
      warnings.push(
        `Duplicate historian observation for "${row.tagId}" at ${new Date(row.timestamp).toISOString()} overwrote an earlier value.`,
      )
    }
    values[index] = row.value
    qualityColumn[index] = row.qualityCode
  }

  return {
    timestamps,
    columns,
    quality,
    gaps: mapGapRows(gapRows, timestamps, warnings),
    timeUnit: 'ms',
  }
}

function uniqueSortedTimestamps(rows: readonly ObservationRecord[]): Float64Array {
  const values: number[] = []
  let previous: number | undefined
  for (const row of rows) {
    if (row.timestamp === previous) continue
    values.push(row.timestamp)
    previous = row.timestamp
  }
  return Float64Array.from(values)
}

function mapGapRows(
  rows: readonly HistorianGapRow[],
  timestamps: Float64Array,
  warnings: string[],
): ReadonlyArray<{ startIndex: number; endIndex: number }> {
  const gaps: { startIndex: number; endIndex: number }[] = []
  if (timestamps.length === 0) {
    if (rows.length > 0)
      warnings.push('Historian gaps were present, but no observations anchored them.')
    return gaps
  }

  for (const row of rows) {
    const start = Date.parse(row.start)
    const end = Date.parse(row.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      warnings.push('Historian gap skipped because start or end timestamp is invalid.')
      continue
    }
    const startIndex = lowerBound(timestamps, start)
    const endIndex = Math.max(startIndex, lowerBound(timestamps, end))
    gaps.push({
      startIndex: Math.min(startIndex, timestamps.length - 1),
      endIndex: Math.min(endIndex, timestamps.length - 1),
    })
  }

  return gaps
}

function lowerBound(values: Float64Array, target: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((values[mid] as number) < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function filledQuality(length: number, value: number): Uint8Array {
  const quality = new Uint8Array(length)
  quality.fill(value)
  return quality
}

function labelForTag(tagId: string, unit: string | undefined): string {
  return unit ? `${tagId} (${unit})` : tagId
}
