import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Sector } from 'recharts'
import { useChartTheme } from '../theme'
import { dollars, metrics, nextChartFocus, number, point, sum, tone } from './shared'
import type { Props } from './shared'
import { useAnimatedNumber } from './useAnimatedNumber'
import styles from './donut.module.css'
import { donutFixtures as fixtures, pieFixtures } from './circular-fixtures'
import { PiePattern, piePatterns } from './PiePattern'

const fallback = { label: 'Total', names: ['Platform', 'Services', 'Marketplace', 'Support', 'Other'], values: [470, 285, 192, 140, 108] }
const percentage = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })

export function usesDonut(id: string) {
  return Object.hasOwn(fixtures, id)
}

export function Donut({ example, compact, data, renderCenter }: Props) {
  const theme = useChartTheme()
  const uid = useId()
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const chartFixture = pieFixtures[example.id as keyof typeof pieFixtures]
  const fixture = fixtures[example.id as keyof typeof fixtures] ?? (chartFixture ? { label: 'Total', ...chartFixture } : fallback)
  const half = example.id === 'pie-half-donut'
  const showLegend = !compact && example.id === 'pie-hover-legend'
  const patterns = piePatterns[example.id]
  const patterned = Boolean(patterns)
  const glow = example.id === 'pie-glow'
  const grows = half
  const custom = example.id === 'pie-center-custom' && !data
  const rows = metrics(data, fixture.names, fixture.values).filter((row) => row.value > 0)
  const total = sum(rows)
  const active = hovered ?? focused ?? pinned
  const row = active === null ? undefined : rows[active]
  const value = row?.value ?? total
  const share = total ? value / total : 0
  const format = !data && 'currency' in fixture && fixture.currency ? dollars : number
  const display = useAnimatedNumber(value, !compact && !half)
  const visibleValue = format.format(Number.isInteger(value) ? Math.round(display) : display)
  const height = half ? 174 : 260
  const cx = 150
  const cy = half ? 145 : 130
  const outer = half ? 126 : 114
  const inner = half ? 67 : showLegend ? 72 : patterned ? 61 : 69
  const labelY = half ? 122 : 133
  const baseLabel = data ? 'Total' : fixture.label
  const centerTitle = row?.name ?? baseLabel
  const accessibleLabel = row ? `${row.name}, ${format.format(value)}, ${percentage.format(share)} of total` : `Total ${format.format(total)}`
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
    const next = nextChartFocus(event.key, active, rows.length)
    if (next !== undefined) {
      event.preventDefault()
      setHovered(null)
      setFocused(next)
    }
  }

  return (
    <div className={`${styles.donut}${showLegend ? ` ${styles.withLegend}` : ''}`}>
      <svg className={styles.plot} viewBox={`0 0 300 ${height}`} role="img" aria-label={example.title} aria-describedby={compact ? undefined : `${uid}-value`} tabIndex={compact ? undefined : 0} onKeyDown={moveFocus} onBlur={() => setFocused(null)}>
        <defs>
          {rows.map((item, index) => {
            const type = patterns?.[index];
            return type && <PiePattern key={index} id={`${uid}-pattern-${index}`} color={tone(theme, index, item.color)} type={type} tinted={example.id === 'pie-pattern-tile'} />
          })}
          {glow && rows.map((item, index) => <filter key={index} id={`${uid}-glow-${index}`} x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={tone(theme, index, item.color)} floodOpacity=".55" /></filter>)}
        </defs>
        {!rows.length && <Sector cx={cx} cy={cy} outerRadius={outer} innerRadius={inner} startAngle={180} endAngle={half ? 0 : -180} fill={theme.grid} />}
        {rows.map((item, index) => {
          const sweep = item.value / total * (half ? 180 : 360)
          const start = angle
          angle -= sweep
          const inset = rows.length === 1 && !half ? 0 : Math.min(half || glow || patterned ? 1.05 : .48, sweep / 6)
          const corner = half || glow || patterned ? Math.min(glow ? 5 : 3.5, sweep * inner * Math.PI / 900) : 0
          const selected = active === index
          const color = tone(theme, index, item.color)
          const [x, y] = point(0, 0, selected && !grows && !glow ? 3 : 0, -(start - sweep / 2))
          const geometry = { cx, cy, startAngle: start - inset, endAngle: angle + inset, innerRadius: inner, cornerRadius: corner }
          const fill = patterns?.[index] ? `url(#${uid}-pattern-${index})` : color
          return (
            <g key={index} className={styles.slice} data-active={selected} data-dimmed={row !== undefined && !selected} data-slice={item.name} data-grow={grows && selected}
              style={{ transform: `translate(${x}px, ${y}px)` }}>
              <g className={styles.mark} filter={glow && selected ? `url(#${uid}-glow-${index})` : undefined}>
                {rows.length === 1 && !half ? <circle cx={cx} cy={cy} r={(inner + outer) / 2} fill="none" stroke={fill} strokeWidth={outer - inner} /> : <Sector {...geometry} outerRadius={outer + (grows && selected ? 5 : 0)} fill={fill} />}
              </g>
              <Sector {...geometry} outerRadius={outer + (grows ? 6 : 4)} fill="transparent" onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(index) }} onPointerLeave={() => setHovered(null)} onClick={() => { if (!compact) setPinned((previous) => previous === index ? null : index) }}>
                <title>{`${item.name}: ${format.format(item.value)} (${percentage.format(item.value / total)})`}</title>
              </Sector>
            </g>
          )
        })}
        {renderCenter ? <foreignObject x={cx - 60} y={labelY - 39} width="120" height="72" pointerEvents="none"><div className={styles.custom}>{renderCenter({ name: row?.name ?? null, value, total, share })}</div></foreignObject> : (!half || row || !rows.length) && (
          <g textAnchor="middle" pointerEvents="none" aria-hidden="true">
            {custom && <text className={styles.caption} x={cx} y={labelY - 26}>{centerTitle}</text>}
            <text className={styles.value} x={cx} y={labelY} style={{ fontSize: visibleValue.length > 8 ? 22 : undefined }}>{visibleValue}</text>
            <text className={styles.caption} x={cx} y={labelY + 19}>{custom ? 'Units sold' : centerTitle}</text>
          </g>
        )}
      </svg>
      {!compact && <span className={styles.screenReader} id={`${uid}-value`} role="status">{accessibleLabel}</span>}
      {showLegend && <ul className={styles.legend} aria-label="Sales channels">
        {rows.map((item, index) => <li key={index}><Toggle pressed={pinned === index} data-active={active === index} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onPressedChange={(pressed) => setPinned(pressed ? index : null)}><span className={styles.swatch} style={{ background: tone(theme, index, item.color) }} /><span>{item.name}</span><strong>{format.format(item.value)}</strong></Toggle></li>)}
      </ul>}
    </div>
  )
}
