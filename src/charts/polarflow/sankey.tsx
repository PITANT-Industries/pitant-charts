import { useId, useState } from "react";
import { useChartTheme } from "../theme";
import { Legend, number, numeric, Pattern, percent, tone, type Props } from "./shared";
import styles from "./styles.module.css";

type Link = { source: string; target: string; value: number };
type Node = { name: string; depth: number; in: number; out: number; x: number; y: number; height: number; index: number };

const site: Link[] = [
  { source: "Organic", target: "Home", value: 120 }, { source: "Organic", target: "Pricing", value: 69 },
  { source: "Direct", target: "Home", value: 83 }, { source: "Email", target: "Product", value: 54 },
  { source: "Partner", target: "Docs", value: 55 }, { source: "Social", target: "Blog", value: 45 },
  { source: "Ads", target: "Pricing", value: 50 }, { source: "Home", target: "Subscribed", value: 63 },
  { source: "Home", target: "Bounced", value: 88 }, { source: "Home", target: "Signed up", value: 52 },
  { source: "Pricing", target: "Subscribed", value: 77 }, { source: "Pricing", target: "Signed up", value: 42 },
  { source: "Product", target: "Signed up", value: 35 }, { source: "Product", target: "Bounced", value: 19 },
  { source: "Docs", target: "Subscribed", value: 35 }, { source: "Docs", target: "Signed up", value: 20 },
  { source: "Blog", target: "Bounced", value: 32 }, { source: "Blog", target: "Signed up", value: 13 },
];
const conversion: Link[] = [
  { source: "Organic", target: "Starter", value: 132 }, { source: "Organic", target: "Team", value: 85 },
  { source: "Email", target: "Starter", value: 52 }, { source: "Email", target: "Team", value: 39 },
  { source: "Partner", target: "Enterprise", value: 56 }, { source: "Partner", target: "Team", value: 33 },
  { source: "Starter", target: "Upgraded", value: 116 }, { source: "Starter", target: "Churned", value: 68 },
  { source: "Team", target: "Upgraded", value: 102 }, { source: "Team", target: "Churned", value: 55 },
  { source: "Enterprise", target: "Upgraded", value: 43 }, { source: "Enterprise", target: "Churned", value: 13 },
];
const support: Link[] = [
  { source: "Chat", target: "Resolved", value: 124 }, { source: "Chat", target: "Escalated", value: 32 },
  { source: "Email", target: "Resolved", value: 78 }, { source: "Email", target: "Escalated", value: 44 },
  { source: "Phone", target: "Resolved", value: 45 }, { source: "Phone", target: "Closed", value: 23 },
];

function layout(links: Link[], margin: number) {
  const nodes = new Map<string, Node>();
  const get = (name: string) => {
    const existing = nodes.get(name);
    if (existing) return existing;
    const node = { name, depth: 0, in: 0, out: 0, x: 0, y: 0, height: 0, index: nodes.size };
    nodes.set(name, node);
    return node;
  };
  for (const link of links) {
    get(link.source).out += link.value;
    get(link.target).in += link.value;
  }
  // Cap depth at the number of nodes so cycles in consumer data do not create an unbounded traversal.
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
  const layers = Array.from({ length: maxDepth + 1 }, (_, depth) => Array.from(nodes.values()).filter(node => node.depth === depth));
  const gap = Math.min(12, 155 / Math.max(1, ...layers.map(layer => layer.length)));
  const totalHeight = 199;
  const value = (node: Node) => Math.max(node.in, node.out);
  const unit = Math.min(...layers.filter(layer => layer.length).map(layer =>
    (totalHeight - gap * (layer.length - 1)) / Math.max(1, layer.reduce((sum, node) => sum + value(node), 0))));
  layers.forEach((layer, depth) => {
    const height = layer.reduce((total, node) => total + value(node) * unit, 0) + gap * (layer.length - 1);
    let y = (240 - height) / 2;
    for (const node of layer) {
      node.x = margin + depth / maxDepth * (420 - 2 * margin - 11);
      node.y = y;
      node.height = value(node) * unit;
      y += node.height + gap;
    }
  });
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();
  const ribbons = links.map((link) => {
    const source = get(link.source);
    const target = get(link.target);
    const x0 = source.x + 11;
    const x1 = target.x;
    const middle = (x0 + x1) / 2;
    const sy = source.y + (sourceOffsets.get(source.name) ?? 0);
    const ty = target.y + (targetOffsets.get(target.name) ?? 0);
    const h = link.value * unit;
    sourceOffsets.set(source.name, sy + h - source.y);
    targetOffsets.set(target.name, ty + h - target.y);
    const path = `M ${x0} ${sy} C ${middle} ${sy},${middle} ${ty},${x1} ${ty} L ${x1} ${ty + h} C ${middle} ${ty + h},${middle} ${sy + h},${x0} ${sy + h} Z`;
    return { ...link, source, target, path, x0, x1 };
  });
  return { nodes: [...nodes.values()], ribbons, maxDepth };
}

