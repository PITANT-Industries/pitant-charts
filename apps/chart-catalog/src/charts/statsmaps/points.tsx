import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { contourDensity } from "d3-contour";
import { geoPath } from "d3-geo";
import type { EChartsOption } from "echarts";
import { Choices } from "../../ui/Choices";
import EChart from "../EChart";
import { useChartTheme } from "../theme";
import { ReferenceScatter } from "./ReferenceScatter";
import { scatterFixtures, type ScatterKind } from "./scatter-fixtures";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linear, normal,
  percent, seriesColors, ticks, useVariantLoading, xyData, type DemoProps, type HoverInfo, type Point,
} from "./primitives";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dayMs = 86_400_000;
const requestStart = Date.UTC(2026, 9, 5);
const scatterCounts = [10000, 50000].map(value => ({ value: String(value), label: `${value / 1000}k`, ariaLabel: `${format.format(value)} points` }));
const dollar = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fractionalShare = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });

function jitterPoints(): Point[] {
  const random = createRandom(18342);
  return Array.from({ length: 522 }, (_, index) => {
    const month = index % 12;
    const reviewed = index >= 242;
    const y = reviewed ? Math.max(25, Math.min(2500, 110 + random() ** 2.7 * 2400)) : Math.round(15 + random() ** 1.8 * 480);
    return { x: month + 1, y, group: reviewed ? "Reviewed" : "Auto-merged", label: monthLabels[month] };
  }).sort((a, b) => a.x - b.x);
}

function CanvasScatter({ example, compact, data }: DemoProps) {
  const [count, setCount] = useState(10000);
  const theme = useChartTheme();
  const points = useMemo(() => {
    const custom = xyData(data);
    if (custom) return custom;
    const random = createRandom(511);
    return Array.from({ length: compact ? 1600 : count }, () => {
      const day = random() * 7;
      const x = requestStart + day * dayMs;
      const y = Math.min(998, Math.round(Math.max(18, (125 + Math.sin(day * 1.5) * 18) * Math.exp(normal(random) * .64))));
      return { x, y, group: "Requests" };
    });
  }, [data, compact, count]);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(points.map(({ group }) => group))];
  const palette = seriesColors(names, theme.colors, data);
  const options: EChartsOption = {
    animation: false,
    color: palette,
    grid: { top: 22, left: 48, right: 24, bottom: 39, containLabel: false },
    xAxis: { type: data ? "value" : "time", min: data ? undefined : requestStart, max: data ? undefined : requestStart + dayMs * 7,
      axisLabel: { color: theme.muted, formatter: (value: number) => data ? format.format(value) : dateLabel.format(value) }, splitLine: { show: false } },
    yAxis: { type: "value", min: data ? undefined : 0, max: data ? undefined : 1000, interval: data ? undefined : 200,
      axisLabel: { color: theme.muted, formatter: (value: number) => value === 1000 && !data ? "1k" : format.format(value) }, splitLine: { lineStyle: { color: theme.grid, type: "dashed" } } },
    tooltip: { trigger: "item", show: !compact, confine: true, textStyle: { color: theme.text }, backgroundColor: theme.surface, borderColor: theme.grid,
      formatter: params => {
        const point = Array.isArray(params) ? params[0] : params;
        const values = point?.value;
        if (!Array.isArray(values)) return "";
        const [x, y] = values.map(Number);
        return `${data ? format.format(x) : dateLabel.format(x)}<br/>${format.format(y)}${data ? "" : " ms"}`;
      } },
    series: names.map((name, index) => ({
      name, type: "scatter", symbolSize: compact ? 2 : 3, data: points.filter((point) => point.group === name).map(({ x, y }) => [x, y]),
      itemStyle: { color: palette[index], opacity: .25 }, progressive: 2000, progressiveThreshold: 3000,
      emphasis: { itemStyle: { opacity: 1 } },
    })),
  };
  return (
    <div className="stat-demo stat-canvas">
      {!compact && !data && <div className="stat-controls"><span>Points</span><Choices label="Request count" options={scatterCounts} value={String(count)} onChange={size => setCount(Number(size))} itemClassName="stat-control" /></div>}
      <EChart option={options} label={example.title} compact={compact} renderer="canvas" />
      {!compact && !data && <p className="stat-map-summary" role="status">{format.format(points.length)} requests in one week</p>}
    </div>
  );
}

