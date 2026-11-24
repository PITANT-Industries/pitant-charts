import { useId, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { dieOutline } from './model'
import type { DefectBin, PreparedDie, PreparedWafer, WaferGeometry } from './model'

const axisFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const shades = ['#b64e3a', '#5d4e98', '#247d77', '#9a7226', '#356c95', '#793e5f']

export function defectColor(index: number) {
  return shades[Math.max(0, index) % shades.length]
}

type Plot = { x: (value: number) => number; y: (value: number) => number; scale: number }
type BinFilter = string | undefined

export function matchesBin(die: PreparedDie, filter: BinFilter) {
  return die.status === 'fail' && (filter === undefined || (die.bin || '') === filter)
}

function waferBoundary(geometry: WaferGeometry, { x, y, scale }: Plot) {
  const radius = geometry.radius
  if (radius === undefined) return undefined
  const px = radius * scale
  if (!geometry.notch) return `M${x(radius)} ${y(0)}a${px} ${px} 0 1 0 ${-2 * px} 0a${px} ${px} 0 1 0 ${2 * px} 0Z`
  const angle = geometry.notch.angleDeg * Math.PI / 180
  const half = geometry.notch.widthDeg * Math.PI / 360
  const at = (angle: number, r: number) => `${x(Math.cos(angle) * r)} ${y(Math.sin(angle) * r)}`
  return `M${at(angle + half, radius)}A${px} ${px} 0 1 0 ${at(angle - half, radius)}L${at(angle, radius - geometry.notch.depth)}Z`
}

function exposedEdges(dies: readonly PreparedDie[], geometry: WaferGeometry, { x, y }: Plot) {
  return dieOutline(dies, geometry).map(([a, b, c, d]) => `M${x(a)} ${y(b)}L${x(c)} ${y(d)}`).join('')
}

function ticks(min: number, max: number, count: number) {
  const rough = (max - min) / count
  const base = 10 ** Math.floor(Math.log10(rough))
  const step = base * ([1, 2, 2.5, 5, 10].find((value) => base * value >= rough) ?? 10)
  const start = Math.ceil(min / step)
  return Array.from({ length: Math.min(10, Math.max(0, Math.floor(max / step) - start + 1)) },
    (_, index) => (start + index) * step)
}

function cellPath(x: number, y: number, w: number, h: number) {
  return `M${x} ${y}h${w}v${h}h${-w}Z`
}

export function WaferPlot({ wafer, bins, active, filter, compact, label, onSelect }: {
  wafer: PreparedWafer
  bins: readonly DefectBin[]
  active: PreparedDie
  filter: BinFilter
  compact: boolean
  label: string
  onSelect: (die: PreparedDie) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(380, compact ? 198 : 440)
  const clipId = useId()
  const hatch = useId()
  const { minX, maxX, minY, maxY } = wafer.bounds
  const { geometry } = wafer.source
  const margin = compact ? { left: 8, right: 8, bottom: 8, top: 8 } : { left: 35, right: 18, bottom: 45, top: 16 }
  const frameWidth = Math.max(1, width - margin.left - margin.right)
  const frameHeight = Math.max(1, height - margin.top - margin.bottom)
  const scale = Math.min(frameWidth / (maxX - minX), frameHeight / (maxY - minY))
  const left = (width + margin.left - margin.right - scale * (maxX - minX)) / 2
  const top = (height + margin.top - margin.bottom - scale * (maxY - minY)) / 2
  const right = left + scale * (maxX - minX)
  const bottom = top + scale * (maxY - minY)
  const axis = { x: (value: number) => left + (value - minX) * scale, y: (value: number) => top + (maxY - value) * scale, scale }
  const { x, y } = axis
  const dx = geometry.pitchX * scale
  const dy = geometry.pitchY * scale
  const boundary = waferBoundary(geometry, axis)
  const exposed = useMemo(() => boundary ? [] : dieOutline(wafer.dies, geometry), [boundary, wafer, geometry])
  const silhouette = boundary ?? exposed.map(([a, b, c, d]) => `M${x(a)} ${y(b)}L${x(c)} ${y(d)}`).join('')
  const cluster = active.cluster ? wafer.clusters.get(active.cluster) : undefined
  const colors = useMemo(() => new Map(bins.map(({ id }, index) => [id, defectColor(index)])), [bins])
  const paint = (die: PreparedDie) => {
    if (die.status === 'missing') return '#fff'
    if (die.status === 'untested') return `url(#${hatch})`
    if (die.status === 'pass') return '#dde8ec'
    return colors.get(die.bin || '') ?? '#b64e3a'
  }
  const compactLayers = new Map<string, string[]>()
  if (compact) {
    for (const die of wafer.dies) {
      const fill = paint(die)
      const layer = compactLayers.get(fill) || []
      layer.push(cellPath(x(die.x) - dx / 2, y(die.y) - dy / 2, dx, dy))
      compactLayers.set(fill, layer)
    }
  }

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const rowUp = geometry.rowDirection === 'down' ? -1 : 1
    const offsets: Record<string, readonly [number, number]> = {
      ArrowUp: [rowUp, 0], ArrowDown: [-rowUp, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const [row, column] = offset
    const target = wafer.byKey.get(`${active.row + row},${active.column + column}`)
    if (target) onSelect(target)
  }

  return (
    <div className="wafer-plot scientific-plot" ref={plot}
      role={compact ? undefined : 'group'} tabIndex={compact ? undefined : 0}
      aria-label={compact ? undefined : 'Die map. Use arrow keys to inspect an adjacent site.'}
      onKeyDown={compact ? undefined : move}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-wafer-plot
        data-row-direction={geometry.rowDirection ?? 'up'}>
        <defs>
          {boundary && <clipPath id={clipId}><path d={boundary} /></clipPath>}
          <pattern id={hatch} width={5} height={5} patternUnits="userSpaceOnUse">
            <rect width={5} height={5} fill="#e8e4ef" />
            <path d="M-1 1L1 -1M0 5L5 0M4 6L6 4" stroke="#8d839f" strokeWidth={.65} />
          </pattern>
        </defs>
        {boundary && <path d={boundary} fill="#f8fafb" />}
        <g clipPath={boundary ? `url(#${clipId})` : undefined} aria-hidden="true">
          {compact ? Array.from(compactLayers, ([fill, paths]) => (
            <path className="wafer-compact-layer" key={fill} fill={fill} d={paths.join('')} />
          )) : wafer.dies.map((die) => (
            <rect key={die.key} className="wafer-die" data-wafer-die={die.key} data-row={die.row} data-column={die.column}
              data-status={die.status} data-bin={die.bin} data-match={matchesBin(die, filter)}
              data-dimmed={filter !== undefined && die.status === 'fail' && !matchesBin(die, filter)}
              data-x={die.x} data-y={die.y} x={x(die.x) - dx / 2} y={y(die.y) - dy / 2} width={dx} height={dy}
              fill={paint(die)} onClick={() => onSelect(die)} />
          ))}
          {!compact && cluster && <path className="wafer-cluster" data-wafer-cluster={cluster.length}
            d={exposedEdges(cluster, geometry, axis)} />}
          {!compact && <rect className="wafer-die-cursor" data-wafer-cursor={active.key}
            x={x(active.x) - dx / 2} y={y(active.y) - dy / 2} width={dx} height={dy} />}
        </g>
        <path className="wafer-outline" data-wafer-outline={boundary ? 'declared' : 'observed'} d={silhouette}
          data-notch-angle={geometry.notch?.angleDeg} />
        {!compact && <g className="scientific-axis" aria-hidden="true">
          {ticks(minX, maxX, width < 380 ? 4 : 6).map((value) => <g key={value}>
            <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
            <text x={x(value)} y={bottom + 17} textAnchor="middle">{axisFormat.format(value)}</text>
          </g>)}
          {ticks(minY, maxY, 5).map((value) => <g key={value}>
            <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
            <text x={left - 7} y={y(value) + 3.5} textAnchor="end">{axisFormat.format(value)}</text>
          </g>)}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">
            X ({geometry.unit})
          </text>
          <text className="scientific-axis-label" transform={`translate(${Math.max(12, left - 34)} ${(top + bottom) / 2}) rotate(-90)`}
            textAnchor="middle">Y ({geometry.unit})</text>
        </g>}
      </svg>
    </div>
  )
}
