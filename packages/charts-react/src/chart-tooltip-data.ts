import {
  DEFAULT_CHART_COLORS,
  findNearestTimestampIndex,
  type NearestTimestampResult,
  type RgbaColor,
  TimeSeriesSampleKind,
} from '@pitant/charts'
import type {
  ChartTooltipPayload,
  ChartTooltipProvenance,
  ChartTooltipSeries,
} from './chart-tooltip.js'

export interface ColumnarTooltipProvenanceColumn {
  labels: readonly string[]
  codes: Uint8Array | Uint16Array | Uint32Array
}

export type ColumnarTooltipProvenanceValue = string | ChartTooltipProvenance

export type ColumnarTooltipProvenanceField =
  | ColumnarTooltipProvenanceValue
  | readonly (ColumnarTooltipProvenanceValue | null | undefined)[]
  | ColumnarTooltipProvenanceColumn

export type ColumnarTooltipProvenanceMap = Record<string, ColumnarTooltipProvenanceField>

export interface SeriesHoverIndexContext {
  seriesKey: string
  field: string
  /** Cursor position in the same time units as timestamps. */
  timestamp: number
  timestamps: Float64Array
  values: Float64Array | undefined
  quality: Uint8Array | undefined
  sampleKinds: Uint8Array | undefined
  nearestIndex: number | null
}

/** Return null for an empty reading or undefined to use the nearest reading. */
export type SeriesHoverIndex =
  | 'nearest'
  | 'previous'
  | 'next'
  | 'exact'
  | ((context: SeriesHoverIndexContext) => number | null | undefined)

export interface ColumnarTooltipSeriesConfig {
  key: string
  label: string
  field: string
  color?: string
  rgba?: RgbaColor
  visible?: boolean
  stateLabels?: Record<number, string>
  formatValue?: (value: number) => string
  hoverIndex?: SeriesHoverIndex
}

export interface ColumnarTooltipData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
  sampleKinds?: Record<string, Uint8Array>
  seriesTimestamps?: Record<string, Float64Array>
  provenance?: ColumnarTooltipProvenanceMap
  gaps?: ReadonlyArray<{ startIndex: number; endIndex: number }>
}

export interface ColumnarTooltipOptions {
  data: ColumnarTooltipData
  series: readonly ColumnarTooltipSeriesConfig[]
  timestamp: number
  formatX?: ((value: number) => string) | undefined
  formatY?: ((value: number) => string) | undefined
}

const QUALITY_LABELS = [
  'good',
  'uncertain',
  'bad',
  'stale',
  'substituted',
  'manual',
  'calculated',
  'clipped',
  'saturated',
  'out of service',
  'communication failed',
  'stripped',
  'unknown',
] as const

export function buildColumnarTooltipPayload({
  data,
  formatX,
  formatY,
  series,
  timestamp,
}: ColumnarTooltipOptions): ChartTooltipPayload | null {
  const nearest = findNearestColumnarTimestamp(data, timestamp)
  if (!nearest) return null

  const gap = isIndexInGap(nearest.index, data.gaps)
  const rows: ChartTooltipSeries[] = []
  for (let index = 0; index < series.length; index++) {
    const item = series[index]
    if (!item || item.visible === false) continue

    const facetTimeline = data.seriesTimestamps?.[item.field]
    const timeline = facetTimeline ?? data.timestamps
    const values = data.columns[item.field]
    const qualityFlags = data.quality?.[item.field]
    const sampleKinds = data.sampleKinds?.[item.field]
    const nearestIndex = facetTimeline
      ? (findNearestTimestampIndex(facetTimeline, timestamp)?.index ?? null)
      : timeline.length > 0
        ? nearest.index
        : null
    const indexInSeries =
      item.hoverIndex && item.hoverIndex !== 'nearest'
        ? selectHoverIndex(item.hoverIndex, {
            seriesKey: item.key,
            field: item.field,
            timestamp,
            timestamps: timeline,
            values,
            quality: qualityFlags,
            sampleKinds,
            nearestIndex,
          })
        : nearestIndex
    const sampleKind = indexInSeries === null ? undefined : sampleKinds?.[indexInSeries]
    const rawValue = indexInSeries === null ? undefined : values?.[indexInSeries]
    const value =
      (sampleKind === undefined || sampleKind === TimeSeriesSampleKind.Observed) &&
      Number.isFinite(rawValue)
        ? (rawValue as number)
        : null
    const quality = indexInSeries === null ? null : (qualityFlags?.[indexInSeries] ?? null)
    const provenance =
      indexInSeries === null
        ? null
        : provenanceForIndex(data.provenance?.[item.field], indexInSeries)
    const row: ChartTooltipSeries = {
      key: item.key,
      label: item.label,
      color:
        item.color ??
        rgbaToCss(
          item.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
        ),
      value,
      formatted: formatTooltipValue(value, item.formatValue ?? formatY, item.stateLabels),
    }
    if (quality !== null) {
      row.quality = quality
      row.qualityLabel = qualityLabel(quality)
    }
    if (provenance) row.provenance = provenance
    if (indexInSeries !== null) {
      const sampleTimestamp = timeline[indexInSeries]
      if (
        (facetTimeline !== undefined || item.hoverIndex !== undefined) &&
        sampleTimestamp !== undefined
      ) {
        row.sampleTimestamp = sampleTimestamp
      }
      const seriesGap =
        facetTimeline === undefined &&
        (indexInSeries === nearest.index ? gap : isIndexInGap(indexInSeries, data.gaps))
      if (seriesGap || sampleKind === TimeSeriesSampleKind.ExplicitGap) row.gap = true
    }
    rows.push(row)
  }

  if (rows.length === 0) return null

  return {
    timestamp: nearest.timestamp,
    label: formatX?.(nearest.timestamp) ?? formatNumber(nearest.timestamp),
    series: rows,
  }
}

