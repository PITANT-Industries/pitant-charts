import { Toggle } from "@ui-sdk/react/toggle";
import { curveBumpX, line } from "d3-shape";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartExample } from "../../types";
import { usePlotSize } from "../usePlotSize";
import { CartesianReadout } from "./CartesianFocus";
import type { CartesianData } from "./data";
import type { ChartTheme } from "./options";
import "./ranking-detail.css";

const summaries: Record<string, readonly [string, string]> = {
  "bump-default": ["TypeScript took the top spot in 2026", "Rust climbed from fifth to third as Java fell to last"],
  "bump-loading": ["Comet finished the six weeks on top", "Turn loading off to draw the rankings in"],
  "slope-default": ["Satisfaction rose in four of seven countries", "India gained the most, nine points; France lost four"],
  "slope-response-time": ["Faster replies on every paid plan but Starter", "Enterprise answers now come in just over an hour"],
  "slope-loading": ["Four of six products gained", "Turn loading off to draw the slopes from the skeleton"],
};
export function isRankingDetail(id: string) {
  return id === "bump-ascending" || Object.hasOwn(summaries, id);
}
const bumpSkeleton = [[1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2], [3, 3, 3, 4, 4, 4], [4, 4, 4, 3, 3, 3]];
const slopeSkeleton = [
  [.034932, .037310, 61.72, 66.66], [.238297, .291333, 71.52, 76.2],
  [.399712, .571599, 77.87, 67.41], [.595376, .420841, 86.47, 51.35],
  [.739639, .756581, 49.43, 75.37], [.934362, .947365, 63.95, 69.05],
];
const slopeLoadingOrder = ["Mobile app", "Web dashboard", "API", "Integrations", "Help center", "Billing"];
type Point = readonly [number, number];
const rounded = (n: number) => Math.round(n * 100) / 100;
const bumpLine = line<Point>().x(point => point[0]).y(point => point[1]).curve(curveBumpX).digits(3);

function spreadLabels(positions: readonly number[], gap: number) {
  const ordered = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  let previous = -Infinity;
  const resolved = [...positions];
  for (const { y, index } of ordered) {
    previous = Math.max(y, previous + gap);
    resolved[index] = previous;
  }
  return resolved;
}

function signed(value: number) {
  const absolute = Math.abs(Math.round(value * 10) / 10);
  return `${value < 0 ? "−" : value > 0 ? "+" : ""}${absolute}`;
}

function distance(point: Point, from: Point, to: Point) {
  const [x, y] = point;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const amount = Math.max(0, Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - from[0] - amount * dx, y - from[1] - amount * dy);
}

