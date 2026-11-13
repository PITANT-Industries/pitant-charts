import { sankey } from "d3-sankey";
import type { FlowLink } from "./sankey-fixtures";

export type FlowNode = { name: string; depth: number; input: number; output: number; x: number; y: number; height: number; index: number };
export type Ribbon = { source: FlowNode; target: FlowNode; value: number; path: string; x0: number; x1: number; y: number; thickness: number };
type Layout = { nodes: FlowNode[]; ribbons: Ribbon[]; maxDepth: number };

export const flowNodeWidth = 16;

function ribbon(source: FlowNode, target: FlowNode, value: number, sy: number, ty: number, thickness: number): Ribbon {
  const x0 = source.x + flowNodeWidth;
  const x1 = target.x;
  const mid = (x0 + x1) / 2;
  const end = sy === ty ? ty + .001 : ty;
  return { source, target, value, thickness, x0, x1, y: (sy + ty) / 2,
    path: `M${x0},${sy}C${mid},${sy},${mid},${end},${x1},${end}` };
}

function collectNodes(links: FlowLink[], order?: readonly string[]) {
  const nodes = new Map<string, FlowNode>();
  const add = (name: string) => {
    const existing = nodes.get(name);
    if (existing) return existing;
    const node = { name, depth: 0, input: 0, output: 0, x: 0, y: 0, height: 0, index: nodes.size };
    nodes.set(name, node);
    return node;
  };
  order?.forEach(add);
  for (const { source, target, value } of links) {
    add(source).output += value;
    add(target).input += value;
  }
  return nodes;
}

function acyclic(links: FlowLink[], nodes: Map<string, FlowNode>) {
  const incoming = new Map([...nodes.keys()].map(name => [name, 0]));
  const outgoing = new Map([...nodes.keys()].map(name => [name, [] as string[]]));
  for (const { source, target } of links) {
    incoming.set(target, incoming.get(target)! + 1);
    outgoing.get(source)!.push(target);
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([name]) => name);
  for (let i = 0; i < queue.length; i++) {
    for (const target of outgoing.get(queue[i])!) {
      const count = incoming.get(target)! - 1;
      incoming.set(target, count);
      if (!count) queue.push(target);
    }
  }
  return queue.length === nodes.size;
}

function cyclicLayout(links: FlowLink[], nodes: Map<string, FlowNode>, width: number, height: number): Layout {
  const ordered = [...nodes.values()];
  const gap = Math.min(16, height / Math.max(2, ordered.length * 2));
  const value = (node: FlowNode) => Math.max(node.input, node.output);
  const unit = Math.max(0, height - 2 * gap - gap * (ordered.length - 1)) / ordered.reduce((sum, node) => sum + value(node), 0);
  let y = gap;
  for (const node of ordered) {
    node.depth = node.index % 2;
    node.x = node.depth ? width - 24 - flowNodeWidth : 24;
    node.y = y;
    node.height = value(node) * unit;
    y += node.height + gap;
  }
  const usedInput = new Map<string, number>();
  const usedOutput = new Map<string, number>();
  const ribbons = links.map(({ source, target, value }) => {
    const a = nodes.get(source)!;
    const b = nodes.get(target)!;
    const thickness = value * unit;
    const from = usedOutput.get(source) ?? 0;
    const to = usedInput.get(target) ?? 0;
    usedOutput.set(source, from + thickness);
    usedInput.set(target, to + thickness);
    return ribbon(a, b, value, a.y + from + thickness / 2, b.y + to + thickness / 2, thickness);
  });
  return { nodes: ordered, ribbons, maxDepth: 1 };
}

export function layoutSankey(links: FlowLink[], width: number, height: number, margin: number, edge: number, gap: number, order?: readonly string[], fixedOrder = false): Layout {
  if (!links.length) return { nodes: [], ribbons: [], maxDepth: 1 };
  const nodes = collectNodes(links, order);
  if (!acyclic(links, nodes)) return cyclicLayout(links, nodes, width, height);

  const hInset = Math.min(margin, (width - flowNodeWidth) / 3);
  const vInset = Math.min(edge, height / 4);
  const layout = sankey<{ name: string }, Record<never, never>>()
    .nodeId(node => node.name).nodeWidth(flowNodeWidth).nodePadding(gap)
    .extent([[hInset, vInset], [width - hInset, height - vInset]]);
  if (fixedOrder) {
    const rank = new Map([...nodes.keys()].map((name, index) => [name, index]));
    layout.nodeSort(null).linkSort((a, b) => {
      const aLink = links[a.index!];
      const bLink = links[b.index!];
      return rank.get(aLink.source)! - rank.get(bLink.source)! || rank.get(aLink.target)! - rank.get(bLink.target)!;
    });
  }
  const rendered = layout({
    nodes: [...nodes.keys()].map(name => ({ name })),
    links: links.map(link => ({ ...link })),
  });
  const layers = [...new Set(rendered.nodes.map(node => node.x0!))].sort((a, b) => a - b);
  for (const item of rendered.nodes) {
    const node = nodes.get(item.name)!;
    node.depth = layers.indexOf(item.x0!);
    node.x = item.x0!;
    node.y = item.y0!;
    node.height = item.y1! - item.y0!;
  }
  const ribbons = rendered.links.map((item, index) => {
    const { source, target, value } = links[index];
    return ribbon(nodes.get(source)!, nodes.get(target)!, value, item.y0!, item.y1!, item.width!);
  });
  return { nodes: [...nodes.values()], ribbons, maxDepth: Math.max(1, layers.length - 1) };
}
