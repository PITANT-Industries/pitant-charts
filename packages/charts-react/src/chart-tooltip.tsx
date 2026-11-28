'use client'

import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { type ChartDisplayItemsOptions, selectChartDisplayItems } from './chart-display-items.js'

// ── Public types ─────────────────────────────────────────────

export interface ChartTooltipSeries {
  key: string
  label: string
  color: string
  value: number | null
  formatted: string
  quality?: number | null
  qualityLabel?: string
  gap?: boolean
  provenance?: ChartTooltipProvenance | null
}

export interface ChartTooltipProvenance {
  label: string
  source?: string
  revision?: string | number
}

export interface ChartTooltipPayload {
  /** Timestamp of the data point (for X axis label) */
  timestamp: number
  /** Formatted X-axis label */
  label: string
  /** Series values at this timestamp */
  series: ChartTooltipSeries[]
}

export type ChartTooltipLayout = 'list' | 'table' | 'inline'

export interface ChartTooltipProps extends ChartDisplayItemsOptions<ChartTooltipSeries> {
  /** Tooltip payload — null when not hovering */
  payload: ChartTooltipPayload | null
  /** Screen-space position where tooltip should appear (relative to container) */
  position: { x: number; y: number } | null
  /** Custom content renderer */
  children?: (payload: ChartTooltipPayload) => ReactNode
  className?: string
  layout?: ChartTooltipLayout
}

// ── Styles ───────────────────────────────────────────────────

const tooltipOuter: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  minWidth: '8rem',
  pointerEvents: 'none',
  background: 'var(--chart-tooltip-background, #fff)',
  color: 'var(--chart-tooltip-foreground, #09090b)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--chart-tooltip-border, #e4e4e7)',
  borderRadius: 'var(--chart-tooltip-radius, 0.375rem)',
  boxShadow:
    'var(--chart-tooltip-shadow, 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1))',
  fontFamily: 'var(--chart-font-family, inherit)',
  fontSize: 'var(--chart-font-size-sm, 0.875rem)',
  padding: '0.5rem 0.75rem',
}

const headerStyle: CSSProperties = {
  fontWeight: 500,
  marginBottom: '0.25rem',
  fontSize: 'var(--chart-font-size-sm, 0.875rem)',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
}

const labelGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
}

const swatchStyle: CSSProperties = {
  display: 'inline-block',
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '9999px',
  flexShrink: 0,
}

const seriesLabelStyle: CSSProperties = {
  color: 'var(--chart-muted-foreground, #71717a)',
}

const valueStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 500,
}

const metadataStyle: CSSProperties = {
  color: 'var(--chart-muted-foreground, #71717a)',
  fontSize: '0.75em',
  marginLeft: '0.375rem',
  whiteSpace: 'nowrap',
}

// ── Positioning ──────────────────────────────────────────────

const OFFSET = 12
const EDGE_PAD = 4

function adjustPosition(
  pos: { x: number; y: number },
  tooltip: DOMRect,
  parent: DOMRect,
): { x: number; y: number } {
  let x = pos.x + OFFSET
  let y = pos.y - OFFSET

  // Flip horizontally if clipped on right
  if (x + tooltip.width > parent.right - parent.left) {
    x = pos.x - tooltip.width - OFFSET
  }
  // Clamp vertically
  if (y + tooltip.height > parent.height) {
    y = parent.height - tooltip.height - EDGE_PAD
  }
  if (y < 0) {
    y = EDGE_PAD
  }

  return { x, y }
}

// ── Default content ──────────────────────────────────────────

function seriesMetadata(series: ChartTooltipSeries): string[] {
  const parts: string[] = []
  if (series.qualityLabel) {
    parts.push(series.qualityLabel)
  } else if (series.quality !== undefined && series.quality !== null) {
    parts.push(`q${series.quality}`)
  }
  if (series.gap === true) parts.push('gap')
  if (series.provenance?.label) {
    parts.push(`provenance: ${series.provenance.label}`)
  }
  return parts
}

function DefaultTooltipContent({
  payload,
  layout,
}: {
  payload: ChartTooltipPayload
  layout: ChartTooltipLayout
}) {
  const table = layout === 'table'
  const inline = layout === 'inline'
  return (
    <>
      <div style={headerStyle}>{payload.label}</div>
      <div
        role={table ? 'table' : undefined}
        style={inline ? { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' } : undefined}
      >
        {payload.series.map((s) => {
          const metadata = seriesMetadata(s)
          return (
            <div key={s.key} role={table ? 'row' : undefined} style={rowStyle}>
              <span role={table ? 'rowheader' : undefined} style={labelGroupStyle}>
                <span style={{ ...swatchStyle, backgroundColor: s.color }} aria-hidden />
                <span style={seriesLabelStyle}>{s.label}</span>
              </span>
              <span role={table ? 'cell' : undefined} style={valueStyle}>
                {s.value !== null ? s.formatted : '\u2014'}
                {metadata.length > 0 ? (
                  <span style={metadataStyle}>{metadata.join(' / ')}</span>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Component ────────────────────────────────────────────────

export function ChartTooltip({
  payload,
  position,
  children,
  className,
  filter,
  sort,
  limit,
  layout = 'list',
}: ChartTooltipProps) {
  const displayPayload = useMemo(() => {
    if (!payload) return null
    const displayed = selectChartDisplayItems(payload.series, {
      ...(filter !== undefined ? { filter } : {}),
      ...(sort !== undefined ? { sort } : {}),
      ...(limit !== undefined ? { limit } : {}),
    })
    if (displayed === payload.series) return payload
    return displayed.length > 0 ? { ...payload, series: [...displayed] } : null
  }, [filter, limit, payload, sort])
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!position || !tooltipRef.current) {
      setAdjusted(null)
      return
    }
    const el = tooltipRef.current
    const rect = el.getBoundingClientRect()
    const parent = el.parentElement?.getBoundingClientRect()
    if (!parent) {
      setAdjusted({ x: position.x + OFFSET, y: position.y - OFFSET })
      return
    }

    setAdjusted(adjustPosition(position, rect, parent))
    // The list can change size while the pointer stays in the same position.
    void displayPayload
    void layout
  }, [displayPayload, layout, position])

  if (!displayPayload || !position) return null

  const pos = adjusted ?? { x: position.x + OFFSET, y: position.y - OFFSET }

  return (
    <div
      ref={tooltipRef}
      className={className}
      style={{
        ...tooltipOuter,
        left: pos.x,
        top: pos.y,
      }}
      role="tooltip"
    >
      {children ? (
        children(displayPayload)
      ) : (
        <DefaultTooltipContent payload={displayPayload} layout={layout} />
      )}
    </div>
  )
}

ChartTooltip.displayName = 'ChartTooltip'
