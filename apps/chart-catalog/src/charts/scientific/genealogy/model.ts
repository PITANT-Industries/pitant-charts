export interface GenealogyLot {
  id: string
  label: string
  status?: 'held' | 'released'
  detail?: string
}

export interface GenealogyPort {
  lotId: string
  quantity?: number
  unit?: string
}

export interface GenealogyStep {
  id: string
  label: string
  shortLabel?: string
  timestamp: string
  inputs: readonly GenealogyPort[]
  outputs: readonly GenealogyPort[]
  location?: string
}

export interface BatchGenealogyData {
  lots: readonly GenealogyLot[]
  steps: readonly GenealogyStep[]
}

export interface GenealogyNode {
  key: string
  kind: 'lot' | 'step'
  index: number
  rank: number
}

export interface GenealogyEdge {
  key: string
  from: string
  to: string
  stepIndex: number
  side: 'input' | 'output'
  port: GenealogyPort
}

export interface PreparedGenealogy {
  nodes: readonly GenealogyNode[]
  edges: readonly GenealogyEdge[]
  byKey: ReadonlyMap<string, GenealogyNode>
  incoming: ReadonlyMap<string, readonly GenealogyEdge[]>
  outgoing: ReadonlyMap<string, readonly GenealogyEdge[]>
}

export interface GenealogyTrace {
  root: string
  upstream: ReadonlySet<string>
  downstream: ReadonlySet<string>
  upstreamEdges: ReadonlySet<string>
  downstreamEdges: ReadonlySet<string>
  upstreamWitness: ReadonlyMap<string, string>
  downstreamWitness: ReadonlyMap<string, string>
}

interface Timestamp {
  seconds: number
  fraction: string
}

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-](\d{2}):(\d{2}))$/

