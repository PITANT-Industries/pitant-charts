'use client'

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react'

// ── Public types ─────────────────────────────────────────────

export interface ChartTooltipSeries {
  key: string
  label: string
  color: string
  value: number | null
  formatted: string
}

export interface ChartTooltipPayload {
  /** Timestamp of the data point (for X axis label) */
  timestamp: number
  /** Formatted X-axis label */
  label: string
  /** Series values at this timestamp */
  series: ChartTooltipSeries[]
}

export interface ChartTooltipProps {
  /** Tooltip payload — null when not hovering */
  payload: ChartTooltipPayload | null
  /** Screen-space position where tooltip should appear (relative to container) */
  position: { x: number; y: number } | null
  /** Custom content renderer */
  children?: (payload: ChartTooltipPayload) => ReactNode
  className?: string
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

function DefaultTooltipContent({ payload }: { payload: ChartTooltipPayload }) {
  return (
    <>
      <div style={headerStyle}>{payload.label}</div>
      {payload.series.map((s) => (
        <div key={s.key} style={rowStyle}>
          <span style={labelGroupStyle}>
            <span style={{ ...swatchStyle, backgroundColor: s.color }} aria-hidden />
            <span style={seriesLabelStyle}>{s.label}</span>
          </span>
          <span style={valueStyle}>{s.value !== null ? s.formatted : '\u2014'}</span>
        </div>
      ))}
    </>
  )
}

// ── Component ────────────────────────────────────────────────

export function ChartTooltip({ payload, position, children, className }: ChartTooltipProps) {
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
  }, [position])

  if (!payload || !position) return null

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
      {children ? children(payload) : <DefaultTooltipContent payload={payload} />}
    </div>
  )
}

ChartTooltip.displayName = 'ChartTooltip'