export function RankingDetail({ example, compact, source, theme }: {
  example: ChartExample; compact: boolean; source: CartesianData; theme: ChartTheme;
}) {
  const uid = useId();
  const bump = example.family === "bump";
  const fastest = example.id === "bump-ascending";
  const response = example.id === "slope-response-time";
  const loadingExample = example.id.endsWith("-loading");
  const [loading, setLoading] = useState(loadingExample && !compact);
  const [selected, setSelected] = useState<{ series: number; at: number } | null>(null);
  const [legend, setLegend] = useState<number | null>(null);
  const ratio = bump ? 2 : response ? 1 : 4 / 3;
  const { plot, width, height: measuredHeight } = usePlotSize<HTMLDivElement>(577, 577 / ratio);
  const height = compact ? measuredHeight : width / ratio;
  const top = compact ? 10 : bump ? 40 : 44;
  const bottom = Math.max(top + 1, height - (compact ? 10 : bump ? 40 : 20));
  const span = bottom - top;
  const margin = compact ? 10 : response ? 127 : loadingExample ? 133.6 : 107.2;
  const left = bump ? compact ? 12 : 40 : Math.min(margin, width / 2 - 6);
  const right = bump ? width - (compact ? 12 : fastest ? 24 : loadingExample ? 59 : 94) : width - left;
  const { categories } = source;
  const series = !bump && loadingExample
    ? slopeLoadingOrder.flatMap(name => source.series.filter(item => item.name === name)) : source.series;
  const length = series.length;
  const slot = (right - left) / (categories.length - .8);
  const xAt = (i: number) => bump ? left + (i + .1) * slot : i === 0 ? left : right;
  const yRank = (rank: number) => top + (rank - .5) / length * span;
  const [min, max] = response ? [0, 30] : loadingExample ? [25, 60] : [60, 85];
  const ySlope = (value: number) => bottom - (value - min) / (max - min) * span;
  const ranks = categories.map((_, index) => series.map((item, i) => [item.values[index]!, i])
    .sort((a, b) => (fastest ? a[0] - b[0] : b[0] - a[0]) || a[1] - b[1]).map(([, i]) => i));
  const positions = series.map((item, i) => item.values.map((value, j): Point => [
    xAt(j), bump ? yRank(ranks[j].indexOf(i) + 1) : ySlope(value!),
  ]));
  const firstLabels = spreadLabels(positions.map(points => points[0][1]), 14);
  const lastLabels = spreadLabels(positions.map(points => points.at(-1)![1]), 14);
  const last = categories.length - 1;
  const active = loading || compact ? null : selected;
  const emphasized = active?.series ?? legend;
  const paint = (i: number) => {
    if (bump) return theme.colors[i];
    const item = series[i];
    const change = item.values[1]! - item.values[0]!;
    return response ? change < 0 ? theme.colors[1] : theme.muted
      : change < 0 ? "var(--chart-negative)" : theme.colors[0];
  };
  const format = (value: number) => response ? `${value.toFixed(1)}h` : String(value);
  const inspected = active ? series[active.series] : undefined;
  const delta = inspected ? inspected.values[1]! - inspected.values[0]! : 0;
  const displayChange = response ? `${signed(delta)}h` : signed(delta);
  const entries = inspected && active ? [
    ...categories.map((name, i) => {
      const value = inspected.values[i]!;
      const measure = fastest ? `${value.toFixed(1)}s` : loadingExample ? `${value} deals` : `${value.toFixed(1)}%`;
      return { name, color: paint(active.series), value: bump ? `#${ranks[i].indexOf(active.series) + 1} · ${measure}` : format(value) };
    }),
    ...(!bump ? [{ name: "Change", color: paint(active.series), value: `${displayChange} (${signed(delta / inspected.values[0]! * 100)}%)` }] : []),
  ] : [];
  const currentPoint = active && positions[active.series][active.at];
  const tipWidth = Math.min(width - 16, bump ? fastest ? 140 : loadingExample ? 195 : 156 : response ? 188 : 169);
  const tipLeft = currentPoint ? Math.max(8, Math.min(width - tipWidth - 8, currentPoint[0] + 16)) : 8;
  const tipTop = currentPoint ? Math.max(8, Math.min(height - (bump ? 194 : response ? 136 : 116) - 8, currentPoint[1] - 58)) : 8;
  const fetching = bump ? "Fetching standings…" : "Fetching survey scores…";

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (loading || compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointer: Point = [event.clientX - bounds.left, event.clientY - bounds.top];
    if (pointer[1] < top - 12 || pointer[1] > bottom + 10 || pointer[0] < left - 12 || pointer[0] > (bump && !fastest ? width : right + 12)) {
      setSelected(null);
      return;
    }
    const at = bump ? Math.max(0, Math.min(last, Math.round((pointer[0] - xAt(0)) / slot))) : pointer[0] < width / 2 ? 0 : last;
    const score = (points: Point[]) => bump ? Math.abs(points[at][1] - pointer[1]) : distance(pointer, points[0], points[last]);
    const index = positions.reduce((nearest, points, i) => score(points) < score(positions[nearest]) ? i : nearest, 0);
    setSelected({ series: index, at });
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>) {
    if (compact || loading) return;
    if (event.key === "Escape" && selected) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const order = bump ? ranks[0] : positions.map((_, i) => i).sort((a, b) => positions[a][last][1] - positions[b][last][1]);
    const index = selected ? order.indexOf(selected.series) : null;
    const prev = order[Math.max(0, (index ?? length) - 1)];
    const next = order[Math.min(length - 1, (index ?? -1) + 1)];
    const target = { Home: order[0], End: bump ? ranks[last][length - 1] : order[length - 1],
      ArrowLeft: prev, ArrowRight: next, ArrowUp: prev, ArrowDown: next }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setSelected({ series: target, at: 0 });
  }

  return <div className="ranking-detail" data-ranking={example.id} data-ranking-compact={compact || undefined}>
    {loadingExample && !compact && <div className="ranking-controls"><Toggle pressed={loading}
      onPressedChange={value => { setLoading(value); setSelected(null); }}><span aria-hidden="true" />Loading</Toggle></div>}
    <div className="ranking-body" data-ranking-legend={fastest && !compact || undefined}>
      <div className="ranking-plot" ref={plot} style={{ aspectRatio: ratio }} aria-busy={loading || undefined}>
        <svg viewBox={`0 0 ${width} ${height}`} className="cartesian-focus-surface" role="img" aria-roledescription="chart"
          aria-label={example.title} aria-describedby={compact || loading ? undefined : `${uid}-help`} tabIndex={compact || loading ? undefined : 0}
          onPointerMove={inspect} onPointerUp={event => { if (event.pointerType === "touch") inspect(event); }}
          onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
          onPointerCancel={() => setSelected(null)} onKeyDown={inspectKey} onBlur={() => setSelected(null)}>
          {!compact && !loading && <desc id={`${uid}-help`}>Use the arrow keys to inspect series. Home and End jump to the first and last series. Escape clears the selection.</desc>}
          <g aria-hidden="true">
            {categories.map((name, i) => <line data-rank-grid="" key={name} x1={rounded(xAt(i))} x2={rounded(xAt(i))} y1={top} y2={rounded(bottom)}
              stroke={theme.grid} strokeDasharray={bump ? "4 4" : undefined} />)}
            {loading && <g className="ranking-skeleton" fill={theme.text} stroke={theme.text}>
              {bump ? bumpSkeleton.map((ranks, index) => {
                const dots = ranks.map((rank, i): Point => [xAt(i), yRank(rank)]);
                return <g key={index}>
                  <path data-rank-skeleton="" d={bumpLine(dots) ?? ""} fill="none" strokeWidth="3" strokeOpacity=".27" strokeLinecap="round" />
                  {dots.map(([x, y]) => <circle key={x} cx={rounded(x)} cy={rounded(y)} r="5.5" fillOpacity=".45" stroke="none" />)}
                  <rect x={rounded(xAt(last) + 15)} y={rounded(dots[last][1] - 4)} width="32" height="8" rx="4" fillOpacity=".32" stroke="none" />
                </g>;
              }) : slopeSkeleton.map(([a, b, l, r], index) => {
                const y1 = top + a * span;
                const y2 = top + b * span;
                return <g key={index}>
                  <line data-rank-skeleton="" x1={left} y1={rounded(y1)} x2={right} y2={rounded(y2)} strokeWidth="2" strokeOpacity=".27" />
                  <circle cx={left} cy={rounded(y1)} r="4.5" fillOpacity=".45" stroke="none" />
                  <circle cx={right} cy={rounded(y2)} r="4.5" fillOpacity=".45" stroke="none" />
                  <rect x={left - l - 14} y={rounded(y1 - 4)} width={l} height="8" rx="4" fillOpacity=".32" stroke="none" />
                  <rect x={right + 14} y={rounded(y2 - 4)} width={r} height="8" rx="4" fillOpacity=".32" stroke="none" />
                </g>;
              })}
            </g>}
            {!loading && positions.map((points, index) => {
              const item = series[index];
              const color = paint(index);
              const strokeWidth = bump || response || emphasized === index ? 3 : 2;
              const visible = emphasized === null || emphasized === index;
              const labelGap = response || bump ? 15 : 14;
              const labelColor = bump ? `color-mix(in oklab, ${color} 65%, var(--foreground))` : emphasized === index ? theme.text : theme.muted;
              const end = points[last];
              return <g key={item.name} className="ranking-series" opacity={visible ? 1 : .22} data-ranking-series={item.name}
                style={{ "--ranking-delay": `${index * 45}ms` } as CSSProperties}>
                {bump ? <path data-rank-line="" d={bumpLine(points) ?? ""} pathLength={1} fill="none" stroke={color} strokeWidth={strokeWidth}
                  strokeLinecap="round" strokeLinejoin="round" /> : <line data-rank-line="" pathLength={1} x1={rounded(points[0][0])}
                  x2={rounded(end[0])} y1={rounded(points[0][1])} y2={rounded(end[1])} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
                {points.map(([x, y], i) => <circle key={i} cx={rounded(x)} cy={rounded(y)} r={bump ? 5.5 : 4.5}
                  fill={color} stroke="var(--background)" strokeWidth="2" data-rank-point="" />)}
                {!compact && !fastest && <>
                  {!bump && <text x={rounded(left - labelGap)} y={rounded(firstLabels[index])} textAnchor="end" dominantBaseline="middle"
                    fill={labelColor} fontSize="12" fontWeight={emphasized === index ? 500 : 400} data-rank-label="from">
                    {`${item.name}  ${format(item.values[0]!)}`}
                  </text>}
                  <text x={rounded(end[0] + labelGap)} y={rounded(bump ? end[1] : lastLabels[index])} dominantBaseline="middle" fill={labelColor}
                    fontSize="12" fontWeight={emphasized === index ? bump ? 600 : 500 : bump ? 500 : 400} data-rank-label="to">
                    {bump ? item.name : `${format(item.values[last]!)}  ${item.name}`}
                  </text>
                </>}
              </g>;
            })}
            {!compact && <g fill={theme.muted} fontSize="12" data-rank-axis="">
              {categories.map((name, i) => <text key={name} x={rounded(xAt(i))} y={bump ? height - 16 : 18.4} textAnchor="middle"
                fontSize={bump ? 12 : 13} fontWeight={bump ? 400 : 500}>{name}</text>)}
              {bump && series.map((item, i) => <text key={item.name} x={28} y={rounded(yRank(i + 1))} textAnchor="end"
                dominantBaseline="middle">#{i + 1}</text>)}
            </g>}
          </g>
        </svg>
        {loading && bump && <span className="ranking-busy" role="status">Loading standings</span>}
        {inspected && <div className="ranking-tip" style={{ inlineSize: tipWidth, insetInlineStart: tipLeft, insetBlockStart: tipTop }}>
          <CartesianReadout label={inspected.name} entries={entries} />
        </div>}
      </div>
      {fastest && !compact && <div className="ranking-legend" aria-label="June, seconds">
        <strong>June, seconds</strong>
        {series.map((item, i) => <Toggle key={item.name} pressed={legend === i}
          onPressedChange={pressed => setLegend(pressed ? i : null)} onPointerEnter={() => setLegend(i)} onPointerLeave={() => setLegend(null)}
          onFocus={() => setLegend(i)} onBlur={() => setLegend(null)}>
          <i style={{ background: paint(i) }} aria-hidden="true" />{item.name}<span>{item.values.at(-1)}</span>
        </Toggle>)}
      </div>}
    </div>
    {!compact && summaries[example.id] && <div className="ranking-footer">
      <strong>{loading ? fetching : summaries[example.id][0]}</strong><span>{summaries[example.id][1]}</span>
    </div>}
  </div>;
}
