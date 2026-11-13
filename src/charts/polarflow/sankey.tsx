import { useId, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { useChartTheme } from "../theme";
import { nextChartFocus, number, numeric, percent, tone, type Props } from "./shared";
import { sankeyFixtures, type FlowLink } from "./sankey-fixtures";
import styles from "./styles.module.css";
import flow from "./flow.module.css";

type Node = { name: string; depth: number; input: number; output: number; x: number; y: number; height: number; index: number };
type Ribbon = ReturnType<typeof layout>["ribbons"][number];
type FocusItem = { type: "node"; node: Node } | { type: "ribbon"; ribbon: Ribbon; index: number };

const width = 600;
const height = 322;
const nodeWidth = 11;
const nodeValue = (node: Node) => Math.max(node.input, node.output);

function layout(links: FlowLink[], margin: number) {
  const nodes = new Map<string, Node>();
  const get = (name: string) => {
    const existing = nodes.get(name);
    if (existing) return existing;
    const node = { name, depth: 0, input: 0, output: 0, x: 0, y: 0, height: 0, index: nodes.size };
    nodes.set(name, node);
    return node;
  };
  for (const link of links) {
    get(link.source).output += link.value;
    get(link.target).input += link.value;
  }
  // Bound relaxation so caller-supplied cycles cannot loop indefinitely.
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const link of links) {
      const source = get(link.source);
      const target = get(link.target);
      if (source.depth < target.depth || source.depth >= nodes.size - 1) continue;
      target.depth = source.depth + 1;
      changed = true;
    }
    if (!changed) break;
  }
  const maxDepth = Math.max(1, ...Array.from(nodes.values(), node => node.depth));
  const layers = Array.from({ length: maxDepth + 1 }, () => [] as Node[]);
  for (const node of nodes.values()) layers[node.depth].push(node);
  const gap = Math.min(15.5, 140 / Math.max(1, ...layers.map(layer => layer.length)));
  const plotHeight = height - 37;
  const unit = nodes.size ? Math.min(...layers.filter(layer => layer.length).map(layer =>
    (plotHeight - gap * (layer.length - 1)) / layer.reduce((sum, node) => sum + nodeValue(node), 0))) : 0;
  layers.forEach((layer, depth) => {
    const used = layer.reduce((total, node) => total + nodeValue(node) * unit, 0) + gap * (layer.length - 1);
    let y = (height - used) / 2;
    for (const node of layer) {
      node.x = margin + depth / maxDepth * (width - 2 * margin - nodeWidth);
      node.y = y;
      node.height = nodeValue(node) * unit;
      y += node.height + gap;
    }
  });
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();
  const sources = links.slice().sort((a, b) => get(a.target).y - get(b.target).y);
  const targets = links.slice().sort((a, b) => get(a.source).y - get(b.source).y);
  const sourceY = new Map<FlowLink, number>();
  const targetY = new Map<FlowLink, number>();
  for (const link of sources) {
    const source = get(link.source);
    const offset = sourceOffsets.get(link.source) ?? 0;
    sourceY.set(link, source.y + offset);
    sourceOffsets.set(link.source, offset + link.value * unit);
  }
  for (const link of targets) {
    const target = get(link.target);
    const offset = targetOffsets.get(link.target) ?? 0;
    targetY.set(link, target.y + offset);
    targetOffsets.set(link.target, offset + link.value * unit);
  }
  const ribbons = links.map((link) => {
    const source = get(link.source);
    const target = get(link.target);
    const x0 = source.x + nodeWidth;
    const x1 = target.x;
    const sx = x0 + (x1 - x0) * .46;
    const tx = x1 + (x0 - x1) * .46;
    const sy = sourceY.get(link)!;
    const ty = targetY.get(link)!;
    const h = link.value * unit;
    const path = `M ${x0} ${sy} C ${sx} ${sy},${tx} ${ty},${x1} ${ty} L ${x1} ${ty + h} C ${tx} ${ty + h},${sx} ${sy + h},${x0} ${sy + h} Z`;
    return { ...link, source, target, path, x0, x1, y: (sy + ty + h) / 2 };
  });
  return { nodes: layers.flat(), ribbons, maxDepth };
}