export function Sankey({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hover ?? pinned;
  const id = example.id;
  const withoutLabels = id === "sankey-no-labels";
  const verticalLabels = id === "sankey-vertical-labels";
  const pattern = id === "sankey-patterns" || id === "sankey-pattern-lines";
  const supplied = data?.rows?.flatMap((row) => {
    const value = numeric(row.value);
    return typeof row.source === "string" && typeof row.target === "string" && row.source !== row.target && Number.isFinite(value) && value > 0 ?
      [{ source: row.source, target: row.target, value }] : [];
  });
  const links = supplied ?? (withoutLabels ? support : pattern || id === "sankey-category-colors" ? conversion : site);
  const { nodes, ribbons, maxDepth } = layout(links, withoutLabels ? 22 : verticalLabels ? 28 : 72);
  const color = (node: Node) => tone(theme, id === "sankey-single-color" ? 0 : id === "sankey-category-colors" ? node.depth : node.index);
  const legend = nodes.filter(node => node.depth === 0);
  return <div className={styles.frame}>
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      <defs>{ribbons.map((link, index) => <g key={index}>
        <linearGradient id={`${uid}-link-${index}`} gradientUnits="userSpaceOnUse" x1={link.x0} x2={link.x1}>
          <stop offset="0" stopColor={color(link.source)} /><stop offset="1" stopColor={color(link.target)} />
        </linearGradient>
        <Pattern id={`${uid}-pattern-${index}`} color={id === "sankey-pattern-lines" ? link.target.name === "Upgraded" ? "#23a47d" : "#df657b" : color(link.target)} variant={id === "sankey-pattern-lines" ? 1 : link.target.index % 5} />
      </g>)}</defs>
      {ribbons.map((link, index) => {
        const selected = active === link.source.index || active === link.target.index;
        const fill = pattern ? `url(#${uid}-pattern-${index})` :
          id === "sankey-solid-links" || id === "sankey-single-color" ? color(link.source) : `url(#${uid}-link-${index})`;
        return <path key={index} d={link.path} fill={fill} opacity={active === null ? id === "sankey-single-color" ? .3 : .55 : selected ? .83 : .15}
          tabIndex={compact ? undefined : 0} aria-label={`${link.source.name} to ${link.target.name}: ${link.value}`}
          onMouseEnter={() => setHover(link.source.index)} onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(link.source.index)} onBlur={() => setHover(null)}>
          <title>{`${link.source.name} → ${link.target.name}: ${number.format(link.value)} (${percent(link.value, link.source.out).toFixed(0)}% of source)`}</title>
        </path>;
      })}
      {nodes.map(node => {
        const outgoing = node.depth < maxDepth;
        return <g key={node.name} tabIndex={compact ? undefined : 0}
          onMouseEnter={() => setHover(node.index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(node.index)} onBlur={() => setHover(null)}>
          <title>{`${node.name} · ${number.format(Math.max(node.in, node.out))}`}</title>
          <rect x={node.x} y={node.y} width="11" height={node.height} rx="2" fill={color(node)} />
          {!withoutLabels && <text x={node.x + (outgoing ? -4 : 15)} y={node.y + node.height / 2 + 3}
            textAnchor={outgoing ? "end" : "start"} fontSize="8.5" fontWeight={active === node.index ? 700 : 400} fill={theme.text}
            transform={verticalLabels ? `rotate(-90 ${node.x + (outgoing ? -4 : 15)} ${node.y + node.height / 2 + 3})` : undefined}>
            {node.name}{verticalLabels ? ` ${Math.max(node.in, node.out)}` : ""}
          </text>}
        </g>;
      })}
    </svg>
    {!compact && id === "sankey-legend" && <Legend theme={theme} items={legend.map(node => ({ name: node.name, value: node.out, color: color(node) }))}
      active={active === null ? null : legend.findIndex(node => node.index === active)}
      onActive={(index) => setHover(index === null ? null : legend[index]?.index ?? null)}
      onClick={(index) => setPinned(pinned === legend[index]?.index ? null : legend[index]?.index ?? null)} />}
  </div>;
}
