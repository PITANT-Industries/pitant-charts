import { useId } from 'react'
import type { CSSProperties } from 'react'
import { usePlotSize } from '../../usePlotSize'
import type { BatchGenealogyData, GenealogyNode, prepareGenealogy, traceGenealogy } from './model'

type Prepared = NonNullable<ReturnType<typeof prepareGenealogy>>
type Trace = NonNullable<ReturnType<typeof traceGenealogy>>
type Role = 'upstream' | 'downstream' | 'selected' | 'context'
type NodeBox = { x: number; y: number; width: number; height: number; label: string }

const ink = { upstream: '#2b607a', downstream: '#986044', context: '#aab4bb', witness: '#26323b' }
const shortTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function nodeRank(node: GenealogyNode, prepared: Prepared) {
  if (node.kind !== 'lot' || node.rank !== 0) return node.rank
  const consumers = prepared.edges.filter((edge) => edge.from === node.key)
  return consumers.length ? Math.max(0, Math.min(...consumers.map(({ to }) => prepared.byKey.get(to)!.rank)) - 1) : 0
}

function positions(prepared: Prepared, data: BatchGenealogyData, width: number, height: number, vertical: boolean, compact: boolean) {
  const lanes = new Map<number, GenealogyNode[]>()
  for (const node of prepared.nodes) {
    const rank = nodeRank(node, prepared)
    const layer = lanes.get(rank) || []
    layer.push(node)
    lanes.set(rank, layer)
  }
  const last = Math.max(1, ...lanes.keys())
  const breadth = Math.max(...Array.from(lanes.values(), (layer) => layer.length))
  const span = vertical ? height : width
  const cross = vertical ? width : height
  const gap = Math.max(1, (span - (compact ? 28 : 38)) / (last + 1))
  const cellWidth = vertical ? Math.max(12, Math.min(122, (cross - 20) / breadth - 8))
    : compact ? Math.max(7, Math.min(18, gap * .54)) : Math.max(13, Math.min(95, gap - 13))
  const cellHeight = compact ? 12 : 38
  const laneGap = vertical ? cellWidth + 8 : Math.min(compact ? 25 : 60, (cross - 15) / breadth)
  const rankStart = (span - gap * last) / 2
  const boxes = new Map<string, NodeBox>()
  for (const [rank, layer] of lanes) {
    layer.forEach((node, index) => {
      const primary = rankStart + rank * gap
      const secondary = cross / 2 + (index - (layer.length - 1) / 2) * laneGap
      boxes.set(node.key, {
        x: vertical ? secondary : primary,
        y: vertical ? primary : secondary,
        width: cellWidth,
        height: cellHeight,
        label: node.kind === 'lot' ? data.lots[node.index].id : data.steps[node.index].shortLabel || data.steps[node.index].label,
      })
    })
  }
  return boxes
}

function connector(from: NodeBox, to: NodeBox, vertical: boolean) {
  if (vertical) {
    const y1 = from.y + from.height / 2
    const y2 = to.y - to.height / 2
    const middle = (y1 + y2) / 2
    return `M${from.x} ${y1}C${from.x} ${middle} ${to.x} ${middle} ${to.x} ${y2}`
  }
  const x1 = from.x + from.width / 2
  const x2 = to.x - to.width / 2
  const middle = (x1 + x2) / 2
  return `M${x1} ${from.y}C${middle} ${from.y} ${middle} ${to.y} ${x2} ${to.y}`
}

function traceRole(trace: Trace, node: string): Role {
  if (trace.root === node) return 'selected'
  if (trace.upstream.has(node)) return 'upstream'
  if (trace.downstream.has(node)) return 'downstream'
  return 'context'
}

function labelForWidth(value: string, width: number) {
  const letters = Math.max(1, Math.floor((width - 8) / 5.5))
  return value.length <= letters ? value : `${value.slice(0, letters - 1)}…`
}

