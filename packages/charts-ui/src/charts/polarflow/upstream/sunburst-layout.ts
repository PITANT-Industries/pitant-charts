// Adapted from Bklit UI (https://bklit.com/r/sunburst-chart.json). See licenses/Bklit-UI-MIT.txt.

import type { SunburstNode } from './sunburst-data'

export interface ArcDatum {
  id: string
  name: string
  depth: number
  value: number
  categoryIndex: number
  hasChildren: boolean
  trail: string[]
  parentId: string | null
  a0: number
  a1: number
  /** Stable index for Studio layer wiring. */
  arcIndex: number
  /** Optional color override from data node. */
  color?: string
  /** Optional fill override from data node (patterns). */
  fill?: string
}

export interface Focus {
  id: string
  name: string
  depth: number
  parentId: string | null
  categoryIndex: number
  a0: number
  a1: number
}

export interface ArcGeometry {
  a0: number
  a1: number
  innerR: number
  outerR: number
}

const TOP = -Math.PI / 2
const TWO_PI = 2 * Math.PI
const ID_SEP = ' / '
/** Drill-down navigation hub is smaller than one ring to leave room for hover grow. */
const DRILL_CENTER_SCALE = 0.65
/** Extra hub shrink per focus level beyond the first drill. */
const DRILL_CENTER_DEPTH_SHRINK = 0.08
function nodeId(parentId: string, index: number): string {
  return `${parentId}${ID_SEP}${index}`
}

export function sumValues(node: SunburstNode): number {
  if (node.children?.length) {
    return node.children.reduce((sum, child) => sum + sumValues(child), 0)
  }
  return node.value !== undefined && Number.isFinite(node.value) ? Math.max(0, node.value) : 0
}

interface BuildContext {
  arcs: ArcDatum[]
  focusById: Map<string, Focus>
  maxDepth: number
  rootId: string
  arcIndex: number
}

function layoutNode(
  node: SunburstNode,
  id: string,
  depth: number,
  a0: number,
  a1: number,
  parentId: string | null,
  categoryIndex: number,
  trail: string[],
  ctx: BuildContext,
) {
  const value = sumValues(node)
  const hasChildren = Boolean(node.children?.length)

  if (depth > 0) {
    ctx.arcs.push({
      id,
      name: node.name,
      depth,
      value,
      categoryIndex,
      hasChildren,
      trail: [...trail, node.name],
      parentId,
      a0,
      a1,
      arcIndex: ctx.arcIndex,
      color: node.color,
      fill: node.fill,
    })
    ctx.arcIndex += 1
  }

  ctx.focusById.set(id, {
    id,
    name: node.name,
    depth,
    parentId,
    categoryIndex,
    a0,
    a1,
  })
  ctx.maxDepth = Math.max(ctx.maxDepth, depth)

  if (!(hasChildren && node.children?.length)) {
    return
  }

  const span = a1 - a0
  let cursor = a0
  for (const [index, child] of node.children.entries()) {
    const childValue = sumValues(child)
    const childSpan = value > 0 ? (childValue / value) * span : 0
    const childId = nodeId(id, index)
    const childCategory = depth === 0 ? index : categoryIndex
    layoutNode(
      child,
      childId,
      depth + 1,
      cursor,
      cursor + childSpan,
      id,
      childCategory,
      [...trail, node.name],
      ctx,
    )
    cursor += childSpan
  }
}

function toRadians(normalized: number): number {
  return TOP + normalized * TWO_PI
}

export function buildArcs(data: SunburstNode) {
  const rootId = 'root'
  const ctx: BuildContext = {
    arcs: [],
    focusById: new Map(),
    maxDepth: 0,
    rootId,
    arcIndex: 0,
  }

  layoutNode(data, rootId, 0, 0, 1, null, 0, [], ctx)

  for (const arc of ctx.arcs) {
    arc.a0 = toRadians(arc.a0)
    arc.a1 = toRadians(arc.a1)
  }
  for (const focus of ctx.focusById.values()) {
    focus.a0 = toRadians(focus.a0)
    focus.a1 = toRadians(focus.a1)
  }

  return {
    arcs: ctx.arcs,
    maxDepth: ctx.maxDepth,
    total: sumValues(data),
    focusById: ctx.focusById,
    rootId,
  }
}

export function ringOptions(focusDepth: number, maxDepth: number, radius: number) {
  const oneLevelCenterR = radius / maxDepth
  if (focusDepth === 0) {
    // Root view — segments fill from the center, no navigation hub gap.
    return { centerR: 0, ringWidth: oneLevelCenterR }
  }
  // Hub shrinks on drill-down; shrinks further when focus moves deeper.
  const depthPastFirstDrill = Math.max(0, focusDepth - 1)
  const centerScale = Math.max(
    0.45,
    DRILL_CENTER_SCALE - depthPastFirstDrill * DRILL_CENTER_DEPTH_SHRINK,
  )
  const centerR = oneLevelCenterR * centerScale
  const visibleRings = Math.max(1, maxDepth - focusDepth)
  const ringWidth = (radius - centerR) / visibleRings
  return { centerR, ringWidth }
}

export function geometryFor(
  arc: ArcDatum,
  focus: Focus,
  maxDepth: number,
  radius: number,
): ArcGeometry | null {
  if (arc.depth <= focus.depth) {
    return null
  }
  if (arc.id !== focus.id && !arc.id.startsWith(`${focus.id}${ID_SEP}`)) {
    return null
  }

  const { centerR, ringWidth } = ringOptions(focus.depth, maxDepth, radius)
  const relativeDepth = arc.depth - focus.depth
  const focusSpan = focus.a1 - focus.a0
  const mapAngle = (angle: number) => {
    if (focusSpan <= 1e-9) {
      return TOP
    }
    return TOP + ((angle - focus.a0) / focusSpan) * TWO_PI
  }

  return {
    a0: mapAngle(arc.a0),
    a1: mapAngle(arc.a1),
    innerR: centerR + (relativeDepth - 1) * ringWidth,
    outerR: centerR + relativeDepth * ringWidth,
  }
}
