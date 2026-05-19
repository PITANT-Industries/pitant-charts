import { DEFAULT_CHART_COLORS, findNearestTimestampIndex, type RgbaColor } from '@pitant/charts'
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

export interface ColumnarTooltipSeriesConfig {
  key: string
  label: string
  field: string
  color?: string
  rgba?: RgbaColor
  visible?: boolean
  stateLabels?: Record<number, string>
}

export interface ColumnarTooltipData {
  timestamps: Float64Array
  columns: Record<string, Float64Array>
  quality?: Record<string, Uint8Array>
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
  const nearest = findNearestTimestampIndex(data.timestamps, timestamp)
  if (!nearest) return null

  const gap = isIndexInGap(nearest.index, data.gaps)
  const rows: ChartTooltipSeries[] = []
  for (let index = 0; index < series.length; index++) {
    const item = series[index]
    if (!item || item.visible === false) continue

    const values = data.columns[item.field]
    const rawValue = values?.[nearest.index]
    const value = Number.isFinite(rawValue) ? (rawValue as number) : null
    const quality = data.quality?.[item.field]?.[nearest.index] ?? null
    const provenance = provenanceForIndex(data.provenance?.[item.field], nearest.index)
    const row: ChartTooltipSeries = {
      key: item.key,
      label: item.label,
      color:
        item.color ??
        rgbaToCss(
          item.rgba ?? (DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] as RgbaColor),
        ),
      value,
      formatted: formatTooltipValue(value, formatY, item.stateLabels),
    }
    if (quality !== null) {
      row.quality = quality
      row.qualityLabel = qualityLabel(quality)
    }
    if (provenance) row.provenance = provenance
    if (gap) row.gap = true
    rows.push(row)
  }

  if (rows.length === 0) return null

  return {
    timestamp: nearest.timestamp,
    label: formatX?.(nearest.timestamp) ?? formatNumber(nearest.timestamp),
    series: rows,
  }
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
