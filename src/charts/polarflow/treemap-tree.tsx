import { Button } from "@ui-sdk/react/button";
import { useId, useState, type KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { dollars, number, short, tone, type Props } from "./shared";
import { hierarchyShare, selectMark, useChartLoading } from "./hierarchy-interaction";
import type { SunburstNode } from "./upstream/sunburst-data";
import { sumValues } from "./upstream/sunburst-layout";
import { readHierarchy, treeFixtures, treemapFixtures } from "./treemap-tree-fixtures";
import styles from "./styles.module.css";
import charts from "./hierarchy-charts.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const width = 640;
const height = 340;
type Box = { x: number; y: number; w: number; h: number };
type Tile = { node: SunburstNode; path: number[]; box: Box; color: number; lightness: number; group: boolean };

function layoutTiles(nodes: SunburstNode[], box: Box): { node: SunburstNode; box: Box; index: number }[] {
  if (box.w <= 0 || box.h <= 0) return [];
  const entries = nodes.map((node, index) => ({ node, index, value: sumValues(node) })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  const total = entries.reduce((value, item) => value + item.value, 0);
  if (!total) return [];
  const areaPerValue = box.w * box.h / total;
  const tiles: ReturnType<typeof layoutTiles> = [];
  let { x, y, w, h } = box;
  const worst = (first: number, last: number, area: number, side: number) => Math.max(side * side * first / (area * area), area * area / (side * side * last));
  for (let start = 0; start < entries.length;) {
    const vertical = w > h;
    const side = vertical ? h : w;
    if (side < .001) break;
    const first = entries[start].value * areaPerValue;
    let end = start + 1;
    let area = first;
    while (end < entries.length) {
      const next = entries[end].value * areaPerValue;
      const previous = entries[end - 1].value * areaPerValue;
      if (worst(first, previous, area, side) < worst(first, next, area + next, side)) break;
      area += next;
      end++;
    }
    const length = area / side;
    let offset = 0;
    for (const { node, index, value } of entries.slice(start, end)) {
      const span = value * areaPerValue / length;
      tiles.push({ node, index, box: vertical ? { x, y: y + offset, w: length, h: span } : { x: x + offset, y, w: span, h: length } });
      offset += span;
    }
    if (vertical) { x += length; w -= length; } else { y += length; h -= length; }
    start = end;
  }
  return tiles;
}

function visibleTiles(root: SunburstNode, path: number[], bounds: Box, compact: boolean | undefined) {
  const inset = 2;
  const header = compact ? 15 : 23;
  return layoutTiles(root.children ?? [], bounds).flatMap(({ node, index, box }) => {
    const group = !!node.children?.length;
    const color = path[0] ?? index;
    const tile: Tile = { node, path: [...path, index], box, color, group, lightness: group ? 12 : 65 };
    if (!group) return [tile];
    const children = layoutTiles(node.children ?? [], { x: box.x + inset, y: box.y + header, w: box.w - inset * 2, h: box.h - header - inset });
    return [tile, ...children.map(({ node: child, index: childIndex, box: childBox }, order): Tile => ({ node: child, path: [...path, index, childIndex], box: childBox, color, group: false, lightness: 63 - order * 7 }))];
  });
}

function trimLabel(text: string, maxWidth: number, fontSize: number) {
  const length = Math.floor(maxWidth / (fontSize * .54));
  return length > 1 && text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function pathNodes(root: SunburstNode, indices: number[]) {
  const nodes = [root];
  for (const index of indices) {
    const child = nodes.at(-1)?.children?.[index];
    if (!child) break;
    nodes.push(child);
  }
  return nodes;
}

export function Treemap({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, hasDemo, control } = useChartLoading(example.id, compact);
  const [path, setPath] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId();
  const portfolio = example.id === "treemap-portfolio";
  const bundle = example.id === "treemap-drilldown";
  const fixture = treemapFixtures[example.id] ?? treemapFixtures["treemap-default"];
  const root = data?.rows ? { name: fixture.name, children: readHierarchy(data.rows) } : fixture;
  const levels = pathNodes(root, path);
  const current = levels.at(-1) ?? root;
  const realPath = path.slice(0, levels.length - 1);
  const back = realPath.length > 0;
  const total = sumValues(root);
  const bounds = { x: 2, y: back ? 27 : 2, w: width - 4, h: height - (back ? 29 : 4) };
  const tiles = visibleTiles(current, realPath, bounds, compact);
  const active = hover === null ? undefined : tiles[hover];
  const format = (value: number, long = false) => bundle ? `${number.format(value)} kB` : hasDemo ? value >= 1000 ? `${number.format(value / 1000)} TB` : `${number.format(value)} GB` :
    data?.rows ? number.format(value) : (long ? dollars : usd).format(value).replace(/K$/, "k");
  const focusPath = (next: number[]) => { setHover(null); setPath(next); };
  function zoom(tile: Tile) { if (!portfolio && tile.node.children?.length) focusPath(tile.path); }
  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && back) { event.preventDefault(); event.stopPropagation(); focusPath(realPath.slice(0, -1)); return; }
    if ((event.key === "Enter" || event.key === " ") && active?.node.children?.length && !portfolio) { event.preventDefault(); zoom(active); return; }
    selectMark(event, hover, tiles.length, setHover);
  }
  const selected = active ? pathNodes(root, active.path).slice(1).map(node => node.name).join(portfolio ? " · " : " / ") : "";
  return <div className={styles.frame}>
    {control}
    {back && !compact && !loading && <nav className={styles.controls} aria-label="Treemap path">
      {levels.map((level, index) => <Button key={index} className={styles.control} disabled={index === levels.length - 1}
        onClick={() => focusPath(realPath.slice(0, index))}>{level.name}</Button>)}
    </nav>}
    <div className={styles.graph}>
      <svg className={`${styles.native} ${charts.plot}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={example.title}
        aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0} onKeyDown={onKey} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}>
        {back && !loading && <g className={charts.mark} onClick={() => focusPath(realPath.slice(0, -1))}>
          <rect x="2" y="2" width={width - 4} height="21" rx="4" fill={theme.grid} />
          <text x="12" y="16" fontSize="11" fill={theme.text}>‹ {levels.map(node => node.name).join(" / ")}</text>
        </g>}
        {loading ? layoutTiles((fixture.children ?? []).flatMap(node => node.children ?? [node]), bounds).map(({ box }, index) => <rect key={`s-${index}`} data-mark="treemap-bone" x={box.x + 1} y={box.y + 1}
          width={Math.max(0, box.w - 2)} height={Math.max(0, box.h - 2)} rx="5" fill={theme.grid} className={charts.bone} style={{ animationDelay: `${index * 45}ms` }} />) : tiles.map((tile, index) => {
          const { box, node, color, group } = tile;
          const value = sumValues(node);
          const tint = tone(theme, color, node.color);
          const focus = hover === index;
          const interactive = !portfolio && !!node.children?.length;
          const colorMix = `color-mix(in oklab, ${tint} ${focus ? Math.min(84, tile.lightness + 17) : tile.lightness}%, ${theme.surface})`;
          const fontSize = group ? 11 : 10.5;
          const canLabel = (!portfolio || !group) && box.w > 28 && box.h > 17;
          return <g key={tile.path.join(".")} data-mark="treemap-tile" data-node={node.name} data-group={group} data-active={focus}
            className={`${interactive && !compact ? charts.mark : ""} ${hasDemo ? charts.reveal : ""}`}
            style={hasDemo ? { animationDelay: `${index * 15}ms` } : undefined}
            onPointerEnter={!compact ? () => setHover(index) : undefined} onClick={interactive && !compact ? () => zoom(tile) : undefined}>
            <clipPath id={`${clip}-${index}`}><rect x={box.x + 2} y={box.y + 2} width={Math.max(0, box.w - 4)} height={Math.max(0, box.h - 4)} /></clipPath>
            <rect x={box.x + 1} y={box.y + 1} width={Math.max(0, box.w - 2)} height={Math.max(0, box.h - 2)} rx={group ? 4 : 3}
              fill={colorMix} stroke={tint} strokeOpacity={focus ? .92 : .45} />
            {canLabel && <g clipPath={`url(#${clip}-${index})`}>
              <text x={box.x + 6} y={box.y + 14} fontSize={fontSize} fontWeight={group ? 650 : 540} fill={theme.text}>
                {trimLabel(node.name, box.w - 10, fontSize)}</text>
              {group ? box.w > 79 && <text x={box.x + box.w - 6} y={box.y + 14} fontSize="9.5" textAnchor="end" fill={theme.muted}>{format(value)}</text> :
                box.h > 27 && <text x={box.x + 6} y={box.y + 26} fontSize="9.5" fill={theme.text}>{format(value)}</text>}
            </g>}
          </g>;
        })}
      </svg>
      {!compact && !loading && active && <div className={`${charts.tip} ${charts.floating}`} role="status"><strong>{selected}</strong>
        <span>{bundle ? "Size" : portfolio ? "Value" : hasDemo ? "Storage" : "Spend"}</span><b>{format(sumValues(active.node), portfolio)}</b>
        <span>{portfolio ? "Share of portfolio" : `Share of ${root.name}`}</span><b>{hierarchyShare(sumValues(active.node), total)}</b>
      </div>}
    </div>
    {!compact && <p className={styles.hint}>{loading ? "Fetching storage…" : `${format(total)} ${bundle ? "in all · click a folder to open it" : portfolio ? "total portfolio" : hasDemo ? "stored across ten buckets" : "across five teams"}`}</p>}
  </div>;
}

