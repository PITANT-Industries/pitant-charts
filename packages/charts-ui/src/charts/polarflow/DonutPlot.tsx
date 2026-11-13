import type { KeyboardEvent, ReactNode } from 'react'
import { useId, useState } from 'react'
import { Sector } from 'recharts'
import type { ChartCenterContext } from '../../types'
import { useChartTheme } from '../theme'
import styles from './donut.module.css'
import type { Metric } from './shared'
import { nextChartFocus, number, point, sum, tone } from './shared'
import { useAnimatedNumber } from './useAnimatedNumber'

const percentage = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })

interface DonutPlotProps {
  label: string
  rows: readonly Metric[]
  totalLabel?: string
  legend?: boolean
  legendLabel?: string
  renderCenter?: (context: ChartCenterContext) => ReactNode
}

export function DonutPlot({
  label,
  rows: data,
  totalLabel = 'Total',
  legend,
  legendLabel = 'Categories',
  renderCenter,
}: DonutPlotProps) {
  const theme = useChartTheme()
  const uid = useId()
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const occurrences = new Map<string, number>()
  const rows = data
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .map((item) => {
      const occurrence = occurrences.get(item.name) ?? 0
      occurrences.set(item.name, occurrence + 1)
      return { ...item, key: JSON.stringify([item.name, occurrence]) }
    })
  const total = sum(rows)
  const requested = hovered ?? focused ?? pinned
  const active = requested !== null && requested < rows.length ? requested : null
  const row = active === null ? undefined : rows[active]
  const value = row?.value ?? total
  const share = total ? value / total : 0
  const display = useAnimatedNumber(value, true)
  const visibleValue = number.format(Number.isInteger(value) ? Math.round(display) : display)
  const cx = 150
  const cy = 130
  const outer = 114
  const inner = legend ? 72 : 69
  const labelY = 133
  const centerTitle = row?.name ?? totalLabel
  const accessibleLabel = row
    ? `${row.name}, ${number.format(value)}, ${percentage.format(share)} of total`
    : `Total ${number.format(total)}`
  let angle = 180

  function moveFocus(event: KeyboardEvent<SVGSVGElement>) {
    if (!rows.length) return
    if (event.key === 'Escape' && active !== null) {
      event.preventDefault()
      event.stopPropagation()
      setFocused(null)
      setHovered(null)
      setPinned(null)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && active !== null) {
      event.preventDefault()
      setPinned((previous) => (previous === active ? null : active))
      return
    }
    const next = nextChartFocus(event.key, active, rows.length)
    if (next !== undefined) {
      event.preventDefault()
      setHovered(null)
      setFocused(next)
    }
  }

  return (
    <div className={`${styles.donut}${legend ? ` ${styles.withLegend}` : ''}`}>
      <svg
        className={styles.plot}
        viewBox="0 0 300 260"
        role="img"
        aria-label={label}
        aria-describedby={`${uid}-value`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The SVG is the keyboard control for inspecting segments.
        tabIndex={0}
        onKeyDown={moveFocus}
        onBlur={() => setFocused(null)}
      >
        {rows.map((item, index) => {
          const sweep = (item.value / total) * 360
          const start = angle
          angle -= sweep
          const inset = rows.length === 1 ? 0 : Math.min(0.65, sweep / 6)
          const selected = active === index
          const color = tone(theme, index, item.color)
          const [x, y] = point(0, 0, selected ? 3 : 0, -(start - sweep / 2))
          const geometry = {
            cx,
            cy,
            startAngle: start - inset,
            endAngle: angle + inset,
            innerRadius: inner,
          }
          return (
            <g
              key={item.key}
              className={styles.slice}
              data-active={selected}
              data-dimmed={row !== undefined && !selected}
              data-slice={item.name}
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <g className={styles.mark}>
                {rows.length === 1 ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(inner + outer) / 2}
                    fill="none"
                    stroke={color}
                    strokeWidth={outer - inner}
                  />
                ) : (
                  <Sector {...geometry} outerRadius={outer} fill={color} />
                )}
              </g>
              <Sector
                {...geometry}
                outerRadius={outer + 4}
                fill="transparent"
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') setHovered(index)
                }}
                onPointerLeave={() => setHovered(null)}
                onClick={() => setPinned((previous) => (previous === index ? null : index))}
              >
                <title>{`${item.name}: ${number.format(item.value)} (${percentage.format(item.value / total)})`}</title>
              </Sector>
            </g>
          )
        })}
        {renderCenter ? (
          <foreignObject x={cx - 60} y={labelY - 39} width="120" height="72" pointerEvents="none">
            <div className={styles.custom}>
              {renderCenter({ name: row?.name ?? null, value, total, share })}
            </div>
          </foreignObject>
        ) : (
          <g textAnchor="middle" pointerEvents="none">
            <text
              className={styles.value}
              x={cx}
              y={labelY}
              style={{ fontSize: visibleValue.length > 8 ? 22 : undefined }}
            >
              {visibleValue}
            </text>
            <text className={styles.caption} x={cx} y={labelY + 19}>
              {centerTitle}
            </text>
          </g>
        )}
      </svg>
      <span className={styles.screenReader} id={`${uid}-value`} role="status">
        {accessibleLabel}
      </span>
      {legend && (
        <ul className={styles.legend} aria-label={legendLabel}>
          {rows.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={pinned === index}
                data-active={active === index}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused(null)}
                onClick={() => setPinned((previous) => (previous === index ? null : index))}
              >
                <span
                  className={styles.swatch}
                  style={{ background: tone(theme, index, item.color) }}
                />
                <span>{item.name}</span>
                <strong>{number.format(item.value)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