export function Scatter(props: DemoProps) {
  if (props.example.id === "scatter-large-data") return <CanvasScatter {...props} />;
  const kind = props.example.id.slice("scatter-".length);
  if (!props.data?.rows && !props.data?.series && Object.hasOwn(scatterFixtures, kind)) return <ReferenceScatter {...props} kind={kind as ScatterKind} />;
  return <ScatterSvg {...props} />;
}

function ScatterSvg({ example, compact, data }: DemoProps) {
  const id = example.id;
  const defaultScatter = id === "scatter-default";
  const rings = id === "scatter-rings";
  const groupedHover = defaultScatter || rings;
  const outlined = id === "scatter-outline";
  const solid = id === "scatter-solid";
  const jitter = id === "scatter-jitter";
  const points = useMemo(() => xyData(data) ?? (jitter ? jitterPoints() : []), [data, jitter]);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(points.map((point) => point.group))];
  const palette = seriesColors(names, Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`), data);
  const xd: [number, number] = jitter && !data ? [.5, 12.5] : domain(points.map(({ x }) => x), .05);
  const yd: [number, number] = !data && (solid || outlined || jitter) ? [0, solid ? 250 : outlined ? 23 : 2600] : domain(points.map(({ y }) => y), .13);
  const x = linear(xd, [PLOT.left, PLOT.right]);
  const y = linear(yd, [PLOT.bottom, PLOT.top]);
  const xTicks = jitter && !data ? monthLabels.map((_, i) => i + 1) : ticks(xd, 6);
  const yTicks = !data && (solid || outlined || jitter) ? (solid ? [0, 50, 100, 150, 200, 250] : outlined ? [0, 5, 10, 15, 20] : [0, 500, 1000, 1500, 2000, 2500]) : ticks(yd, 5);
  const sizes = rings ? [4.1, 8.5] : solid || jitter ? [jitter ? 2.15 : 3.5, 0] : [3.9, 6.8];
  const axisY = (value: number) => outlined ? percent.format(value / 100) : solid ? `${format.format(value)} ms` : jitter ? compactNumber.format(value) : format.format(value);
  const axisX = (value: number) => jitter && !data ? monthLabels[value - 1] : format.format(value);
  const labelFor = (point: Point) => point.label ?? axisX(point.x);
  const weeks = new Map<number, Point[]>();
  if (groupedHover) for (const point of points) {
    if (!weeks.has(point.x)) weeks.set(point.x, []);
    weeks.get(point.x)?.push(point);
  }
  const jitterRandom = createRandom(7902);
  const positions = points.map((point) => ({
    x: x(point.x) + (jitter ? (jitterRandom() - .5) * 18 : 0), y: y(point.y),
  }));
  const hints = groupedHover ? [...weeks.entries()].sort(([a], [b]) => a - b).map(([week, entries]) => ({
    x: x(week), y: Math.min(...entries.map((point) => y(point.y))), lines: [labelFor(entries[0]), ...entries.map(({ group, y }) => `${group}: ${format.format(y)}${defaultScatter && !data ? " signups" : ""}`)],
  })) : points.map((point, index) => ({
    ...positions[index], lines: [labelFor(point), `${outlined ? "Conversion" : solid ? "P95 latency" : point.group}: ${jitter ? `${format.format(point.y)} lines` : axisY(point.y)}`],
  }));
  const legend = names.length > 1 && <Legend entries={names.map((name, i) => ({ name, color: palette[i] }))} />;
  function nearest(event: PointerEvent<SVGRectElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return undefined;
    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let winner = 0;
    let shortest = Infinity;
    for (let i = 0; i < hints.length; i++) {
      const hint = hints[i];
      const distance = groupedHover ? Math.abs(at.x - hint.x) : (at.x - hint.x) ** 2 + (at.y - hint.y) ** 2;
      if (distance < shortest) { shortest = distance; winner = i; }
    }
    return hints[winner];
  }
  return (
    <SvgPlot example={example} compact={compact} hints={hints} legend={legend}>
      {(show, active, filterId) => (
        <>
          <defs><filter id={`${filterId}-scatter-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={rings ? 1.5 : .8} /></filter></defs>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map(axisX)} y={yTicks.map(y)} yLabels={groupedHover && !data ? undefined : yTicks.map(axisY)} hideVertical />
          {active && groupedHover && <path d={`M${active.x} ${PLOT.top}V${PLOT.bottom}`} stroke="var(--muted-foreground)" opacity=".45" strokeDasharray="4 5" />}
          {points.map((point, index) => {
            const at = positions[index];
            const focused = groupedHover ? active?.x === at.x : active === hints[index];
            const color = palette[names.indexOf(point.group)];
            return (
              <g key={index} className="stat-scatter-point" opacity={active && !focused ? rings ? .2 : .38 : .94} filter={groupedHover && active && !focused ? `url(#${filterId}-scatter-blur)` : undefined}>
                {sizes[1] > 0 && <circle cx={at.x} cy={at.y} r={sizes[1] + (focused ? 2 : 0)} fill="none" stroke={outlined ? "var(--muted-foreground)" : color} strokeWidth={outlined ? .75 : 1.6} />}
                <circle cx={at.x} cy={at.y} r={sizes[0] + (focused ? 1 : 0)} fill={color} />
              </g>
            );
          })}
          {!compact && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent"
            onPointerMove={(event) => show(nearest(event) ?? null)} onPointerLeave={() => show(null)} />}
        </>
      )}
    </SvgPlot>
  );
}

