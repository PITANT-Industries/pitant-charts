import { Button } from "@ui-sdk/react/button";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { EChartsOption } from "echarts";
import { Sector } from "recharts";
import { EChart } from "../EChart";
import { useChartTheme } from "../theme";
import { dollars, Legend, number, numeric, percent, point, safeText, tone, tooltip, useLoading, type Props } from "./shared";
import type { SunburstNode } from "./upstream/sunburst-data";
import { buildArcs, geometryFor, ringOptions, sumValues } from "./upstream/sunburst-layout";
import type { ArcGeometry } from "./upstream/sunburst-layout";
import { sunburstFixtures } from "./sunburst-fixtures";
import styles from "./styles.module.css";
import sunburstStyles from "./sunburst.module.css";

const branches: SunburstNode[] = [
  { name: "Platform", children: [{ name: "Cloud", children: [{ name: "Compute", children: [{ name: "Reserved", value: 22 }, { name: "On-demand", value: 16 }] }, { name: "Storage", value: 24 }] }, { name: "Database", children: [{ name: "Primary", value: 21 }, { name: "Replica", value: 12 }] }] },
  { name: "Product", children: [{ name: "Growth", children: [{ name: "Web", value: 24 }, { name: "Mobile", value: 12 }] }, { name: "Core", children: [{ name: "API", value: 28 }, { name: "UI", value: 17 }] }] },
  { name: "Social", children: [{ name: "Campaigns", children: [{ name: "Direct", value: 21 }, { name: "Paid", value: 17 }] }, { name: "Community", value: 27 }] },
  { name: "Support", children: [{ name: "Success", value: 16 }, { name: "Operations", value: 19 }] },
  { name: "Research", children: [{ name: "Labs", value: 14 }, { name: "Discovery", value: 11 }] },
];

const sitemap: SunburstNode[] = [
  { name: "Products", children: [{ name: "Overview" }, { name: "Integrations" }, { name: "Security" }] },
  { name: "Documentation", children: [{ name: "Start here" }, { name: "Reference", children: [{ name: "API" }, { name: "SDK" }] }] },
  { name: "Company", children: [{ name: "About" }, { name: "Careers" }, { name: "Contact" }] },
];

function readHierarchy(rows: readonly Record<string, unknown>[] | undefined): SunburstNode[] | undefined {
  const read = (item: Record<string, unknown>, index: number): SunburstNode => ({
    name: String(item.name ?? item.label ?? index + 1),
    value: item.value === undefined ? undefined : Math.max(0, numeric(item.value)),
    color: typeof item.color === "string" ? item.color : undefined,
    children: Array.isArray(item.children) ? item.children.filter(row => row && typeof row === "object").map(read) : undefined,
  });
  return rows?.map(read);
}

type VisibleArc = ArcGeometry & { opacity: number };

const compactExpense = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
});

function collapseArc(arc: VisibleArc): VisibleArc {
  const center = (arc.a0 + arc.a1) / 2;
  return { a0: center, a1: center, innerR: arc.innerR, outerR: arc.innerR, opacity: 0 };
}

