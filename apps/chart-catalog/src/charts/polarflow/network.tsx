import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import detail from "./tree-network-detail.module.css";
import { Legend, number, numeric, tone, type Props } from "./shared";
import { selectMark, useChartLoading, usePlotSize } from "./hierarchy-interaction";
import { networkFixtures, networkPlaceholder, type NetworkEdge, type NetworkNode } from "./network-fixtures";
import styles from "./styles.module.css";
import charts from "./hierarchy-charts.module.css";

type Point = { x: number; y: number };
const fixtureInsets: Record<string, { width: number; height: number; x: number; y: number }> = {
  "network-default": { width: 992, height: 620, x: 57.38, y: 19 },
  "network-legend": { width: 808, height: 606, x: 32.24, y: 16 },
  "network-loading": { width: 992, height: 620, x: 52.58, y: 19 },
};

function customNetwork(rows: NonNullable<NonNullable<Props["data"]>["rows"]>) {
  const index = new Map<string, number>();
  const groups: string[] = [];
  const nodes: NetworkNode[] = [];
  const find = (name: string, groupName: string) => {
    const previous = index.get(name);
    if (previous !== undefined) return previous;
    if (!groups.includes(groupName)) groups.push(groupName);
    index.set(name, nodes.length);
    nodes.push({ name, group: groups.indexOf(groupName), x: .5, y: .5, radius: 9 });
    return nodes.length - 1;
  };
  const links: NetworkEdge[] = rows.flatMap(row => {
    if (typeof row.source !== "string" || typeof row.target !== "string" || row.source === row.target) return [];
    const source = find(row.source, String(row.sourceGroup ?? "Services"));
    const target = find(row.target, String(row.targetGroup ?? "Services"));
    return [{ source, target, width: Math.max(.8, Math.min(5, numeric(row.value, 1))) }];
  });
  nodes.forEach((node, index) => {
    const theta = index / nodes.length * Math.PI * 2;
    node.x += Math.cos(theta) * .39;
    node.y += Math.sin(theta) * .38;
  });
  return { groups, nodes, links };
}

