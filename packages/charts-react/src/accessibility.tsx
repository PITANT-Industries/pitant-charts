'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

// ── Accessible Data Table ────────────────────────────────────

export interface AccessibleDataTableSeries {
  key: string
  label: string
  data: Array<{ timestamp: number; value: number | null }>
}

export interface AccessibleDataTableProps {
  /** Label for the chart (used as table caption). */
  label: string
  /** Series data for the table. */
  series: AccessibleDataTableSeries[]
  /** Format timestamp for display. */
  formatTimestamp?: (ts: number) => string
  /** Format value for display. */
  formatValue?: (val: number | null, seriesKey: string) => string
  /** Maximum rows to render (for performance with large datasets). @default 100 */
  maxRows?: number
  className?: string
}

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

function defaultFormatTimestamp(ts: number): string {
  return new Date(ts).toISOString()
}

function defaultFormatValue(val: number | null): string {
  return val?.toFixed(2) ?? '—'
}

export function AccessibleDataTable({
  label,
  series,
  formatTimestamp = defaultFormatTimestamp,
  formatValue = defaultFormatValue,
  maxRows = 100,
  className,
}: AccessibleDataTableProps) {
  const timestamps = useMemo(() => {
    const allTs = series[0]?.data.map((d) => d.timestamp) ?? []
    if (allTs.length <= maxRows) return allTs
    const step = Math.ceil(allTs.length / maxRows)
    return allTs.filter((_, i) => i % step === 0)
  }, [series, maxRows])

  return (
    <section className={className} style={srOnlyStyle} aria-label={`${label} data table`}>
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timestamps.map((ts) => (
            <tr key={ts}>
              <td>{formatTimestamp(ts)}</td>
              {series.map((s) => {
                const point = s.data.find((d) => d.timestamp === ts)
                return <td key={s.key}>{formatValue(point?.value ?? null, s.key)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

AccessibleDataTable.displayName = 'AccessibleDataTable'

// ── useKeyboardNavigation ────────────────────────────────────

export interface KeyboardNavConfig {
  /** Current focused data point index. */
  focusedIndex: number
  /** Total number of data points. */
  totalPoints: number
  /** Called when focus moves to a new index. */
  onFocusChange: (index: number) => void
  /** Called when user activates a data point (Enter/Space). */
  onActivate?: (index: number) => void
}

export function useKeyboardNavigation({
  focusedIndex,
  totalPoints,
  onFocusChange,
  onActivate,
}: KeyboardNavConfig) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          onFocusChange(Math.min(focusedIndex + 1, totalPoints - 1))
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          onFocusChange(Math.max(focusedIndex - 1, 0))
          break
        case 'Home':
          e.preventDefault()
          onFocusChange(0)
          break
        case 'End':
          e.preventDefault()
          onFocusChange(totalPoints - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onActivate?.(focusedIndex)
          break
        case 'PageDown':
          e.preventDefault()
          onFocusChange(Math.min(focusedIndex + 10, totalPoints - 1))
          break
        case 'PageUp':
          e.preventDefault()
          onFocusChange(Math.max(focusedIndex - 10, 0))
          break
      }
    },
    [focusedIndex, totalPoints, onFocusChange, onActivate],
  )

  return { handleKeyDown }
}

// ── useReducedMotion ─────────────────────────────────────────

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}

// ── Announcer (aria-live) ────────────────────────────────────

export interface AnnouncerProps {
  /** Message to announce. Changes trigger screen reader announcement. */
  message: string
  children?: ReactNode
}

const announcerStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function Announcer({ message }: AnnouncerProps) {
  return (
    <div aria-live="polite" aria-atomic="true" style={announcerStyle}>
      {message}
    </div>
  )
}

Announcer.displayName = 'Announcer'