function useArcMorph(target: ReadonlyMap<string, VisibleArc>, compact: boolean | undefined) {
  const [view, setView] = useState(target);
  const latest = useRef(target);
  useEffect(() => {
    const start = latest.current;
    if (start === target) return;
    if (compact || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      latest.current = target;
      setView(target);
      return;
    }
    const keys = new Set([...start.keys(), ...target.keys()]);
    const arcs = [...keys].map(id => {
      const from = start.get(id);
      const to = target.get(id);
      return { id, from: from ?? collapseArc(to!), to: to ?? collapseArc(from!) };
    });
    const began = performance.now();
    let frame: number;
    function animate(time: number) {
      const t = Math.min(1, (time - began) / 360);
      if (t === 1) {
        latest.current = target;
        setView(target);
        return;
      }
      const progress = 1 - (1 - t) ** 3;
      const mix = (a: number, b: number) => a + (b - a) * progress;
      const next = new Map(arcs.map(({ id, from, to }) => [id, {
        a0: mix(from.a0, to.a0), a1: mix(from.a1, to.a1),
        innerR: mix(from.innerR, to.innerR), outerR: mix(from.outerR, to.outerR),
        opacity: mix(from.opacity, to.opacity),
      }]));
      latest.current = next;
      setView(next);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [compact, target]);
  return compact ? target : view;
}

export function Sunburst({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const id = example.id;
  const hasBreadcrumb = id === "sunburst-breadcrumb";
  const customHint = id === "sunburst-custom-hint";
  const customColors = id === "sunburst-segment-colors";
  const patterned = id === "sunburst-patterns";
  const root = useMemo((): SunburstNode => {
    const fixture = sunburstFixtures[id] ?? sunburstFixtures["sunburst-default"];
    const children = readHierarchy(data?.rows);
    return children ? { name: fixture.name, children } : fixture;
  }, [data?.rows, id]);
  const { arcs, rootId, focusById, maxDepth, total } = useMemo(() => buildArcs(root), [root]);
  const initial = hasBreadcrumb ? arcs.find(item => item.depth === 1 && item.hasChildren)?.id : undefined;
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [active, setActive] = useState<string | null>(null);
  const focus = focusById.get(selected ?? rootId) ?? focusById.get(rootId)!;
  const activeArc = arcs.find(item => item.id === active);
  const radius = 114;
  const visibleDepth = useMemo(() => arcs.reduce((depth, item) => item.id.startsWith(`${focus.id} / `) ? Math.max(depth, item.depth) : depth, Math.min(maxDepth, focus.depth + 1)), [arcs, focus, maxDepth]);
  const rings = ringOptions(focus.depth, Math.max(1, visibleDepth), radius);
  const targetArcs = useMemo(() => new Map(arcs.flatMap(item => {
    const geometry = geometryFor(item, focus, visibleDepth, radius);
    return geometry && item.value > 0 ? [[item.id, { ...geometry, opacity: 1 }] as const] : [];
  })), [arcs, focus, visibleDepth]);
  const visibleArcs = useArcMorph(targetArcs, compact);
  const labels = arcs.filter(item => item.parentId === rootId && item.value > 0);
  const ancestors = focus.id.split(" / ");
  const chart = useRef<SVGSVGElement>(null);
  const visibleIds = [...targetArcs.keys()];
  const toDegrees = 180 / Math.PI;
  const cx = 140;
  const cy = 132;
  const showLegend = !compact && id === "sunburst-legend";
  const patternedBranches = patterned ? labels.filter(item => item.name === "Services" || item.name === "Partners") : [];

  function go(nextId: string | null, keyboard = false) {
    const next = nextId ?? rootId;
    setSelected(next);
    setActive(keyboard ? arcs.find(item => item.parentId === next && item.value > 0)?.id ?? null : null);
  }
  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (!visibleIds.length) return;
    if (event.key === "Escape") {
      if (focus.parentId) { event.preventDefault(); go(focus.parentId, true); }
      else if (active) { event.preventDefault(); setActive(null); }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (active === focus.id && focus.parentId) {
        event.preventDefault();
        go(focus.parentId, true);
      } else if (activeArc?.hasChildren && targetArcs.has(activeArc.id)) {
        event.preventDefault();
        go(activeArc.id, true);
      }
      return;
    }
    const keys = focus.parentId ? [focus.id, ...visibleIds] : visibleIds;
    const index = keys.indexOf(active ?? "");
    const last = keys.length - 1;
    const previous = index <= 0 ? last : index - 1;
    const following = (index + 1) % keys.length;
    const next = { Home: 0, End: last, ArrowLeft: previous, ArrowUp: previous, ArrowRight: following, ArrowDown: following }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(keys[next]);
  }
  return <div className={sunburstStyles.frame}>
    {hasBreadcrumb && !compact && <nav className={sunburstStyles.breadcrumb} aria-label="Drill-down path">{ancestors.map((name, index) =>
      <span key={index}>{index > 0 && <span aria-hidden="true">›</span>}<Button type="button" aria-current={index === ancestors.length - 1 ? "location" : undefined} onClick={() => go(ancestors.slice(0, index + 1).join(" / "))}>{name}</Button></span>
    )}</nav>}
    <div className={`${sunburstStyles.body}${showLegend ? ` ${sunburstStyles.withLegend}` : ""}`}>
    <svg ref={chart} className={sunburstStyles.plot} viewBox="0 0 280 264" role="img" aria-label={example.title} aria-roledescription="chart"
      aria-description="Use arrow keys to inspect segments and Enter or Space to zoom into a branch. Press Escape to move back."
      tabIndex={compact ? undefined : 0} onKeyDown={inspect} onFocus={() => setActive(previous => previous ?? visibleIds[0] ?? null)}
      onBlur={() => setActive(null)} onPointerLeave={() => { if (document.activeElement !== chart.current) setActive(null); }}>
      {patternedBranches.length > 0 && <defs>{patternedBranches.map(item =>
        <pattern key={item.id} id={`${uid}-${item.categoryIndex}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={tone(theme, item.categoryIndex, item.color)} fillOpacity=".2" />
          <path d="M-1 1 1-1 M0 6 6 0 M5 7 7 5" stroke={tone(theme, item.categoryIndex, item.color)} strokeWidth="1.5" />
        </pattern>
      )}</defs>}
      {!targetArcs.size && <circle cx={cx} cy={cy} r={radius} fill="none" stroke={theme.grid} strokeWidth="1" />}
      {arcs.map((item) => {
        const geometry = visibleArcs.get(item.id);
        if (!geometry || item.value <= 0 || geometry.a1 - geometry.a0 < .0001) return null;
        const interactive = targetArcs.has(item.id);
        const highlighted = active === item.id || (active && active !== focus.id && item.id.startsWith(`${active} / `));
        const trail = item.id.split(" / ");
        const muted = customColors && !item.color && trail[1] !== "Social";
        const pattern = patternedBranches.find(branch => branch.id === item.id || item.id.startsWith(`${branch.id} / `));
        const color = muted ? theme.grid : tone(theme, item.categoryIndex, item.color);
        const tint = Math.min(25, (item.depth - focus.depth - 1) * 9 + (item.arcIndex % 2) * 4);
        const fill = pattern ? `url(#${uid}-${pattern.categoryIndex})` : `color-mix(in srgb, ${color} ${100 - Math.max(0, tint)}%, var(--card))`;
        const click = interactive && item.hasChildren ? () => go(item.id) : undefined;
        const start = geometry.a0 * toDegrees + 270;
        const end = geometry.a1 * toDegrees + 270;
        const mid = (start + end) / 2;
        const midRadius = (geometry.outerR + geometry.innerR) / 2;
        const [tx, ty] = point(cx, cy, midRadius, mid);
        const radialSpace = geometry.outerR - geometry.innerR;
        if (radialSpace < 1) return null;
        const arcSpace = midRadius * (geometry.a1 - geometry.a0);
        const horizontal = Math.abs(Math.sin(mid / toDegrees)) > .88;
        const labelWidth = Math.max(0, Math.min(horizontal ? arcSpace : radialSpace * 1.15, 90) - 4);
        const availableCharacters = Math.floor(labelWidth / 4.15);
        const label = item.name.length <= availableCharacters ? item.name : `${item.name.slice(0, Math.max(0, availableCharacters - 1))}…`;
        const rotation = (mid + 360) % 360;
        const readableRotation = rotation > 90 && rotation < 270 ? rotation - 180 : rotation;
        const inset = Math.min(geometry.innerR ? .38 : .18, (end - start) / 8);
        return <g key={item.id} opacity={geometry.opacity} className={sunburstStyles.segment} data-sunburst-branch={trail[1]} data-dimmed={active !== null && active !== focus.id && !highlighted && !active.startsWith(`${item.id} / `)}>
          <Sector cx={cx} cy={cy} innerRadius={geometry.innerR ? geometry.innerR + .43 : 0} outerRadius={geometry.outerR - .43 + (highlighted ? 2.5 : 0)}
            startAngle={-start - inset} endAngle={-end + inset} cornerRadius={geometry.innerR ? Math.min(1.25, radialSpace / 6, arcSpace / 8) : 0}
            fill={fill} role={click ? "button" : undefined} aria-label={interactive ? `${item.name}: ${number.format(item.value)}` : undefined}
            onPointerEnter={interactive ? () => setActive(item.id) : undefined} onClick={click}
            style={{ cursor: click ? "pointer" : "default", pointerEvents: interactive ? "auto" : "none" }}>
            <title>{`${trail.join(" › ")} · ${number.format(item.value)}`}</title>
          </Sector>
          {!customHint && !patterned && !compact && availableCharacters >= 4 && radialSpace > 12 && arcSpace > 12 && geometry.opacity > .7 && <text pointerEvents="none" textAnchor="middle" dominantBaseline="central" x={tx} y={ty}
            transform={horizontal ? undefined : `rotate(${readableRotation}, ${tx}, ${ty})`}
            className={sunburstStyles.label} data-muted={muted}>{label}</text>}
        </g>;
      })}
      {focus.parentId && <g role="button" aria-label="Back one level" style={{ cursor: "pointer" }} onClick={() => go(focus.parentId)}
        onPointerEnter={() => setActive(focus.id)}>
        <circle cx={cx} cy={cy} r={Math.max(rings.centerR - 1.2, 12)} fill={theme.surface} stroke={active === focus.id ? tone(theme, 0) : theme.grid} />
        <path d={`M${cx - 4} ${cy}l4 -4 4 4M${cx} ${cy - 4}v8`} stroke={theme.text} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
      </g>}
    </svg>
    {showLegend && <ul className={sunburstStyles.legend} aria-label="Visible branches">
      {labels.map(item => <li key={item.id}><Button type="button" data-active={active === item.id || !!active?.startsWith(`${item.id} / `) || focus.id === item.id || focus.id.startsWith(`${item.id} / `)}
        onPointerEnter={() => setActive(item.id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(item.id)} onBlur={() => setActive(null)}
        onClick={() => { if (item.hasChildren) go(item.id); else setActive(item.id); }}>
        <span className={sunburstStyles.swatch} style={{ background: tone(theme, item.categoryIndex, item.color) }} />
        <span>{item.name}</span><strong>{number.format(item.value)}</strong><span>{Math.round(percent(item.value, total))}%</span>
      </Button></li>)}
    </ul>}
    </div>
    {!compact && <div className={sunburstStyles.hint} data-sunburst-hint="">
      {activeArc && active !== focus.id ? customHint
        ? <><strong>{activeArc.id.split(" / ").slice(1).join(" › ")}</strong> {compactExpense.format(activeArc.value).replace(/K$/, "k")} · {percent(activeArc.value, total).toFixed(1)}% of spend</>
        : activeArc.id.split(" / ").join(" › ")
        : focus.parentId ? "Click the center to zoom out" : customHint ? "Hover a segment to see its cost" : "Click a segment to zoom in · hover to inspect"}
    </div>}
    {!compact && <div className={styles.screenReader} role="status" aria-atomic="true">{active === focus.id && focus.parentId
      ? "Back one level" : activeArc ? `${activeArc.id.split(" / ").slice(1).join(" › ")}: level ${activeArc.depth}, value ${number.format(activeArc.value)}` : `Viewing ${focus.name}`}</div>}
  </div>;
}

interface TreemapNode {
  name: string;
  value: number;
  children?: TreemapNode[];
  itemStyle: { color: string };
}

export function Treemap({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, control } = useLoading(example.id, compact);
  const [path, setPath] = useState<string[]>([]);
  const id = example.id;
  const portfolio = id === "treemap-portfolio";
  const initial: SunburstNode[] = portfolio ? ["Tech", "Energy", "Industrials", "Finance", "Health", "Other"].map((name, index) => ({ name, value: [28, 19, 16, 15, 12, 10][index] })) : branches;
  const rows = readHierarchy(data?.rows) ?? initial;
  const total = rows.reduce((value, node) => value + sumValues(node), 0);
  const navigation = !portfolio && !loading;
  let visibleRows = rows;
  const breadcrumbs = ["Cloud spending"];
  for (const name of path) {
    const node = visibleRows.find(row => row.name === name);
    if (!node?.children?.length) break;
    breadcrumbs.push(node.name);
    visibleRows = node.children;
  }
  function mapNode(row: SunburstNode, index: number): TreemapNode {
    return {
      name: row.name,
      value: sumValues(row),
      children: row.children?.map((child) => mapNode(child, index)),
      itemStyle: { color: loading ? theme.grid : tone(theme, index, row.color) },
    };
  }
  const option: EChartsOption = {
    animation: !compact && !loading,
    animationDuration: 300,
    tooltip: { ...tooltip(theme), show: !loading, formatter: (params: any) => portfolio ?
      `${safeText(params.name)}<br/>${percent(Number(params.value), total).toFixed(1)}% of portfolio` :
      `${safeText(params.name)}<br/>${dollars.format(Number(params.value) * 1000)}` },
    series: [{
      type: "treemap", data: visibleRows.map(mapNode),
      top: 12, right: 20, left: 20, bottom: 12,
      visibleMin: 9, leafDepth: portfolio ? 1 : 2, roam: false, nodeClick: false,
      breadcrumb: { show: false },
      label: { show: !loading, color: "#fff", overflow: "truncate", fontSize: compact ? 8 : 11 },
      upperLabel: { show: !portfolio && !loading, color: theme.text, height: 18, overflow: "truncate", fontSize: compact ? 8 : 11 },
      itemStyle: { gapWidth: 2, borderWidth: 1, borderColor: theme.surface },
      levels: [{ itemStyle: { gapWidth: 4, borderColor: theme.surface, borderWidth: 0 } }, { colorSaturation: [.35, .65], itemStyle: { gapWidth: 2, borderColor: theme.surface, borderWidth: 2 } }],
    }],
  };
  function drill(name: string) {
    if (!visibleRows.find(row => row.name === name)?.children?.length) return;
    setPath([...breadcrumbs.slice(1), name]);
  }
  return <div className={styles.frame}>
    <div className={`${styles.graph} ${loading ? styles.loading : ""}`}>
      <EChart option={option} label={loading ? `Loading ${example.title}` : example.title} compact={compact}
        onEvents={navigation ? { click: (event) => {
          const group = event.treePathInfo?.[1]?.name ?? event.name;
          if (typeof group === "string") drill(group);
        } } : undefined} />
    </div>
    {!compact && navigation && <div className={styles.controls} aria-label="Treemap path">{breadcrumbs.map((name, index) =>
      <Button key={index} className={styles.control} type="button" onClick={() => setPath(breadcrumbs.slice(1, index + 1))}>{name}</Button>
    )}</div>}
    {!compact && navigation && visibleRows.some(row => row.children?.length) && <div className={styles.controls} aria-label="Treemap groups">
      {visibleRows.filter(row => row.children?.length).map(row => <Button key={row.name} className={styles.control} type="button" onClick={() => drill(row.name)}>{row.name}</Button>)}
    </div>}
    {control}
  </div>;
}

export function Tree({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, control } = useLoading(example.id, compact);
  const radial = example.id === "tree-radial";
  const vertical = example.id === "tree-vertical";
  const rows = readHierarchy(data?.rows) ?? (vertical ? sitemap.map((node, index) => index === 1 ? { ...node, collapsed: true } : node) : branches);
  const option: EChartsOption = {
    animation: !compact && !loading,
    tooltip: { ...tooltip(theme), show: !loading },
    series: [{
      type: "tree", data: [{ name: vertical ? "Home" : radial ? "Components" : "Organization", children: rows }],
      top: radial ? 25 : 18, bottom: radial ? 25 : 22, left: radial ? 25 : 30, right: radial ? 25 : vertical ? 30 : 77,
      layout: radial ? "radial" : "orthogonal", orient: vertical ? "TB" : "LR", initialTreeDepth: radial ? 4 : 2,
      expandAndCollapse: !loading, symbolSize: compact ? 5 : 8,
      label: { show: !loading, position: radial || vertical ? "bottom" : "left", color: theme.text, fontSize: compact ? 8 : 10 },
      leaves: { label: { show: !loading, position: radial || vertical ? "bottom" : "right", color: theme.muted, fontSize: compact ? 8 : 10 } },
      lineStyle: { width: 1.4, color: loading ? theme.grid : tone(theme, 0), opacity: .55 },
      itemStyle: { color: loading ? theme.grid : tone(theme, 0), borderColor: theme.surface, borderWidth: 1 },
      emphasis: { focus: "ancestor", lineStyle: { width: 2.4 } },
    }],
  };
  return <div className={styles.frame}>
    <div className={`${styles.graph} ${loading ? styles.loading : ""}`}><EChart option={option} label={example.title} compact={compact} /></div>
    {control}
  </div>;
}

const groups = ["Platform", "Growth", "Product", "Operations"];
const names = ["Web", "iOS", "Android", "Edge", "Gateway", "API", "Identity", "Search", "Billing", "Email", "Queue", "Events", "Cache", "Warehouse", "Postgres", "Object store", "Stripe", "Status", "Metrics", "DNS"];
const defaultLinks = names.flatMap((source, index) => [
  ...(index < names.length - 1 ? [{ source, target: names[index + 1], value: 2 + index % 4 }] : []),
  ...(index < names.length - 4 && index % 3 !== 1 ? [{ source, target: names[index + 4], value: 1 }] : []),
]);

export function Network({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, control } = useLoading(example.id, compact);
  const [active, setActive] = useState<number | null>(null);
  const links = data?.rows?.flatMap(row => typeof row.source === "string" && typeof row.target === "string" ?
    [{ source: row.source, target: row.target, value: numeric(row.value, 1) }] : []) ?? defaultLinks;
  const nodes = data?.rows ? [...new Set(links.flatMap(link => [link.source, link.target]))] : names;
  const nodeRows = nodes.map((name, index) => {
    const group = index % groups.length;
    const angle = (index * 2.39996 + group / 3);
    const radius = 22 + index % 5 * 10;
    const scale = .9 + index % 5 * .08;
    return { name, x: 120 + Math.cos(angle) * radius * scale + (group % 2) * 123, y: 65 + Math.sin(angle) * radius * scale + (group > 1 ? 93 : 0),
      category: group, symbolSize: 7 + index % 5 * 2.2, itemStyle: { color: loading ? theme.grid : tone(theme, group), opacity: active === null || active === group ? 1 : .24 } };
  });
  const option: EChartsOption = {
    animation: !compact && !loading,
    tooltip: { ...tooltip(theme), show: !loading },
    series: [{
      type: "graph", layout: "none", data: nodeRows, links, categories: groups.map(name => ({ name })),
      left: "12%", right: "12%", top: "12%", bottom: "12%", draggable: !compact && !loading,
      label: { show: !loading && !compact, position: "right", color: theme.text, fontSize: 9 },
      lineStyle: { color: theme.muted, opacity: .35, width: 1.2, curveness: .07 },
      emphasis: { focus: "adjacency", lineStyle: { opacity: .8, width: 1.8 } },
    }],
  };
  return <div className={styles.frame}>
    <div className={`${styles.graph} ${loading ? styles.loading : ""}`}><EChart option={option} label={example.title} compact={compact} /></div>
    {!compact && example.id === "network-legend" && <Legend items={groups.map((name, index) => ({ name, value: nodeRows.filter(node => node.category === index).length }))}
      active={active} onActive={setActive} theme={theme} />}
    {control}
  </div>;
}