function clusteredPoints(data: DemoProps["data"], type: "hexbin" | "density", id: string): Point[] {
  const custom = xyData(data);
  if (custom) return custom;
  const random = createRandom(4871);
  const bounded = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
  if (id === "hexbin-average") return Array.from({ length: 1200 }, () => {
    const x = 1 + random() ** 1.8 * 24;
    const y = bounded(x * (1.65 + random() * 2.7) + Math.abs(normal(random)) * 13, 5, 114);
    return { x, y, group: "Rides", value: 3.8 + 1.41 * x + .37 * y + random() * 4 };
  });
  if (id === "hexbin-custom-tooltip") return Array.from({ length: 700 }, () => {
    const x = random() ** 3 * 24;
    return { x, y: bounded(89 - x * 2.8 + normal(random) * 13, 17, 100), group: "Tickets" };
  });
  if (type === "hexbin") return Array.from({ length: 900 }, () => {
    const x = .2 + random() ** 4 * 23.8;
    return { x, y: bounded(Math.round(2 + x * .36 + Math.abs(normal(random)) * 3.1), 1, 17), group: "Sessions" };
  });
  if (id === "density-groups") return ["Ultrabook", "Gaming", "Workstation"].flatMap((group, index) => Array.from({ length: 80 }, () => ({
    x: bounded([1.36, 2.62, 2.23][index] + normal(random) * [.22, .37, .34][index], .8, 3.36),
    y: bounded([14.8, 5.2, 9.6][index] + normal(random) * [2.25, 1.62, 2.16][index], 2, 19.8), group,
  })));
  if (id === "density-contours") return Array.from({ length: 1500 }, (_, index) => {
    const button = index < 690;
    const x = button ? 747 + normal(random) * 29 : random() < .5 ? 184 + normal(random) * 66 : 448 + normal(random) * 109;
    const y = button ? 203 + normal(random) * 39 : 190 + normal(random) * 69;
    return { x: bounded(x, 38, 829), y: bounded(y, 0, 390), group: "Taps" };
  });
  const count = id === "density-loading" ? 360 : 500;
  return Array.from({ length: count }, (_, index): Point => {
    const x = bounded(index % 3 ? 52 + normal(random) * 21 : 11 + normal(random) * 8, 0, 120);
    const y = bounded(529 - x * 3.1 + normal(random) * (index % 3 ? 68 : 83), 90, 707);
    return { x: Math.round(x), y: Math.round(y), group: "Bookings" };
  });
}