type TreeMark = { id: string; path: string[]; node: SunburstNode; parent: TreeMark | undefined; depth: number; group: number; order: number; x: number; y: number; folded: number };

function descendants(node: SunburstNode): number {
  return node.children?.reduce((total, child) => total + 1 + descendants(child), 0) ?? 0;
}

function treeLayout(root: SunburstNode, hidden: ReadonlySet<string>, mode: "left" | "top" | "radial") {
  const nodes: TreeMark[] = [];
  let order = 0;
  let maxDepth = 0;
  function visit(node: SunburstNode, path: string[], ids: number[], group: number, parent?: TreeMark): TreeMark {
    const depth = ids.length;
    const id = ids.join(".");
    maxDepth = Math.max(maxDepth, depth);
    const folded = hidden.has(id) ? descendants(node) : 0;
    const mark: TreeMark = { id, node, path, parent, depth, group, order: 0, x: 0, y: 0, folded };
    nodes.push(mark);
    const children = folded ? [] : node.children ?? [];
    const childMarks = children.map((child, index) => visit(child, [...path, child.name], [...ids, index], depth ? group : index, mark));
    mark.order = childMarks.length ? (childMarks[0].order + childMarks.at(-1)!.order) / 2 : order++;
    return mark;
  }
  visit(root, [root.name], [], -1);
  const radial = mode === "radial";
  const viewWidth = radial ? 390 : width;
  const viewHeight = radial ? 390 : height;
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  for (const node of nodes) {
    const depth = node.depth / Math.max(maxDepth, 1);
    const across = order > 1 ? node.order / (order - 1) : .5;
    if (radial) {
      const angle = (node.order + .5) / Math.max(1, order) * Math.PI * 2 - Math.PI / 2;
      node.x = cx + Math.cos(angle) * depth * 132;
      node.y = cy + Math.sin(angle) * depth * 132;
    } else if (mode === "top") {
      node.x = 53 + across * (viewWidth - 106);
      node.y = 22 + depth * (viewHeight - 57);
    } else {
      node.x = 31 + depth * (viewWidth - 164);
      node.y = 21 + across * (viewHeight - 44);
    }
  }
  return { nodes, viewWidth, viewHeight, cx, cy };
}

