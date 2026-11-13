import { Button } from "@ui-sdk/react/button";
import { useId, useState, type KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { demoTreeLayout, treePlaceholderLabels, type TreeMark } from "./tree-layout";
import detail from "./tree-network-detail.module.css";
import { dollars, number, short, tone, type Props } from "./shared";
import { hierarchyShare, selectMark, useChartLoading, usePlotSize } from "./hierarchy-interaction";
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
  for (let start = 0; start < entries.length;) {
    const vertical = w > h;
    const side = vertical ? h : w;
    if (side < .001) break;
    const ratio = vertical ? 1.4 : 1;
    const spanRatio = side * side * ratio;
    const worst = (first: number, last: number, area: number) => Math.max(spanRatio * first / (area * area), area * area / (spanRatio * last));
    const first = entries[start].value * areaPerValue;
    let end = start + 1;
    let area = first;
    while (end < entries.length) {
      const next = entries[end].value * areaPerValue;
      const previous = entries[end - 1].value * areaPerValue;
      if (worst(first, previous, area) < worst(first, next, area + next)) break;
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
  const inset = 3;
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
  const size = usePlotSize<SVGSVGElement>(width, height);
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
  const bounds = { x: 0, y: back ? 27 : 0, w: size.width, h: Math.max(0, size.height - (back ? 27 : 0)) };
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
    <div className={`${styles.graph} ${charts.measuredGraph}`}>
      <svg ref={size.plot} className={`${styles.native} ${charts.plot}`} viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-roledescription="chart" aria-label={example.title}
        aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0} onKeyDown={onKey} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}>
        {back && !loading && <g className={charts.mark} onClick={() => focusPath(realPath.slice(0, -1))}>
          <rect x="2" y="2" width={Math.max(0, size.width - 4)} height="21" rx="4" fill={theme.grid} />
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

function descendants(node: SunburstNode): number {
  return node.children?.reduce((total, child) => total + 1 + descendants(child), 0) ?? 0;
}

function treeLayout(root: SunburstNode, hidden: ReadonlySet<string>, mode: "left" | "top" | "radial", viewWidth: number, viewHeight: number) {
  const nodes: TreeMark[] = [];
  let order = 0;
  let maxDepth = 0;
  function visit(node: SunburstNode, path: string[], ids: number[], group: number, parent?: TreeMark): TreeMark {
    const depth = ids.length;
    const id = ids.join(".");
    maxDepth = Math.max(maxDepth, depth);
    const folded = hidden.has(id) ? descendants(node) : 0;
    const mark: TreeMark = { id, node, path, parent, depth, group, order: 0, angle: 0, x: 0, y: 0, folded };
    nodes.push(mark);
    const children = folded ? [] : node.children ?? [];
    const childMarks = children.map((child, index) => visit(child, [...path, child.name], [...ids, index], depth ? group : index, mark));
    mark.order = childMarks.length ? (childMarks[0].order + childMarks.at(-1)!.order) / 2 : order++;
    return mark;
  }
  visit(root, [root.name], [], -1);
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const shortSide = Math.min(viewWidth, viewHeight);
  const radius = Math.max(shortSide / 2 - 78.4, shortSide * .19);
  for (const node of nodes) {
    const depth = node.depth / Math.max(maxDepth, 1);
    const across = order > 1 ? node.order / (order - 1) : .5;
    if (mode === "radial") {
      node.angle = node.order / Math.max(1, order) * Math.PI * 2 - Math.PI / 2;
      node.x = cx + Math.cos(node.angle) * depth * radius;
      node.y = cy + Math.sin(node.angle) * depth * radius;
    } else if (mode === "top") {
      node.x = 53 + across * (viewWidth - 106);
      node.y = 22 + depth * (viewHeight - 57);
    } else {
      node.x = 31 + depth * (viewWidth - 164);
      node.y = 21 + across * (viewHeight - 44);
    }
  }
  return { nodes, cx, cy };
}

function treeEdge(node: TreeMark, parent: TreeMark, mode: "left" | "top" | "radial", cx: number, cy: number) {
  if (mode === "radial") {
    const parentAngle = parent.angle;
    const childAngle = node.angle;
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
  const [activeId, setActive] = useState<string | null>(null);
  const size = usePlotSize<SVGSVGElement>(448, 448);
  const reference = !data && !compact;
  const viewWidth = reference || mode === "radial" ? size.width : width;
  const viewHeight = reference || mode === "radial" ? size.height : height;
  const { nodes, cx, cy } = reference
    ? demoTreeLayout(root, collapsed, mode, viewWidth, viewHeight, loading)
    : treeLayout(root, collapsed, mode, viewWidth, viewHeight);
  const index = nodes.findIndex(mark => mark.id === activeId);
  const active = nodes[index];
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
    if ((event.key === "Enter" || event.key === " ") && active?.node.children?.length) {
      event.preventDefault();
      toggle(active);
      return;
    }
    selectMark(event, index < 0 ? null : index, nodes.length, next => setActive(next === null ? null : nodes[next].id));
  }

  function near(mark: TreeMark) {
    if (!active) return true;
    const length = Math.min(mark.path.length, active.path.length);
    return mark.path.slice(0, length).every((name, index) => name === active.path[index]);
  }

  const activeColor = active && active.group >= 0 ? tone(theme, active.group, active.node.color) : theme.muted;
  const rows = active ? [
    { name: label, value: `${reference ? sumValues(active.node) : number.format(sumValues(active.node))}${unit}`, color: activeColor },
    ...(active.folded ? [{ name: "Folded", value: `${active.folded} nodes`, color: activeColor }]
      : active.node.children?.length ? [{ name: "Children", value: active.node.children.length, color: activeColor }] : []),
  ] : [];
  const tipOnRight = active && active.x + 176 < viewWidth;
  const tipTop = active ? Math.max(0, Math.min(viewHeight - (rows.length === 2 ? 86 : 62), active.y - (rows.length === 2 ? 43 : 31))) : 0;

  return <div className={`${styles.frame} ${reference ? detail.detailFrame : ""}`}>
    {control}
    <div className={`${styles.graph} ${reference ? detail.treeGraph : ""}`} data-mode={mode}>
      <svg ref={reference || mode === "radial" ? size.plot : undefined} className={`${styles.native} ${charts.plot}`} viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-roledescription="chart" aria-label={example.title}
        aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0} onBlur={() => setActive(null)} onPointerLeave={event => {
          if (event.pointerType !== "touch") setActive(null);
        }} onKeyDown={onKey}>
        {nodes.map((mark, index) => {
          if (!mark.parent) return null;
          const color = tone(theme, mark.group);
          return <path key={mark.id} data-mark="tree-edge" data-node={mark.node.name} d={treeEdge(mark, mark.parent, mode, cx, cy)} fill="none" pathLength="1"
            stroke={loading ? reference ? theme.text : theme.grid : reference || mode === "radial" ? `color-mix(in oklab, ${color} 55%, ${theme.surface})` : color}
            strokeWidth={reference || mode === "radial" ? 1.5 : 1.6} strokeOpacity={loading && reference ? .2 : undefined}
            opacity={loading && reference ? .7 : near(mark) ? reference || mode === "radial" ? 1 : .62 : reference ? .4 : .2}
            className={loading ? charts.bone : hasDemo ? charts.draw : undefined} style={hasDemo ? { animationDelay: `${index * 19}ms` } : undefined} />;
        })}
        {nodes.map((mark, index) => {
          const { node, x, y, folded, group } = mark;
          const branch = !!node.children?.length;
          const inner = branch && !folded;
          const color = group < 0 ? theme.text : tone(theme, group, node.color);
          const radial = mode === "radial";
          const leaf = !inner && mark.depth > 0;
          const angle = mark.angle;
          const radialLeft = Math.cos(angle) < -1e-9;
          const labelOffset = radial ? group < 0 ? 0 : leaf ? 12.5 : 16.5 : 0;
          const xOffset = reference ? inner ? -12.5 : 12.5 : 9;
          const textX = x + (radial ? Math.cos(angle) * labelOffset : mode === "top" ? 0 : xOffset);
          const textY = y + (radial ? group < 0 ? -13.5 : Math.sin(angle) * labelOffset : mode === "top" ? reference ? inner ? -13 : 17 : -10 : reference ? 1 : 3.5);
          const textAnchor = radial ? leaf ? radialLeft ? "end" : "start" : "middle" : mode === "top" ? "middle" : reference && inner ? "end" : "start";
          const rotation = radial && leaf ? `rotate(${angle * 180 / Math.PI + (radialLeft ? 180 : 0)} ${textX} ${textY})` : undefined;
          const radius = reference ? loading ? group < 0 ? 6 : 5 : (mode === "top" ? 5 : 4.5) + (folded ? 1.5 : 0)
            : active === mark || !radial && group < 0 ? 6 : 4.5;
          const ghostWidth = reference ? treePlaceholderLabels[index] : Math.min(78, 17 + node.name.length * 3);
          return <g key={mark.id} data-mark={loading ? "tree-bone" : "tree-node"} data-node={node.name} data-folded={folded || undefined}
            opacity={loading && reference ? .7 : reference && !near(mark) ? .4 : undefined}
            className={`${branch && !compact && !loading ? charts.mark : ""} ${loading ? charts.bone : hasDemo ? charts.reveal : ""}`}
            style={hasDemo ? { animationDelay: `${index * 19}ms` } : undefined}
            onPointerEnter={!loading && !compact ? () => setActive(mark.id) : undefined}
            onPointerDown={!loading && !compact ? event => { if (event.pointerType === "touch") setActive(mark.id); } : undefined}
            onClick={branch && !loading && !compact ? () => { setActive(mark.id); toggle(mark); } : undefined}>
            <circle cx={x} cy={y} r={radius} fill={loading ? reference ? theme.text : theme.grid : inner && group >= 0 ? theme.surface : color}
              fillOpacity={loading && reference ? .2 : undefined}
              stroke={loading && reference ? undefined : reference && group < 0 ? theme.surface : loading ? theme.grid : color}
              strokeWidth={loading && reference ? undefined : reference ? branch ? 2 : 0 : "1.4"} />
            {loading ? <rect data-mark="tree-bone-label" x={reference && inner ? x - ghostWidth - (group < 0 ? 14 : 13) : x + (reference ? 13 : 10)}
              y={y - 3} width={ghostWidth} height={reference ? 8 : 6} rx={reference ? 4 : 3} fill={reference ? theme.text : theme.grid} fillOpacity={reference ? .2 : undefined} /> :
              <text x={textX} y={textY} textAnchor={textAnchor} transform={rotation} dominantBaseline={reference || radial ? "middle" : undefined}
                fill={reference && inner || radial && branch ? theme.muted : theme.text}
                fontSize={reference ? 12 : radial ? compact ? 9 : 12 : 11} fontWeight={reference ? inner ? 500 : 400 : radial ? 500 : branch ? 600 : 450}
                stroke={theme.surface} strokeWidth={reference ? 3 : "1.8"} paintOrder="stroke">{node.name}{folded ? ` +${folded}` : ""}</text>}
          </g>;
        })}
      </svg>
      {!compact && !loading && active && (reference
        ? <div className={detail.positionedTip} style={{ top: tipTop, left: tipOnRight ? active.x + 16 : undefined, right: tipOnRight ? undefined : viewWidth - active.x + 16 }}>
          <CartesianReadout label={active.path.slice(active.depth ? 1 : 0).join(" / ")} entries={rows} />
        </div>
        : <div className={`${charts.tip} ${charts.floating}`} role="status"><strong>{active.path.slice(active.depth ? 1 : 0).join(" / ")}</strong>
          {rows.map(row => <div key={row.name} style={{ display: "contents" }}><span>{row.name}</span><b>{row.value}</b></div>)}
        </div>)}
    </div>
    {!compact && (loading || !reference) && <p className={styles.hint}>{loading ? "Fetching the site map…" : mode === "radial" ? `${short.format(sumValues(root) * 1000)} weekly installs across ${root.children?.length ?? 0} categories` : `${number.format(sumValues(root))}${unit} across ${root.children?.length ?? 0} groups`}</p>}
  </div>;
}
