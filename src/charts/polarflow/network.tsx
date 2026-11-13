import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { Legend, number, numeric, tone, type Props } from "./shared";
import { selectMark, useChartLoading } from "./hierarchy-interaction";
import { networkFixtures, type NetworkEdge, type NetworkNode } from "./network-fixtures";
import styles from "./styles.module.css";
import charts from "./hierarchy-charts.module.css";

type Point = { x: number; y: number };
const width = 640;
const height = 420;

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
  const plot = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ index: number; pointer: number } | null>(null);
  const legend = example.id === "network-legend";
  const fixture = networkFixtures[example.id] ?? networkFixtures["network-default"];
  const { groups, nodes, links } = useMemo(() => data?.rows ? customNetwork(data.rows) : fixture, [data?.rows, fixture]);
  const active = hover === null ? undefined : nodes[hover];
  const neighbors = new Set(links.flatMap(link => link.source === hover ? [link.target] : link.target === hover ? [link.source] : []));
  const position = (index: number) => positions[nodes[index].name] ?? {
    x: 25 + nodes[index].x * (width - 106), y: 21 + nodes[index].y * (height - 43),
  };
  const showNode = (index: number) => (team === null || nodes[index].group === team) && (hover === null || hover === index || neighbors.has(index));
  const label = hasDemo ? "Commits" : "Peak";
  const unit = hasDemo ? "commits" : "req/s";
  function drag(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerId !== dragging.current?.pointer) return;
    const svg = plot.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const name = nodes[dragging.current.index]?.name;
    if (name === undefined) return;
    setPositions(previous => ({ ...previous, [name]: { x: Math.max(8, Math.min(width - 24, point.x)), y: Math.max(8, Math.min(height - 10, point.y)) } }));
  }
  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragging.current?.pointer === event.pointerId) dragging.current = null;
  }
  const visible = <div className={styles.graph}>
    <svg ref={plot} className={`${styles.native} ${charts.plot} ${charts.network}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart"
      aria-label={example.title} aria-busy={loading || undefined} tabIndex={compact || loading ? undefined : 0}
      onKeyDown={event => selectMark(event, hover, nodes.length, setHover)} onBlur={() => setHover(null)} onPointerLeave={() => { if (!dragging.current) setHover(null); }}
      onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
      {loading ? Array.from({ length: 18 }, (_, index) => {
        const theta = index * 2.39996;
        const x = width / 2 + Math.cos(theta) * (65 + index * 12);
        const y = height / 2 + Math.sin(theta) * (30 + index * 7);
        return <g key={index} className={charts.bone} style={{ animationDelay: `${index * 31}ms` }}>
          <path data-mark="network-bone-edge" d={`M${width / 2},${height / 2} L${x},${y}`} stroke={theme.grid} />
          <circle data-mark="network-bone-node" cx={x} cy={y} r={5 + index % 4} fill={theme.grid} />
        </g>;
      }) : <>
        {links.map((edge, index) => {
          const source = position(edge.source), target = position(edge.target);
          const near = hover === null || edge.source === hover || edge.target === hover;
          const inTeam = team === null || nodes[edge.source].group === team || nodes[edge.target].group === team;
          return <line key={index} data-mark="network-edge" data-source={nodes[edge.source].name} data-target={nodes[edge.target].name}
            x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={theme.muted} strokeWidth={edge.width * .7} opacity={near && inTeam ? .52 : .12} />;
        })}
        {nodes.map((node, index) => {
          const p = position(index);
          const radius = node.radius * .77 + (hover === index ? 1.6 : 0);
          const left = p.x + radius + node.name.length * 6 > width - 7;
          return <g key={node.name} data-mark="network-node" data-node={node.name} data-dimmed={!showNode(index)} opacity={showNode(index) ? 1 : .2}
            className={hasDemo ? charts.reveal : undefined} style={hasDemo ? { animationDelay: `${index * 18}ms` } : undefined}>
            <circle className={compact ? undefined : charts.drag} cx={p.x} cy={p.y} r={radius} fill={tone(theme, node.group)} stroke={theme.surface} strokeWidth="1.4"
              onPointerEnter={!compact ? () => setHover(index) : undefined} onPointerDown={!compact ? event => {
                dragging.current = { index, pointer: event.pointerId };
                plot.current?.setPointerCapture(event.pointerId);
                setHover(index);
              } : undefined} />
            {!compact && <text x={p.x + (left ? -radius - 4 : radius + 4)} y={p.y + 3} textAnchor={left ? "end" : "start"} fill={theme.text} stroke={theme.surface}
              paintOrder="stroke" strokeWidth="2.2" fontSize="10.5">{node.name}</text>}
          </g>;
        })}
      </>}
    </svg>
    {!compact && !loading && active && <div className={`${charts.tip} ${charts.floating}`} role="status"><strong>{active.name}</strong>
      <span>Group</span><b>{groups[active.group]}</b>{active.value !== undefined && <><span>{label}</span><b>{number.format(active.value)} {unit}</b></>}
      <span>Links</span><b>{links.filter(edge => edge.source === hover || edge.target === hover).length}</b>
    </div>}
  </div>;
  return <div className={`${styles.frame} ${charts.wrap}`}>
    {control}
    {legend && !compact ? <div className={charts.sideBySide}>{visible}<div className={charts.sideLegend}><p>People</p>
      <Legend items={groups.map((name, index) => ({ name, value: nodes.filter(node => node.group === index).length }))} active={team} onActive={setTeam} theme={theme} />
    </div></div> : visible}
    {!compact && <p className={styles.hint}>{loading ? "Fetching the graph…" : `${nodes.length} ${legend ? "people" : hasDemo ? "workstreams" : "services and stores"} · ${links.length} ${legend ? "review ties" : hasDemo ? "shared changes" : "dependencies"}`}</p>}
  </div>;
}