function contextFor(points: Point[], domains?: [[number, number], [number, number]]) {
  const xd = domains?.[0] ?? domain(points.map(({ x }) => x), .055);
  const yd = domains?.[1] ?? domain(points.map(({ y }) => y), .09);
  const x = linear(xd, [PLOT.left, PLOT.right]);
  const y = linear(yd, [PLOT.bottom, PLOT.top]);
  return { x, y, xd, yd, xTicks: ticks(xd, 6), yTicks: ticks(yd, 5) };
}

const binShades = ["21%", "43%", "70%", "100%"].map((amount) => `color-mix(in srgb, var(--chart-1) ${amount}, var(--background))`);
const countBuckets = { boundaries: [5, 16, 35], labels: ["1–4", "5–15", "16–34", "35+"] };
const fareBuckets = { boundaries: [15, 25, 40], labels: ["$0–$15", "$15–$25", "$25–$40", "$40+"] };

function nearestMark<T extends { x: number; y: number }>(event: PointerEvent<SVGRectElement>, marks: readonly T[]): T | null {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix || !marks.length) return null;
  const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const distance = (mark: T) => (mark.x - pointer.x) ** 2 + (mark.y - pointer.y) ** 2;
  return marks.reduce((previous, mark) => distance(mark) < distance(previous) ? mark : previous);
}

