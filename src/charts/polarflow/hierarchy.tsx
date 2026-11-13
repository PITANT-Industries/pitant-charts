import { useId, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "../EChart";
import { useChartTheme } from "../theme";
import { dollars, Legend, number, numeric, Pattern, percent, point, safeText, sector, tone, tooltip, useLoading, type Props } from "./shared";
import type { SunburstNode } from "./upstream/sunburst-data";
import { buildArcs, geometryFor, ringOptions, sumValues } from "./upstream/sunburst-layout";
import styles from "./styles.module.css";

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

export function Sunburst({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const id = example.id;
  const hasBreadcrumb = id === "sunburst-breadcrumb";
  const customHint = id === "sunburst-custom-hint";
  const root = useMemo((): SunburstNode => ({
    name: hasBreadcrumb ? "Cloud spending" : "Revenue",
    children: readHierarchy(data?.rows) ?? branches,
  }), [data?.rows, hasBreadcrumb]);
  const { arcs, rootId, focusById, maxDepth, total } = useMemo(() => buildArcs(root), [root]);
  const initial = hasBreadcrumb ? arcs.find(item => item.depth === 1 && item.hasChildren)?.id : undefined;
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [active, setActive] = useState<string | null>(null);
  const focus = focusById.get(selected ?? rootId) ?? focusById.get(rootId)!;
  const activeArc = arcs.find(item => item.id === active);
  const radius = 101;
  const rings = ringOptions(focus.depth, Math.max(1, maxDepth), radius);
  const labels = arcs.filter(item => item.depth === 1);
  const ancestors = focus.id.split(" / ");
  const toDegrees = 180 / Math.PI;
  function go(id: string | null) {
    setSelected(id ?? rootId);
    setActive(null);
  }
  return <div className={styles.frame}>
    {hasBreadcrumb && !compact && <div className={styles.controls}>{ancestors.map((name, index) =>
      <button key={index} className={styles.control} type="button" onClick={() => go(ancestors.slice(0, index + 1).join(" / "))}>{name}</button>
    )}</div>}
    <svg className={styles.native} viewBox="0 0 420 240" role="img" aria-label={example.title}>
      <defs>{labels.map((item) => <Pattern key={item.id} id={`${uid}-${item.categoryIndex}`} color={tone(theme, item.categoryIndex)} />)}</defs>
      {arcs.map((item) => {
        const geometry = geometryFor(item, focus, maxDepth, radius);
        if (!geometry || item.value <= 0) return null;
        const highlighted = active === item.id || (active && item.id.startsWith(`${active} / `));
        const color = id === "sunburst-segment-colors" && item.categoryIndex !== 2 ? theme.grid : tone(theme, item.categoryIndex, item.color);
        const fill = id === "sunburst-patterns" && item.depth > 1 && item.categoryIndex % 2 === 0 ? `url(#${uid}-${item.categoryIndex})` : color;
        const click = item.hasChildren ? () => go(item.id) : undefined;
        const middle = (geometry.a0 + geometry.a1) / 2;
        const [tx, ty] = point(210, 120, (geometry.outerR + geometry.innerR) / 2, middle * toDegrees);
        const enoughRoom = (geometry.outerR + geometry.innerR) / 2 * (geometry.a1 - geometry.a0) > item.name.length * 4.4;
        return <g key={item.id}><path d={sector(210, 120, geometry.outerR + (highlighted ? 3 : 0), geometry.innerR, geometry.a0 * toDegrees + .5, geometry.a1 * toDegrees - .5)}
          fill={fill} fillOpacity={highlighted ? 1 : active ? .45 : 1 - Math.min(.5, .12 * (item.depth - 1))} stroke={theme.surface} strokeWidth="1.5"
          tabIndex={compact ? undefined : 0} role={item.hasChildren ? "button" : undefined}
          onMouseEnter={() => setActive(item.id)} onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(item.id)} onBlur={() => setActive(null)} onClick={click}
          onKeyDown={(event) => { if (click && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); click(); } }}
          style={{ cursor: click ? "pointer" : "default", transition: "d 230ms, fill-opacity 150ms" }}>
          {!customHint && <title>{`${item.trail.join(" › ")} · ${number.format(item.value)}`}</title>}
        </path>
        {!customHint && enoughRoom && geometry.innerR > 6 && <text pointerEvents="none" textAnchor="middle" x={tx} y={ty + 2.5}
          fontSize="7" fontWeight="600" fill={id === "sunburst-segment-colors" && item.categoryIndex !== 2 ? theme.muted : "#fff"}>{item.name}</text>}
        </g>;
      })}
      {focus.parentId && <g role="button" aria-label="Back one level" tabIndex={compact ? undefined : 0} style={{ cursor: "pointer" }}
        onClick={() => go(focus.parentId)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); go(focus.parentId); } }}>
        <circle cx="210" cy="120" r={Math.max(rings.centerR - 1, 12)} fill={theme.surface} stroke={theme.grid} />
        <text x="210" y="124" textAnchor="middle" fill={theme.text} fontSize="14" pointerEvents="none">↑</text>
      </g>}
    </svg>
    {!compact && id === "sunburst-legend" && <Legend items={labels.map(item => ({ name: item.name, value: item.value }))} theme={theme}
      active={activeArc?.categoryIndex ?? null} onActive={index => setActive(index === null ? null : labels[index]?.id ?? null)}
      onClick={index => { if (labels[index]?.hasChildren) go(labels[index].id); }} />}
    {!compact && customHint && <div className={styles.hint}>{activeArc ? <><strong>{activeArc.name}</strong> · {dollars.format(activeArc.value * 1000)} · {percent(activeArc.value, total).toFixed(1)}%</> : "Focus a segment to inspect its share"}</div>}
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
      <button key={index} className={styles.control} type="button" onClick={() => setPath(breadcrumbs.slice(1, index + 1))}>{name}</button>
    )}</div>}
    {!compact && navigation && visibleRows.some(row => row.children?.length) && <div className={styles.controls} aria-label="Treemap groups">
      {visibleRows.filter(row => row.children?.length).map(row => <button key={row.name} className={styles.control} type="button" onClick={() => drill(row.name)}>{row.name}</button>)}
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