export function Network({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { loading, hasDemo, control } = useChartLoading(example.id, compact);
  const [hover, setHover] = useState<number | null>(null);
  const [team, setTeam] = useState<number | null>(null);
  const [positions, setPositions] = useState<Partial<Record<string, Point>>>({});
  const { plot, width, height } = usePlotSize<SVGSVGElement>(640, 420);
  const dragging = useRef<{ index: number; pointer: number; offset: Point } | null>(null);
  const reference = !data && !compact;
  const legend = example.id === "network-legend";
  const fixture = networkFixtures[example.id] ?? networkFixtures["network-default"];
  const { groups, nodes, links } = useMemo(() => data?.rows ? customNetwork(data.rows) : fixture, [data?.rows, fixture]);
  const active = hover === null ? undefined : nodes[hover];
  const neighbors = new Set(links.flatMap(link => link.source === hover ? [link.target] : link.target === hover ? [link.source] : []));
  const insets = data?.rows ? undefined : fixtureInsets[example.id];
  const insetX = Math.min(insets?.x ?? 0, width / 4);
  const insetY = Math.min(insets?.y ?? 0, height / 4);
  const position = (index: number) => {
    const node = nodes[index];
    const moved = positions[node.name];
    if (moved) return { x: moved.x * width, y: moved.y * height };
    if (!insets) return { x: node.x * width, y: node.y * height };
    const x = (node.x * insets.width - insets.x) / (insets.width - 2 * insets.x);
    const y = (node.y * insets.height - insets.y) / (insets.height - 2 * insets.y);
    return { x: insetX + x * (width - 2 * insetX), y: insetY + y * (height - 2 * insetY) };
  };
  const markScale = compact ? .65 : 1;
  const showNode = (index: number) => (team === null || nodes[index].group === team) && (hover === null || hover === index || neighbors.has(index));
  const label = hasDemo ? "Commits" : "Peak";
  const unit = hasDemo ? "commits" : "req/s";
  function drag(event: PointerEvent<SVGSVGElement>) {
    const activeDrag = dragging.current;
    if (event.pointerId !== activeDrag?.pointer) return;
    const svg = plot.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const name = nodes[activeDrag.index]?.name;
    if (name === undefined) return;
    const radius = Math.min(nodes[activeDrag.index].radius * markScale, width / 2, height / 2);
    setPositions(previous => ({ ...previous, [name]: {
      x: Math.max(radius, Math.min(width - radius, point.x - activeDrag.offset.x)) / width,
      y: Math.max(radius, Math.min(height - radius, point.y - activeDrag.offset.y)) / height,
    } }));
  }
  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current?.pointer !== event.pointerId) return;
    dragging.current = null;
    if (reference && event.pointerType !== "touch") setHover(null);
  }
  const activePosition = active && hover !== null ? position(hover) : null;
  const right = activePosition && activePosition.x + 180 < width;
  const rows = active ? [
    { name: "Group", value: groups[active.group], color: tone(theme, active.group) },
    ...(active.value === undefined ? [] : [{ name: label, value: `${number.format(active.value)} ${unit}`, color: tone(theme, active.group) }]),
    { name: "Links", value: neighbors.size, color: tone(theme, active.group) },
  ] : [];

  const visible = <div className={`${styles.graph} ${reference ? detail.networkGraph : charts.measuredGraph}`} data-legend={legend}>
    <svg ref={plot} className={`${styles.native} ${charts.plot} ${charts.network}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={example.title} aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0}
      onKeyDown={event => selectMark(event, hover, nodes.length, setHover)} onBlur={() => setHover(null)} onPointerLeave={event => { if (!dragging.current && event.pointerType !== "touch") setHover(null); }}
      onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
      {loading && reference ? <g className={charts.bone}>
        {networkPlaceholder.map(({ hub, nodes }, index) => {
          const next = networkPlaceholder[(index + 1) % networkPlaceholder.length].hub;
          return <g key={index}>
            {nodes.map(([x, y, radius]) => <g key={x}>
              <path data-mark="network-bone-edge" d={`M${hub[0] * width},${hub[1] * height}L${x * width},${y * height}`} stroke={theme.text} strokeOpacity=".2" strokeWidth="1.25" opacity=".7" />
              <circle data-mark="network-bone-node" cx={x * width} cy={y * height} r={radius} fill={theme.text} fillOpacity=".2" opacity=".7" />
            </g>)}
            <path data-mark="network-bone-edge" d={`M${hub[0] * width},${hub[1] * height}L${next[0] * width},${next[1] * height}`} stroke={theme.text} strokeOpacity=".2" strokeWidth="1.25" opacity=".7" />
            <circle data-mark="network-bone-node" cx={hub[0] * width} cy={hub[1] * height} r={hub[2]} fill={theme.text} fillOpacity=".2" opacity=".7" />
          </g>;
        })}
      </g> : loading ? Array.from({ length: 18 }, (_, index) => {
        const theta = index * 2.39996;
        const x = width / 2 + Math.cos(theta) * width * (.1 + index * .018);
        const y = height / 2 + Math.sin(theta) * height * (.07 + index * .016);
        return <g key={index} className={charts.bone} style={{ animationDelay: `${index * 31}ms` }}>
          <path data-mark="network-bone-edge" d={`M${width / 2},${height / 2} L${x},${y}`} stroke={theme.grid} />
          <circle data-mark="network-bone-node" cx={x} cy={y} r={5 + index % 4} fill={theme.grid} />
        </g>;
      }) : <>
        {links.map((edge, index) => {
          const source = position(edge.source), target = position(edge.target);
          const near = hover === null || edge.source === hover || edge.target === hover;
          const inTeam = team === null || (reference
            ? nodes[edge.source].group === team && nodes[edge.target].group === team
            : nodes[edge.source].group === team || nodes[edge.target].group === team);
          return <line key={index} data-mark="network-edge" data-source={nodes[edge.source].name} data-target={nodes[edge.target].name}
            x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={reference ? `color-mix(in oklab, ${theme.muted} 85%, ${theme.surface})` : theme.muted}
            strokeWidth={edge.width * markScale} opacity={reference ? near && inTeam ? 1 : .4 : near && inTeam ? .52 : .12} />;
        })}
        {nodes.map((node, index) => {
          const p = position(index);
          const radius = node.radius * markScale + (!reference && hover === index ? 1.6 : 0);
          const labelSize = 11;
          const left = !reference && p.x + radius + node.name.length * labelSize * .56 > width - 7;
          return <g key={node.name} data-mark="network-node" data-node={node.name} data-dimmed={!showNode(index)} opacity={showNode(index) ? 1 : reference ? .4 : .2}
            className={hasDemo ? charts.reveal : undefined} style={hasDemo ? { animationDelay: `${index * 18}ms` } : undefined}>
            <circle className={compact ? undefined : charts.drag} cx={p.x} cy={p.y} r={radius} fill={tone(theme, node.group)} stroke={theme.surface} strokeWidth={reference ? 1.5 : 1.4}
              onPointerEnter={!compact ? () => setHover(index) : undefined} onPointerDown={!compact ? event => {
                if (!event.isPrimary || event.button !== 0) return;
                const matrix = plot.current?.getScreenCTM();
                if (!matrix) return;
                const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
                dragging.current = { index, pointer: event.pointerId, offset: { x: point.x - p.x, y: point.y - p.y } };
                plot.current?.setPointerCapture(event.pointerId);
                setHover(index);
              } : undefined} />
            {!compact && <text x={p.x + (left ? -radius - 4 : radius + 4)} y={p.y + 1} textAnchor={left ? "end" : "start"} dominantBaseline="middle" fill={theme.text} stroke={theme.surface}
              paintOrder="stroke" strokeWidth={reference ? 3 : 2.2} fontSize={labelSize} fontWeight={reference ? 500 : undefined}>{node.name}</text>}
          </g>;
        })}
      </>}
    </svg>
    {!compact && !loading && active && (reference && activePosition
      ? <div className={detail.positionedTip} style={{ top: Math.max(0, Math.min(height - 85, activePosition.y - 42)),
        left: right ? activePosition.x + 16 : undefined, right: right ? undefined : width - activePosition.x + 16 }}>
        <CartesianReadout label={active.name} entries={rows} />
      </div>
      : <div className={`${charts.tip} ${charts.floating}`} role="status"><strong>{active.name}</strong>
      <span>Group</span><b>{groups[active.group]}</b>{active.value !== undefined && <><span>{label}</span><b>{number.format(active.value)} {unit}</b></>}
      <span>Links</span><b>{links.filter(edge => edge.source === hover || edge.target === hover).length}</b>
    </div>)}
  </div>;
  return <div className={`${styles.frame} ${charts.wrap} ${reference ? detail.detailFrame : ""}`}>
    {control}
    {legend && !compact ? <div className={reference ? detail.networkAside : charts.sideBySide}>{visible}<div className={reference ? detail.networkLegend : charts.sideLegend}><p>People</p>
      <Legend items={groups.map((name, index) => ({ name, value: nodes.filter(node => node.group === index).length }))} active={team} onActive={setTeam} theme={theme} />
    </div></div> : visible}
    {!compact && (loading || !reference) && <p className={styles.hint}>{loading ? "Fetching the graph…" : `${nodes.length} ${legend ? "people" : hasDemo ? "workstreams" : "services and stores"} · ${links.length} ${legend ? "review ties" : hasDemo ? "shared changes" : "dependencies"}`}</p>}
  </div>;
}