function FlowStripe({ id, color, width = 6 }: { id: string; color: string; width?: number }) {
  return <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={width} patternTransform="rotate(43)">
    <rect width={width} height={width} fill={color} fillOpacity=".2" />
    <path d={`M0 0V${width}`} stroke={color} strokeWidth={width * .65} />
  </pattern>;
}

export function Sankey({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const id = example.id;
  const withoutLabels = id === "sankey-no-labels";
  const verticalLabels = id === "sankey-vertical-labels";
  const byCategory = id === "sankey-category-colors";
  const isSingle = id === "sankey-single-color";
  const solid = id === "sankey-solid-links" || isSingle;
  const legendMode = !compact && id === "sankey-legend";
  const fixture = sankeyFixtures[id] ?? sankeyFixtures["sankey-default"];
  const links = useMemo(() => data?.rows?.flatMap((row) => {
    const value = numeric(row.value);
    return typeof row.source === "string" && typeof row.target === "string" && row.source !== row.target && value > 0 ?
      [{ source: row.source, target: row.target, value }] : [];
  }) ?? fixture.links, [data?.rows, fixture]);
  const margin = withoutLabels ? 18 : verticalLabels ? 53 : 91;
  const { nodes, ribbons, maxDepth } = useMemo(() => layout(links, margin), [links, margin]);
  const legend = nodes.filter(node => node.depth === 0);
  const total = legend.reduce((sum, node) => sum + node.output, 0);
  const unit = data?.rows ? "units" : fixture.unit;
  const marks: FocusItem[] = [
    ...nodes.map(node => ({ type: "node" as const, node })),
    ...ribbons.map((ribbon, index) => ({ type: "ribbon" as const, ribbon, index })),
  ];
  const active = marks[hover ?? focus ?? nodes.findIndex(node => node.name === pinned)];
  const activeNode = active?.type === "node" ? active.node : undefined;
  const activeRibbon = active?.type === "ribbon" ? active.ribbon : undefined;
  const color = (node: Node) => tone(theme, isSingle ? 0 : byCategory ? node.depth : fixture.palette?.[node.name] ?? node.index % 5);
  const header = activeNode?.name ?? (activeRibbon ? `${activeRibbon.source.name} → ${activeRibbon.target.name}` : "");
  const description = activeNode ? `${number.format(nodeValue(activeNode))} ${unit}${byCategory ? ` · ${percent(nodeValue(activeNode), total).toFixed(0)}%` : ""}` : activeRibbon ?
    `${number.format(activeRibbon.value)} ${unit}${byCategory ? ` · ${percent(activeRibbon.value, activeRibbon.source.output).toFixed(0)}% of ${activeRibbon.source.name}` : ""}` : "";
  const px = activeNode ? activeNode.x + nodeWidth / 2 : activeRibbon ? (activeRibbon.x0 + activeRibbon.x1) / 2 : width / 2;
  const py = activeNode ? activeNode.y + activeNode.height / 2 : activeRibbon?.y ?? height / 2;
  const reachable = new Set<Node>();
  const downstream = new Set<Ribbon>();
  if (legendMode && activeNode?.depth === 0) {
    const pending = [activeNode];
    while (pending.length) {
      const node = pending.pop()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      for (const ribbon of ribbons) if (ribbon.source === node) {
        downstream.add(ribbon);
        pending.push(ribbon.target);
      }
    }
  }
  const stripeColor = (link: Ribbon) => {
    if (id === "sankey-patterns" && link.target.depth === maxDepth) return color(link.target);
    if (id !== "sankey-pattern-lines") return undefined;
    if (link.target.name === "Upgraded") return "#22a67c";
    if (link.target.name === "Churned") return "#dc5870";
    return undefined;
  };
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      setHover(null); setFocus(null); setPinned(null); return;
    }
    if ((event.key === "Enter" || event.key === " ") && legendMode && activeNode?.depth === 0) {
      event.preventDefault(); setPinned(pinned === activeNode.name ? null : activeNode.name); return;
    }
    const next = nextChartFocus(event.key, focus, marks.length);
    if (next !== undefined) {
      event.preventDefault();
      setHover(null);
      setFocus(next);
    }
  }
  return <div className={styles.frame}>
    {legendMode && <ToggleGroup className={flow.sankeyLegend} aria-label="Campaigns" value={pinned ? [pinned] : []}
      onValueChange={(value) => setPinned(value[0] ?? null)}>
      {legend.map(node => <Toggle key={node.name} value={node.name}
        data-active={activeNode === node} onPointerEnter={() => setHover(nodes.indexOf(node))} onPointerLeave={() => setHover(null)}
        onFocus={() => setFocus(nodes.indexOf(node))} onBlur={() => setFocus(null)}>
        <i style={{ backgroundColor: color(node) }} />{node.name}
      </Toggle>)}
    </ToggleGroup>}
    <div className={styles.graph}>
      <svg className={styles.native} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={example.title}
        tabIndex={compact ? undefined : 0} onKeyDown={key} onFocus={() => { if (marks.length) setFocus(0); }} onBlur={() => setFocus(null)} onPointerLeave={() => setHover(null)}>
        <defs>{ribbons.map((link, index) => {
          const stripe = stripeColor(link);
          return <g key={index}>
            {!solid && !stripe && <linearGradient id={`${uid}-link-${index}`} gradientUnits="userSpaceOnUse" x1={link.x0} x2={link.x1}>
              <stop offset="0" stopColor={color(link.source)} /><stop offset="1" stopColor={color(link.target)} />
            </linearGradient>}
            {stripe && <FlowStripe id={`${uid}-stripe-${index}`} color={stripe} width={id === "sankey-pattern-lines" ? 5 : 7} />}
          </g>;
        })}</defs>
        {ribbons.map((link, index) => {
          const highlighted = activeRibbon === link || (activeNode && (activeNode === link.source || activeNode === link.target || downstream.has(link)));
          const stripe = stripeColor(link);
          const fill = stripe ? `url(#${uid}-stripe-${index})` : solid ? color(link.source) : `url(#${uid}-link-${index})`;
          return <path key={index} d={link.path} fill={fill}
            data-flow-source={link.source.name} data-flow-target={link.target.name} data-flow-kind={stripe ? "hatch" : solid ? "solid" : "gradient"}
            data-active={Boolean(highlighted)} opacity={!active ? isSingle ? .3 : .51 : highlighted ? .82 : .13} className={flow.sankeyMark}
            onPointerEnter={() => setHover(nodes.length + index)} onPointerLeave={() => setHover(null)} onPointerDown={() => setFocus(nodes.length + index)} />;
        })}
        {nodes.map((node, index) => {
          const outgoing = node.depth < maxDepth;
          const value = nodeValue(node);
          const labelX = node.x + (outgoing ? -7 : nodeWidth + 7);
          const labelY = node.y + node.height / 2;
          const selected = activeNode === node || activeRibbon?.source === node || activeRibbon?.target === node || reachable.has(node);
          const rotation = verticalLabels ? `rotate(-90 ${labelX} ${labelY})` : undefined;
          return <g key={node.name} className={flow.sankeyMark} data-flow-node={node.name} data-active={selected} opacity={!active || selected ? 1 : .43}
            onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)} onPointerDown={() => setFocus(index)}
            onClick={legendMode && node.depth === 0 ? () => setPinned(pinned === node.name ? null : node.name) : undefined}>
            <rect x={node.x} y={node.y} width={nodeWidth} height={node.height} rx="2.7" fill={color(node)} />
            {!withoutLabels && <g data-flow-label="" transform={rotation} fill={theme.text} textAnchor={verticalLabels ? "middle" : outgoing ? "end" : "start"}>
              <text x={labelX} y={labelY - 1} fontSize="8.5" fontWeight={selected ? 700 : 510}>{node.name}</text>
              <text x={labelX} y={labelY + 9} fontSize="7.3" fill={theme.muted}>{number.format(value)} {unit}</text>
            </g>}
          </g>;
        })}
      </svg>
      {!compact && active && <div className={flow.sankeyTooltip} style={{
        "--flow-x": `${Math.min(87, Math.max(13, px / width * 100))}%`,
        "--flow-y": `${Math.min(89, Math.max(11, py / height * 100))}%`,
      } as CSSProperties} role="tooltip"><strong>{header}</strong><span>{description}</span></div>}
      {!compact && <div className={styles.screenReader} role="status" aria-atomic="true">{active && `${header}, ${description}`}</div>}
    </div>
  </div>;
}