function readTimestamp(value: unknown): Timestamp | null {
  if (typeof value !== 'string') return null
  const match = timestampPattern.exec(value)
  if (!match || match[0].length !== value.length) return null
  const [, year, month, day, hour, minute, second = '00', fraction = '', offset, zoneHour = '00', zoneMinute = '00'] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 ||
    Number(minute) > 59 || Number(second) > 59 || Number(zoneHour) > 23 || Number(zoneMinute) > 59) return null

  const seconds = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`) / 1000
  if (!Number.isFinite(seconds)) return null
  return { seconds, fraction: fraction.replace(/0+$/, '') }
}

function later(first: Timestamp, second: Timestamp) {
  return first.seconds > second.seconds || (first.seconds === second.seconds && first.fraction > second.fraction)
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function optionalText(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function lotKey(id: string) {
  return `lot:${id}`
}

function stepKey(id: string) {
  return `step:${id}`
}

function ranksFor(
  nodes: readonly Omit<GenealogyNode, 'rank'>[],
  incoming: PreparedGenealogy['incoming'],
  outgoing: PreparedGenealogy['outgoing'],
) {
  const pending = new Map(nodes.map(({ key }) => [key, incoming.get(key)?.length ?? 0]))
  const ranks = new Map(nodes.map(({ key }) => [key, 0]))
  const ready = nodes.flatMap(({ key }) => pending.get(key) === 0 ? [key] : [])
  for (let index = 0; index < ready.length; index++) {
    const key = ready[index]
    const nextRank = ranks.get(key)! + 1
    for (const { to } of outgoing.get(key) ?? []) {
      ranks.set(to, Math.max(ranks.get(to)!, nextRank))
      const remaining = pending.get(to)! - 1
      pending.set(to, remaining)
      if (remaining === 0) ready.push(to)
    }
  }

  return ready.length === nodes.length ? ranks : null
}

export function prepareGenealogy(data: BatchGenealogyData): PreparedGenealogy | null {
  const { lots, steps } = data ?? {}
  if (!Array.isArray(lots) || !lots.length || !Array.isArray(steps)) return null

  const bases: Omit<GenealogyNode, 'rank'>[] = []
  const lotIds = new Set<string>()
  for (const [index, lot] of lots.entries()) {
    if (!nonblank(lot?.id) || !nonblank(lot.label) || lotIds.has(lot.id) ||
      (lot.status !== undefined && lot.status !== 'held' && lot.status !== 'released') ||
      !optionalText(lot.detail)) return null
    lotIds.add(lot.id)
    bases.push({ key: lotKey(lot.id), kind: 'lot', index })
  }

  const stepIds = new Set<string>()
  const timestamps: Timestamp[] = []
  const producers = new Map<string, number>()
  const edges: GenealogyEdge[] = []
  const incoming = new Map<string, GenealogyEdge[]>()
  const outgoing = new Map<string, GenealogyEdge[]>()
  for (const [stepIndex, step] of steps.entries()) {
    if (!nonblank(step?.id) || !nonblank(step.label) || stepIds.has(step.id) || !optionalText(step.location) ||
      !Array.isArray(step.inputs) || !step.inputs.length || !Array.isArray(step.outputs) || !step.outputs.length) return null
    const timestamp = readTimestamp(step.timestamp)
    if (!timestamp) return null
    timestamps.push(timestamp)

    stepIds.add(step.id)
    const key = stepKey(step.id)
    bases.push({ key, kind: 'step', index: stepIndex })
    for (const side of ['input', 'output'] as const) {
      const seen = new Set<string>()
      const ports = side === 'input' ? step.inputs : step.outputs
      for (const port of ports) {
        if (!nonblank(port?.lotId) || !lotIds.has(port.lotId) || seen.has(port.lotId) ||
          (port.quantity !== undefined && (!Number.isFinite(port.quantity) || port.quantity <= 0)) ||
          !optionalText(port.unit)) return null
        seen.add(port.lotId)

        if (side === 'output') {
          if (producers.has(port.lotId)) return null
          producers.set(port.lotId, stepIndex)
        }

        const lot = lotKey(port.lotId)
        const [from, to] = side === 'input' ? [lot, key] : [key, lot]
        const edge: GenealogyEdge = { key: JSON.stringify([from, to]), from, to, stepIndex, side, port }
        edges.push(edge)

        const successors = outgoing.get(from)
        if (successors) successors.push(edge)
        else outgoing.set(from, [edge])
        const predecessors = incoming.get(to)
        if (predecessors) predecessors.push(edge)
        else incoming.set(to, [edge])
      }
    }
  }

  for (const { side, port, stepIndex } of edges) {
    if (side !== 'input') continue
    const producer = producers.get(port.lotId)
    if (producer !== undefined && later(timestamps[producer], timestamps[stepIndex])) return null
  }

  const ranks = ranksFor(bases, incoming, outgoing)
  if (!ranks) return null
  const nodes = bases.map(node => ({ ...node, rank: ranks.get(node.key)! }))
  return { nodes, edges, byKey: new Map(nodes.map(node => [node.key, node])), incoming, outgoing }
}

function traverse(
  root: string,
  adjacency: ReadonlyMap<string, readonly GenealogyEdge[]>,
  backward: boolean,
) {
  const nodes = new Set<string>()
  const edges = new Set<string>()
  const witness = new Map<string, string>()
  const queue = [root]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    for (const edge of adjacency.get(current) ?? []) {
      const next = backward ? edge.from : edge.to
      edges.add(edge.key)
      if (nodes.has(next)) continue
      nodes.add(next)
      witness.set(next, current)
      queue.push(next)
    }
  }
  return { nodes, edges, witness }
}

export function traceGenealogy(prepared: PreparedGenealogy, lotId: string): GenealogyTrace | null {
  const root = lotKey(lotId)
  if (!prepared.byKey.has(root)) return null

  const upstream = traverse(root, prepared.incoming, true)
  const downstream = traverse(root, prepared.outgoing, false)
  return {
    root,
    upstream: upstream.nodes,
    downstream: downstream.nodes,
    upstreamEdges: upstream.edges,
    downstreamEdges: downstream.edges,
    upstreamWitness: upstream.witness,
    downstreamWitness: downstream.witness,
  }
}

/** Returns recorded node keys in the direction of material flow. */
export function lineagePath(trace: GenealogyTrace, targetKey: string): readonly string[] {
  const upstream = trace.upstream.has(targetKey)
  const witness = upstream ? trace.upstreamWitness : trace.downstreamWitness
  const path = [targetKey]
  let current = targetKey
  while (current !== trace.root) {
    const next = witness.get(current)
    if (next === undefined) return []
    path.push(next)
    current = next
  }
  return upstream ? path : path.reverse()
}
