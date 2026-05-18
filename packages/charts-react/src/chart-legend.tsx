'use client'

import type { CSSProperties } from 'react'

// ── Public types ─────────────────────────────────────────────

export interface ChartLegendItem {
  /** Unique series key */
  key: string
  /** Display label */
  label: string
  /** CSS color (resolved from --chart-N) */
  color: string
  /** Whether the series is currently visible */
  visible: boolean
}

export interface ChartLegendProps {
  /** Legend items — one per series. */
  items: ChartLegendItem[]
  /** Called when user toggles a series. */
  onToggle?: (key: string, visible: boolean) => void
  /** Layout direction. @default "horizontal" */
  orientation?: 'horizontal' | 'vertical'
  /** CSS class merged onto the outer wrapper. */
  className?: string
}

// ── Styles ───────────────────────────────────────────────────

const listBase: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--chart-legend-gap, 0.75rem)',
  margin: 0,
  padding: 0,
  listStyleType: 'none',
}

const liStyle: CSSProperties = {
  display: 'contents',
}

const itemBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  transition: 'opacity 150ms',
  color: 'var(--chart-foreground)',
  fontFamily: 'var(--chart-font-family, inherit)',
  fontSize: 'var(--chart-font-size-sm, 0.875rem)',
  lineHeight: 1,
}

const swatchBase: CSSProperties = {
  display: 'inline-block',
  width: '0.625rem',
  height: '0.625rem',
  flexShrink: 0,
  borderRadius: '9999px',
}

// ── Component ────────────────────────────────────────────────

export function ChartLegend({
  items,
  onToggle,
  orientation = 'horizontal',
  className,
}: ChartLegendProps) {
  const listStyle: CSSProperties = {
    ...listBase,
    flexDirection: orientation === 'vertical' ? 'column' : 'row',
  }

  return (
    <ul className={className} style={listStyle} aria-label="Chart legend">
      {items.map((item) => (
        <li key={item.key} style={liStyle}>
          <button
            type="button"
            style={{
              ...itemBase,
              opacity: item.visible ? 1 : 0.4,
            }}
            onClick={() => onToggle?.(item.key, !item.visible)}
            aria-pressed={item.visible}
            aria-label={`${item.label}: ${item.visible ? 'visible' : 'hidden'}`}
          >
            <span
              style={{
                ...swatchBase,
                backgroundColor: item.visible ? item.color : 'transparent',
                border: `2px solid ${item.color}`,
              }}
              aria-hidden
            />
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

ChartLegend.displayName = 'ChartLegend'
