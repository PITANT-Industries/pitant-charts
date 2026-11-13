import { Toggle } from "@ui-sdk/react/toggle";
import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Sector } from 'recharts'
import { useChartTheme } from '../theme'
import { dollars, metrics, number, Pattern, point, sum, tone } from './shared'
import type { Props } from './shared'
import { useAnimatedNumber } from './useAnimatedNumber'
import styles from './donut.module.css'

const fixtures = {
  'pie-center': { label: 'Revenue', names: ['Free', 'Pro', 'Team', 'Enterprise'], values: [11400, 43200, 31600, 33800], currency: true },
  'pie-center-custom': { label: 'All product lines', names: ['Headphones', 'Speakers', 'Microphones', 'Accessories', 'Other'], values: [2310, 1760, 1340, 980, 610] },
  'pie-center-share': { label: 'Total sales', names: ['Electronics', 'Home', 'Apparel', 'Sports', 'Other'], values: [4250, 2930, 2180, 1580, 1160] },
  'pie-hover-legend': { label: 'Orders', names: ['Online store', 'Retail', 'Marketplace', 'Wholesale', 'Social'], values: [5820, 3940, 2310, 1480, 950] },
  'pie-half-donut': { label: 'Sessions', names: ['Direct', 'Organic search', 'Referral'], values: [4166, 3544, 2450] },
  'pie-donut-grow': { label: 'Sessions', names: ['Chrome', 'Safari', 'Edge', 'Firefox', 'Other'], values: [27750, 19800, 17750, 15600, 11600] },
  'pie-glow': { label: 'Spend', names: ['Compute', 'Storage', 'Networking', 'Databases'], values: [18600, 8520, 6740, 4880], currency: true },
  'pie-patterns': { label: 'Tickets', names: ['Email', 'Chat', 'Web', 'Phone'], values: [1848, 1100, 836, 616] },
} satisfies Record<string, { label: string; names: string[]; values: number[]; currency?: boolean }>

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
  const fixture = fixtures[example.id as keyof typeof fixtures] ?? fallback
  const half = example.id === 'pie-half-donut'
  const showLegend = !compact && example.id === 'pie-hover-legend'
  const patterned = example.id === 'pie-patterns'
  const glow = example.id === 'pie-glow'
  const grows = half || example.id === 'pie-donut-grow'
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
  const inner = half ? 67 : showLegend ? 75 : example.id === 'pie-center-share' ? 78 : 72
  const labelY = half ? 122 : 133
  const baseLabel = data ? 'Total' : fixture.label
  const centerTitle = row?.name ?? baseLabel
  const accessibleLabel = row ? `${row.name}, ${format.format(value)}, ${percentage.format(share)} of total` : `Total ${format.format(total)}`
  let angle = 180

  function moveFocus(event: KeyboardEvent<SVGSVGElement>) {
    if (!rows.length) return
    if (event.key === 'Escape' && active !== null) {
      event.preventDefault()
      setFocused(null)
      setHovered(null)
      setPinned(null)
      return
    }
    const index = active ?? -1
    const next = {
      ArrowRight: (index + 1) % rows.length,
      ArrowDown: (index + 1) % rows.length,
      ArrowLeft: index <= 0 ? rows.length - 1 : index - 1,
      ArrowUp: index <= 0 ? rows.length - 1 : index - 1,
      Home: 0,
      End: rows.length - 1,
    }[event.key]
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
          {patterned && rows.map((item, index) => <Pattern key={index} id={`${uid}-pattern-${index}`} color={tone(theme, index, item.color)} variant={[0, 2, 1, 3][index % 4]} />)}
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
          const fill = patterned ? `url(#${uid}-pattern-${index})` : color
          return (
            <g key={index} className={styles.slice} data-active={selected} data-dimmed={row !== undefined && !selected}
              style={{ transform: `translate(${x}px, ${y}px)` }}>
              <g className={styles.mark} filter={glow && selected ? `url(#${uid}-glow-${index})` : undefined}>
                {rows.length === 1 && !half ? <circle cx={cx} cy={cy} r={(inner + outer) / 2} fill="none" stroke={fill} strokeWidth={outer - inner} /> : <Sector {...geometry} outerRadius={outer + (grows && selected ? 5 : 0)} fill={fill} />}
              </g>
              <Sector {...geometry} outerRadius={outer + (grows ? 6 : 4)} fill="transparent" onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(index) }} onPointerLeave={() => setHovered(null)} onClick={() => setPinned((previous) => previous === index ? null : index)}>
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
            {example.id === 'pie-center-share' && row && <text className={styles.share} x={cx} y={labelY + 34}>{percentage.format(share)} of total</text>}
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