function selectHoverIndex(
  policy: SeriesHoverIndex,
  context: SeriesHoverIndexContext,
): number | null {
  const { nearestIndex, timestamp, timestamps } = context
  let index = nearestIndex
  if (typeof policy === 'function') {
    const selected = policy(context)
    if (selected !== undefined) index = selected
  } else if (nearestIndex !== null) {
    const nearestTimestamp = timestamps[nearestIndex] as number
    if (policy === 'previous' && nearestTimestamp > timestamp) index = nearestIndex - 1
    if (policy === 'next' && nearestTimestamp < timestamp) index = nearestIndex + 1
    if (policy === 'exact' && nearestTimestamp !== timestamp) index = null
  }
  return index !== null && Number.isInteger(index) && index >= 0 && index < timestamps.length
    ? index
    : null
}

export function findNearestColumnarTimestamp(
  data: ColumnarTooltipData,
  target: number,
): NearestTimestampResult | null {
  let nearest = findNearestTimestampIndex(data.timestamps, target)
  if (nearest) return nearest
  for (const timeline of Object.values(data.seriesTimestamps ?? {})) {
    const candidate = findNearestTimestampIndex(timeline, target)
    if (candidate && (!nearest || candidate.distance < nearest.distance)) nearest = candidate
  }
  return nearest
}

function formatTooltipValue(
  value: number | null,
  formatY: ((value: number) => string) | undefined,
  stateLabels: Record<number, string> | undefined,
): string {
  if (value === null) return '\u2014'
  const stateLabel = stateLabels?.[value]
  if (stateLabel !== undefined) return stateLabel
  return formatY?.(value) ?? formatNumber(value)
}

function isIndexInGap(
  index: number,
  gaps: ReadonlyArray<{ startIndex: number; endIndex: number }> | undefined,
): boolean {
  if (!gaps || gaps.length === 0) return false
  return gaps.some((gap) => index >= gap.startIndex && index <= gap.endIndex)
}

function qualityLabel(quality: number): string {
  return QUALITY_LABELS[quality] ?? `q${quality}`
}

function provenanceForIndex(
  field: ColumnarTooltipProvenanceField | undefined,
  index: number,
): ChartTooltipProvenance | null {
  if (field === undefined) return null
  if (typeof field === 'string') return { label: field }
  if (isTooltipProvenance(field)) return field
  if (isCodedProvenanceColumn(field)) {
    const code = field.codes[index]
    if (code === undefined) return null
    const label = field.labels[code]
    return label ? { label } : null
  }

  const value = field[index]
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? { label: value } : value
}

function isTooltipProvenance(value: unknown): value is ChartTooltipProvenance {
  return typeof value === 'object' && value !== null && 'label' in value
}

function isCodedProvenanceColumn(value: unknown): value is ColumnarTooltipProvenanceColumn {
  return (
    typeof value === 'object' &&
    value !== null &&
    'labels' in value &&
    'codes' in value &&
    isSupportedProvenanceCodes((value as { codes: unknown }).codes)
  )
}

function isSupportedProvenanceCodes(
  value: unknown,
): value is Uint8Array | Uint16Array | Uint32Array {
  return value instanceof Uint8Array || value instanceof Uint16Array || value instanceof Uint32Array
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (Number.isInteger(value)) return String(value)
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

function rgbaToCss(color: RgbaColor): string {
  const r = Math.round(color[0] * 255)
  const g = Math.round(color[1] * 255)
  const b = Math.round(color[2] * 255)
  return `rgba(${r}, ${g}, ${b}, ${color[3]})`
}