function treeEdge(node: TreeMark, parent: TreeMark, mode: "left" | "top" | "radial", cx: number, cy: number) {
  if (mode === "radial") {
    const parentAngle = Math.atan2(parent.y - cy, parent.x - cx);
    const childAngle = Math.atan2(node.y - cy, node.x - cx);
    const middleRadius = (Math.hypot(parent.x - cx, parent.y - cy) + Math.hypot(node.x - cx, node.y - cy)) / 2;
    return `M${parent.x},${parent.y} C${cx + Math.cos(parentAngle) * middleRadius},${cy + Math.sin(parentAngle) * middleRadius} ${cx + Math.cos(childAngle) * middleRadius},${cy + Math.sin(childAngle) * middleRadius} ${node.x},${node.y}`;
  }
  if (mode === "top") {
    const middle = (parent.y + node.y) / 2;
    return `M${parent.x},${parent.y} C${parent.x},${middle} ${node.x},${middle} ${node.x},${node.y}`;
  }
  const middle = (parent.x + node.x) / 2;
  return `M${parent.x},${parent.y} C${middle},${parent.y} ${middle},${node.y} ${node.x},${node.y}`;
}

export function Tree({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, hasDemo, control } = useChartLoading(example.id, compact);
  const mode = example.id === "tree-radial" ? "radial" : example.id === "tree-vertical" ? "top" : "left";
  const fixture = treeFixtures[example.id] ?? treeFixtures["tree-default"];
  const root = data?.rows ? { name: fixture.name, children: readHierarchy(data.rows) } : fixture;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(mode === "top" && !data ? ["1"] : []));
  const [hover, setHover] = useState<number | null>(null);
  const { nodes, viewWidth, viewHeight, cx, cy } = treeLayout(root, collapsed, mode);
  const active = hover === null ? undefined : nodes[hover];
  const label = mode === "top" ? "Views" : mode === "radial" ? "Installs" : hasDemo ? "Pages" : "Headcount";
  const unit = mode === "top" ? "k views" : mode === "radial" ? "k a week" : hasDemo ? " pages" : " people";
  function toggle(mark: TreeMark) {
    if (!mark.node.children?.length) return;
    setCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(mark.id)) next.delete(mark.id); else next.add(mark.id);
      return next;
    });
  }
  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if ((event.key === "Enter" || event.key === " ") && active?.node.children?.length) { event.preventDefault(); toggle(active); return; }
    selectMark(event, hover, nodes.length, setHover);
  }
  return <div className={styles.frame}>
    {control}
    <div className={styles.graph}>
      <svg className={`${styles.native} ${charts.plot}`} viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-roledescription="chart" aria-label={example.title}
        aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)} onKeyDown={onKey}>
        {nodes.map((mark, index) => {
          if (!mark.parent) return null;
          const near = !active || active.path.slice(0, mark.path.length).join("/") === mark.path.join("/") || mark.parent.id === active.id;
          return <path key={mark.id} data-mark="tree-edge" data-node={mark.node.name} d={treeEdge(mark, mark.parent, mode, cx, cy)} fill="none" pathLength="1"
            stroke={loading ? theme.grid : tone(theme, mark.group)} strokeWidth={mode === "radial" ? 1.2 : 1.6} opacity={near ? .62 : .2}
            className={loading ? charts.bone : hasDemo ? charts.draw : undefined} style={hasDemo ? { animationDelay: `${index * 19}ms` } : undefined} />;
        })}
        {nodes.map((mark, index) => {
          const { node, x, y, folded, group } = mark;
          const branch = !!node.children?.length;
          const color = group < 0 ? theme.text : tone(theme, group, node.color);
          const radialLeft = mode === "radial" && x < cx;
          const textX = x + (mode === "top" || mode === "radial" && group < 0 ? 0 : radialLeft ? -9 : 9);
          const textY = y + (mode === "top" ? -10 : mode === "radial" && group < 0 ? -10 : 3.5);
          return <g key={mark.id} data-mark={loading ? "tree-bone" : "tree-node"} data-node={node.name} data-folded={folded || undefined}
            className={`${branch && !compact && !loading ? charts.mark : ""} ${loading ? charts.bone : hasDemo ? charts.reveal : ""}`}
            style={hasDemo ? { animationDelay: `${index * 19}ms` } : undefined}
            onPointerEnter={!loading && !compact ? () => setHover(index) : undefined}
            onClick={branch && !loading && !compact ? () => toggle(mark) : undefined}>
            <circle cx={x} cy={y} r={group < 0 ? 6 : active === mark ? 6 : 4.5} fill={loading ? theme.grid : branch && !folded && group >= 0 ? theme.surface : color} stroke={loading ? theme.grid : color} strokeWidth="1.4" />
            {loading ? <rect x={x + 10} y={y - 3} width={Math.min(78, 17 + node.name.length * 3)} height="6" rx="3" fill={theme.grid} /> :
              <text x={textX} y={textY} textAnchor={textX === x ? "middle" : radialLeft ? "end" : "start"} fill={theme.text}
                fontSize={mode === "radial" ? 9 : 11} fontWeight={branch ? 600 : 450} stroke={theme.surface} strokeWidth="1.8" paintOrder="stroke">{node.name}{folded ? ` +${folded}` : ""}</text>}
          </g>;
        })}
      </svg>
      {!compact && !loading && active && <div className={`${charts.tip} ${charts.floating}`} role="status"><strong>{active.path.slice(active.depth ? 1 : 0).join(" / ")}</strong>
        <span>{label}</span><b>{number.format(sumValues(active.node))}{unit}</b>
        {!!active.folded ? <><span>Folded</span><b>{active.folded} nodes</b></> : !!active.node.children?.length ? <><span>Children</span><b>{active.node.children.length}</b></> : null}
      </div>}
    </div>
    {!compact && <p className={styles.hint}>{loading ? "Fetching the site map…" : mode === "radial" ? `${short.format(sumValues(root) * 1000)} weekly installs across ${root.children?.length ?? 0} categories` : `${number.format(sumValues(root))}${unit} across ${root.children?.length ?? 0} groups`}</p>}
  </div>;
}