export function Hexbin({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const points = useMemo(() => clusteredPoints(data, "hexbin", example.id), [data, example.id]);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const average = example.id === "hexbin-average";
  const specialTooltip = example.id === "hexbin-custom-tooltip";
  const { x, y, xd, yd, xTicks, yTicks } = contextFor(points, data ? undefined : average ? [[0, 25], [0, 120]] : specialTooltip ? [[0, 24], [0, 100]] : [[0, 25], [0, 18]]);
  const radius = compact ? 12 : 8;
  const cellWidth = radius * Math.sqrt(3);
  const rowHeight = radius * 1.5;
  const rows = Math.ceil((PLOT.bottom - PLOT.top) / rowHeight);
  const cols = Math.ceil((PLOT.right - PLOT.left) / cellWidth);
  const buckets = average ? fareBuckets : countBuckets;
  const inverseX = linear([PLOT.left, PLOT.right], xd);
  const inverseY = linear([PLOT.bottom, PLOT.top], yd);
  const xText = (value: number) => `${format.format(value)}${data ? "" : average ? " km" : specialTooltip ? "h" : "m"}`;
  const yText = (value: number) => `${format.format(value)}${!data && average ? " min" : ""}`;
  const xt = data ? xTicks : specialTooltip ? [0, 5, 10, 15, 20] : [0, 5, 10, 15, 20, 25];
  const yt = data ? yTicks : average ? [0, 20, 40, 60, 80, 100] : specialTooltip ? [0, 20, 40, 60, 80, 100] : [0, 5, 10, 15];
  const bins = new Map<string, { cx: number; cy: number; points: Point[] }>();
  function cell(row: number, col: number) {
    const key = `${row}-${col}`;
    const existing = bins.get(key);
    if (existing) return existing;
    const bin = { cx: PLOT.left + cellWidth * (col + (row % 2) * .5), cy: PLOT.top + row * rowHeight, points: [] };
    bins.set(key, bin);
    return bin;
  }
  for (const point of points) {
    const px = x(point.x);
    const py = y(point.y);
    const row = Math.round((py - PLOT.top) / rowHeight);
    let closest: [number, number] = [row, 0];
    let best = Infinity;
    for (let r = row - 1; r <= row + 1; r++) {
      const c = Math.round((px - PLOT.left) / cellWidth - (r % 2) * .5);
      const distance = (px - (PLOT.left + cellWidth * (c + (r % 2) * .5))) ** 2 + (py - (PLOT.top + r * rowHeight)) ** 2;
      if (distance >= best) continue;
      best = distance;
      closest = [r, c];
    }
    cell(...closest).points.push(point);
  }
  if (loading) {
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const nx = col / Math.max(1, cols);
        const ny = row / Math.max(1, rows);
        if ((nx - .36) ** 2 / .27 + (ny - .58) ** 2 / .33 < 1.04) cell(row, col);
      }
    }
  }
  const draw = [...bins.values()].sort((a, b) => a.cx - b.cx || a.cy - b.cy).map((bin) => {
    const count = bin.points.length;
    const value = average && count ? bin.points.reduce((sum, p) => sum + (p.value ?? p.y), 0) / count : count;
    const polygon = Array.from({ length: 6 }, (_, index) => {
      const angle = (index + .5) / 6 * 2 * Math.PI;
      return `${bin.cx + Math.cos(angle) * (radius - .65)},${bin.cy + Math.sin(angle) * (radius - .65)}`;
    }).join(" ");
    const xValue = inverseX(bin.cx);
    const yValue = inverseY(bin.cy);
    const lines = specialTooltip ? [`${count} ${count === 1 ? "ticket" : "tickets"}`, `${fractionalShare.format(count / points.length)} of the quarter, around ${xText(xValue)} and a score of ${format.format(Math.round(yValue))}`]
      : [`${xText(xValue)} · ${yText(yValue)}`, average ? `${data ? "Average" : "Average fare"}: ${data ? format.format(value) : dollar.format(value)}` : `${data ? "Observations" : "Sessions"}: ${count}`, ...(average ? [`Count: ${count}`] : [])];
    const bucket = buckets.boundaries.findIndex((limit) => value < limit);
    return { ...bin, value, polygon, color: binShades[bucket < 0 ? binShades.length - 1 : bucket], hint: { x: bin.cx, y: bin.cy, lines } };
  });
  const legend = !loading && !specialTooltip && <div className="stat-legend" aria-label={average ? "Average fare bins" : "Session count bins"}>
    <strong>{average ? data ? "Average" : "Average fare" : data ? "Observations" : "Sessions"}</strong>
    {buckets.labels.map((label, index) => <span key={label}><i aria-hidden="true" style={{ "--legend-color": binShades[index] } as CSSProperties} />{data && average ? label.replaceAll("$", "") : label}</span>)}
  </div>;
  const hints = draw.map(({ hint }) => hint);
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend} loadingLabel="Loading sessions">
      {(show, active, id) => (
        <>
          <defs><clipPath id={`${id}-hexes`}><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} /></clipPath></defs>
          <Grid x={xt.map(x)} xLabels={xt.map(xText)} y={yt.map(y)} yLabels={yt.map(yText)} hideVertical={!average} />
          <g clipPath={`url(#${id}-hexes)`}>
            {draw.map(({ value, points, cx, hint, polygon, color }, index) => (
              <polygon key={index} data-bin-count={points.length} data-bin-value={value} className={loading ? "stat-load" : example.id.endsWith("-loading") ? "stat-hex-reveal" : undefined} style={{ "--stat-delay": `${Math.max(0, cx - PLOT.left) * .58}ms` } as CSSProperties} points={polygon} fill={color}
                stroke={active === hint ? "var(--foreground)" : "none"}
                opacity={active && active !== hint ? .55 : 1}
              />
            ))}
          </g>
          {!compact && !loading && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent" onPointerMove={(event) => show(nearestMark(event, hints))} onPointerLeave={() => show(null)} />}
        </>
      )}
    </SvgPlot>
  );
}