function stepOutline(box: NodeBox) {
  const { width, height } = box
  const x = -width / 2
  const y = -height / 2
  const cut = Math.min(7, height / 4, width / 4)
  return `M${x + cut} ${y}H${x + width - cut}L${-x} ${y + cut}V${-y - cut}L${x + width - cut} ${-y}H${x + cut}L${x} ${-y - cut}V${y + cut}Z`
}

export function GenealogyPlot({ data, prepared, trace, inspected, witness, label, compact, onInspect }: {
  data: BatchGenealogyData
  prepared: Prepared
  trace: Trace
  inspected: string
  witness: readonly string[]
  label: string
  compact: boolean
  onInspect: (node: string) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 380 : 760, compact ? 175 : 345)
  const marker = useId()
  const vertical = !compact && width < 620
  const maxRank = Math.max(...prepared.nodes.map(({ rank }) => rank))
  const boxes = positions(prepared, data, width, height, vertical, compact)
  const stageStyle = { '--genealogy-stages': maxRank + 1 } as CSSProperties
  const records = [...prepared.edges].sort((a, b) => {
    const traced = (key: string) => trace.upstreamEdges.has(key) || trace.downstreamEdges.has(key)
    return Number(traced(a.key)) - Number(traced(b.key))
  })

  return (
    <div className="genealogy-plot scientific-plot" ref={plot} style={stageStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-genealogy-plot
        data-orientation={vertical ? 'vertical' : 'horizontal'}>
        <defs>
          {Object.entries(ink).map(([role, color]) => (
            <marker id={`${marker}-${role}`} key={role} viewBox="0 0 8 8" refX={7} refY={4}
              markerWidth={5} markerHeight={5} orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 0 8 4 0 8 2 4Z" fill={color} />
            </marker>
          ))}
        </defs>
        <g aria-hidden="true">
          {records.map((edge) => {
            const role = trace.upstreamEdges.has(edge.key) ? 'upstream' : trace.downstreamEdges.has(edge.key) ? 'downstream' : 'context'
            const proof = !compact && witness.some((key, index) => key === edge.from && witness[index + 1] === edge.to)
            return <path key={edge.key} d={connector(boxes.get(edge.from)!, boxes.get(edge.to)!, vertical)}
              className="genealogy-edge" data-genealogy-edge data-from={edge.from} data-to={edge.to}
              data-relation={role} data-witness={proof}
              markerEnd={`url(#${marker}-${proof ? 'witness' : role})`} />
          })}
          {prepared.nodes.map((node) => {
            const box = boxes.get(node.key)!
            const role = traceRole(trace, node.key)
            const lot = node.kind === 'lot' ? data.lots[node.index] : undefined
            return (
              <g key={node.key} transform={`translate(${box.x} ${box.y})`} className="genealogy-node"
                data-genealogy-node={node.key} data-kind={node.kind} data-relation={role}
                data-held={lot?.status === 'held'} data-inspected={!compact && inspected === node.key}
                onClick={compact ? undefined : () => onInspect(node.key)}>
                {node.kind === 'lot'
                  ? <rect className="genealogy-node-shape" x={-box.width / 2} y={-box.height / 2}
                    width={box.width} height={box.height} rx={compact ? 2 : 3} />
                  : <path className="genealogy-node-shape" d={stepOutline(box)} />}
                {!compact && box.width >= 30 && <>
                  <text className="genealogy-node-label" y={node.kind === 'step' || lot?.status === 'held' ? -2 : 4} textAnchor="middle">
                    {labelForWidth(box.label, box.width)}
                  </text>
                  {node.kind === 'step' && box.width >= 38 && <text className="genealogy-node-time" y={11} textAnchor="middle">
                    {shortTime.format(new Date(data.steps[node.index].timestamp))}
                  </text>}
                  {lot?.status === 'held' && <text className="genealogy-node-hold" y={11} textAnchor="middle">Hold</text>}
                </>}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