export function Density({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const [hidden, setHidden] = useState<string[]>([]);
  const contoursOnly = example.id === "density-contours";
  const grouped = example.id === "density-groups";
  const loadingExample = example.id === "density-loading";
  const points = useMemo(() => clusteredPoints(data, "density", example.id), [data, example.id]);
  const { models, x, y, xTicks, yTicks } = useMemo(() => {
    const { x, y, xTicks, yTicks } = contextFor(points, data ? undefined : grouped ? [[.5, 3.5], [0, 20]] : contoursOnly ? [[0, 860], [0, 390]] : [[0, 120], [0, 750]]);
    const names = [...new Set(points.map(({ group }) => group))];
    const palette = seriesColors(names, Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`), data);
    const geometry = geoPath();
    const models = names.map((name, index) => {
      const group = points.filter((point) => point.group === name);
      const marks = group.map((p) => ({ ...p, px: x(p.x), py: y(p.y) }));
      const estimator = contourDensity<typeof marks[number]>().x((p) => p.px - PLOT.left).y((p) => p.py - PLOT.top)
        .size([PLOT.right - PLOT.left, PLOT.bottom - PLOT.top]).bandwidth(contoursOnly ? 17 : grouped ? 22 : 20);
      const levels = contoursOnly ? 12 : grouped ? 4 : loading && loadingExample ? 8 : 6;
      const probe = estimator.thresholds(32)(marks);
      const peak = probe.at(-1)?.value ?? 0;
      const surfaces = peak ? estimator.thresholds(Array.from({ length: levels }, (_, i) => peak * (.15 + .79 * i / Math.max(1, levels - 1))))(marks).map((surface) => geometry(surface)) : probe.map((surface) => geometry(surface));
      const hints: HoverInfo[] = marks.map(({ px, py, x, y, label }) => ({
        x: px, y: py, lines: data ? [label ?? name, `X: ${format.format(x)}`, `Y: ${format.format(y)}`]
          : grouped ? [name, `Weight: ${format.format(x)} kg`, `Battery: ${format.format(y)}h`] : [`Booked ahead: ${format.format(x)}d`, `Fare: ${dollar.format(y)}`],
      }));
      return { name, color: palette[index], marks, surfaces, hints };
    });
    return { models, x, y, xTicks, yTicks };
  }, [contoursOnly, data, grouped, loading, loadingExample, points]);
  const shown = models.filter(({ name }) => !hidden.includes(name));
  const legend = models.length > 1 && <Legend entries={models.map(({ name, color }) => ({ name, color }))} active={shown.map(({ name }) => name)} onToggle={compact ? undefined : (name) => setHidden((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])} />;
  if (!points.length) return <NoData example={example} compact={compact} />;
  const xt = data ? xTicks : grouped ? [.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 20, 40, 60, 80, 100, 120];
  const yt = data ? yTicks : grouped ? [0, 5, 10, 15, 20] : [0, 100, 200, 300, 400, 500, 600, 700];
  const axisX = (value: number) => `${format.format(value)}${data ? "" : grouped ? " kg" : "d"}`;
  const axisY = (value: number) => data ? format.format(value) : grouped ? `${format.format(value)}h` : dollar.format(value);
  const hints = contoursOnly ? [] : shown.flatMap((model) => model.hints).sort((a, b) => a.x - b.x || a.y - b.y);
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend} loadingLabel="Loading bookings">
      {(show, active, id) => (
        <>
          <defs><clipPath id={`${id}-contour`}><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} /></clipPath></defs>
          {!contoursOnly && <Grid x={xt.map(x)} xLabels={xt.map(axisX)} y={yt.map(y)} yLabels={yt.map(axisY)} xTitle={!data && !grouped ? "Days booked ahead" : undefined} hideVertical={!grouped} />}
          <g clipPath={`url(#${id}-contour)`}>
            {shown.map(({ name, color, marks, surfaces, hints }) => (
              <g key={name}>
                <g transform={`translate(${PLOT.left} ${PLOT.top})`}>
                  {surfaces.map((surface, index) => surface && <path key={index} data-density-level={index + 1} data-series={name} className={loading ? "stat-load" : loadingExample ? "stat-density-reveal" : undefined} style={{ "--stat-delay": `${index * 56}ms` } as CSSProperties} d={surface} fill={color} fillOpacity={contoursOnly ? .045 + index * .008 : .075 + index * .013} stroke={color} strokeOpacity={contoursOnly ? .51 : .42} strokeWidth={contoursOnly ? 1.4 : 1} />)}
                </g>
                {!contoursOnly && marks.filter((_, index) => loading ? index % 5 === 0 : !compact || index % 3 === 0).map(({ px, py }, index) => <circle key={index} data-density-point={name} className={loading ? "stat-load" : undefined} cx={px} cy={py} r={grouped ? 2 : 2.5} fill={color} opacity=".42" />)}
                {active && hints.includes(active) && <circle cx={active.x} cy={active.y} r={4.5} fill={color} stroke="var(--background)" strokeWidth="1.3" />}
              </g>
            ))}
          </g>
          {!compact && !loading && !contoursOnly && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent" onPointerMove={(event) => show(nearestMark(event, hints))} onPointerLeave={() => show(null)} />}
        </>
      )}
    </SvgPlot>
  );
}
