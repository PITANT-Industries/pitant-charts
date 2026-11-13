import { useMemo, useState, type PointerEvent } from "react";
import { contourDensity } from "d3-contour";
import { geoPath } from "d3-geo";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { useChartTheme } from "../theme";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linear, markEvents, normal,
  percent, seriesColors, ticks, useVariantLoading, xyData, type DemoProps, type Point,
} from "./primitives";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dayMs = 86_400_000;

function generateScatter(id: string): Point[] {
  const random = createRandom(18342);
  if (id === "scatter-jitter") return Array.from({ length: 522 }, (_, index) => {
    const month = index % 12;
    const reviewed = index >= 242;
    const y = reviewed ? Math.max(25, Math.min(2500, 110 + random() ** 2.7 * 2400)) : Math.round(15 + random() ** 1.8 * 480);
    return { x: month + 1, y, group: reviewed ? "Reviewed" : "Auto-merged", label: monthLabels[month] };
  }).sort((a, b) => a.x - b.x);
  if (id === "scatter-rings") return Array.from({ length: 21 }, (_, i) => ({
    x: Date.UTC(2026, 9, 5) + i * dayMs,
    y: Math.round(1200 + i * 10.2 + Math.sin(i / 1.7) * 48 + normal(random) * 43), group: "Orders",
  }));
  if (id === "scatter-solid") return Array.from({ length: 60 }, (_, i) => ({
    x: Date.UTC(2026, 8, 1) + i * dayMs,
    y: Math.round(Math.max(40, Math.min(250, 188 - i * 1.06 + Math.sin(i / 4) * 16 + normal(random) * 24))), group: "API",
  }));
  if (id === "scatter-outline") return Array.from({ length: 16 }, (_, i) => ({
    x: Date.UTC(2026, 6, 6) + i * 7 * dayMs,
    y: Math.max(0, 11.2 + i * .63 + Math.sin(i / 2) * 2.3 + normal(random) * 1.6), group: "Trials converted",
  }));
  return Array.from({ length: 24 }, (_, week) => {
    const x = Date.UTC(2026, 4, 18) + week * 7 * dayMs;
    return [
      { x, y: Math.max(8, Math.round(260 + Math.sin(week / 3) * 155 + week * 2 + normal(random) * 22)), group: "Organic" },
      { x, y: Math.max(8, Math.round(165 + Math.cos((week + 1) / 2.5) * 103 + normal(random) * 17)), group: "Referral" },
    ];
  }).flat();
}

function CanvasScatter({ example, compact, data }: DemoProps) {
  const [count, setCount] = useState(10000);
  const theme = useChartTheme();
  const points = useMemo(() => {
    const custom = xyData(data);
    if (custom) return custom;
    const random = createRandom(511);
    return Array.from({ length: compact ? 1600 : count }, () => {
      const x = random() * 7;
      const y = Math.max(1, 43 + Math.sin(x * 1.5) * 10 + normal(random) * 13);
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
    xAxis: { type: "value", name: compact ? "" : "Day", nameLocation: "middle", nameGap: 27, nameTextStyle: { color: theme.muted }, axisLabel: { color: theme.muted }, splitLine: { lineStyle: { color: theme.grid, type: "dashed" } } },
    yAxis: { type: "value", name: "Latency", nameTextStyle: { color: theme.muted }, axisLabel: { color: theme.muted }, splitLine: { lineStyle: { color: theme.grid, type: "dashed" } } },
    tooltip: { trigger: "item", show: !compact, confine: true, textStyle: { color: theme.text }, backgroundColor: theme.surface, borderColor: theme.grid, valueFormatter: (value) => typeof value === "number" ? format.format(value) : String(value) },
    series: names.map((name, index) => ({
      name, type: "scatter", symbolSize: compact ? 2 : 3, data: points.filter((point) => point.group === name).map(({ x, y }) => [x, y]),
      itemStyle: { color: palette[index], opacity: .25 }, progressive: 2000, progressiveThreshold: 3000,
      emphasis: { itemStyle: { opacity: 1 } },
    })),
  };
  return (
    <div className="stat-demo stat-canvas">
      {!compact && !data && <div className="stat-controls">
        {[10000, 50000].map((size) => <button className="stat-control" type="button" aria-pressed={count === size} key={size} onClick={() => setCount(size)}>{format.format(size)} points</button>)}
      </div>}
      <EChart option={options} label={example.title} compact={compact} renderer="canvas" />
    </div>
  );
}

export function Scatter(props: DemoProps) {
  if (props.example.id === "scatter-large-data") return <CanvasScatter {...props} />;
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
  const fixtureDates = !data && !jitter;
  const points = useMemo(() => xyData(data) ?? generateScatter(id), [data, id]);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(points.map((point) => point.group))];
  const palette = seriesColors(names, Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`), data);
  const xd: [number, number] = jitter && !data ? [.5, 12.5] : domain(points.map(({ x }) => x), .05);
  const yd: [number, number] = !data && (solid || outlined || jitter) ? [0, solid ? 250 : outlined ? 23 : 2600] : domain(points.map(({ y }) => y), .13);
  const x = linear(xd, [PLOT.left, PLOT.right]);
  const y = linear(yd, [PLOT.bottom, PLOT.top]);
  const xTicks = !data ? jitter ? monthLabels.map((_, i) => i + 1) :
    (defaultScatter ? [0, 8, 16, 23] : rings ? [0, 5, 10, 15, 20] : outlined ? [0, 5, 10, 15] : [0, 15, 30, 44, 59]).map((i) => points[defaultScatter ? i * 2 : i].x) : ticks(xd, 6);
  const yTicks = !data && (solid || outlined || jitter) ? (solid ? [0, 50, 100, 150, 200, 250] : outlined ? [0, 5, 10, 15, 20] : [0, 500, 1000, 1500, 2000, 2500]) : ticks(yd, 5);
  const sizes = rings ? [4.1, 8.5] : solid || jitter ? [jitter ? 2.15 : 3.5, 0] : [3.9, 6.8];
  const axisY = (value: number) => outlined ? percent.format(value / 100) : solid ? `${format.format(value)} ms` : jitter ? compactNumber.format(value) : format.format(value);
  const axisX = (value: number) => fixtureDates ? dateLabel.format(value) : jitter && !data ? monthLabels[value - 1] : format.format(value);
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

function clusteredPoints(data: DemoProps["data"], type: string, id: string) {
  const custom = xyData(data);
  if (custom) return custom;
  const random = createRandom(4871);
  const count = type === "hexbin" ? id === "hexbin-average" ? 1200 : 900 : 500;
  return Array.from({ length: count }, (_, index): Point => {
    const groupIndex = index % 3;
    const x = 37 + groupIndex * 19 + normal(random) * (groupIndex ? 9 : 12);
    const y = 30 + groupIndex * 15 + (x - 45) * .33 + normal(random) * 11;
    return {
      x, y, group: id === "density-groups" ? ["Entry", "Professional", "Performance"][groupIndex] : "Observations",
      value: 7 + .65 * x + .25 * y + random() * 8,
    };
  });
}

function contextFor(points: Point[]) {
  const xd = domain(points.map(({ x }) => x), .055);
  const yd = domain(points.map(({ y }) => y), .09);
  const x = linear(xd, [PLOT.left, PLOT.right]);
  const y = linear(yd, [PLOT.bottom, PLOT.top]);
  const xTicks = ticks(xd, 6);
  const yTicks = ticks(yd, 5);
  return { x, y, xTicks, yTicks };
}

export function Hexbin({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const points = useMemo(() => clusteredPoints(data, "hexbin", example.id), [data, example.id]);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const { x, y, xTicks, yTicks } = contextFor(points);
  const radius = compact ? 19 : 15;
  const rows = Math.round((PLOT.bottom - PLOT.top) / (radius * 1.5));
  const cols = Math.round((PLOT.right - PLOT.left) / (radius * Math.sqrt(3)));
  const average = example.id === "hexbin-average";
  const specialTooltip = example.id === "hexbin-custom-tooltip";
  const bins = new Map<string, { cx: number; cy: number; points: Point[] }>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      bins.set(`${row}-${col}`, {
        cx: PLOT.left + radius * Math.sqrt(3) * (col + .5 + (row % 2) * .5),
        cy: PLOT.top + radius * (1 + row * 1.5),
        points: [],
      });
    }
  }
  points.forEach((point) => {
    const px = x(point.x);
    const py = y(point.y);
    const row = Math.floor((py - PLOT.top - radius) / (radius * 1.5));
    const col = Math.floor((px - PLOT.left) / (radius * Math.sqrt(3)));
    let nearest: { cx: number; cy: number; points: Point[] } | undefined;
    let best = Infinity;
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 2); r++) {
      for (let c = Math.max(0, col - 2); c <= Math.min(cols - 1, col + 1); c++) {
        const bin = bins.get(`${r}-${c}`);
        if (!bin) continue;
        const distance = Math.hypot(px - bin.cx, py - bin.cy);
        if (distance >= best) continue;
        best = distance;
        nearest = bin;
      }
    }
    nearest?.points.push(point);
  });
  const draw = [...bins.values()].filter(({ points }) => points.length).map((bin) => {
    const value = average ? bin.points.reduce((sum, p) => sum + (p.value ?? p.y), 0) / bin.points.length : bin.points.length;
    const polygon = Array.from({ length: 6 }, (_, index) => {
      const angle = (index + .5) / 6 * 2 * Math.PI;
      return `${bin.cx + Math.cos(angle) * (radius - 1)},${bin.cy + Math.sin(angle) * (radius - 1)}`;
    }).join(" ");
    const lines = [average ? "Mean per bin" : "Observations in bin", format.format(value)];
    if (specialTooltip) lines.push(`${percent.format(bin.points.length / points.length)} of all observations`);
    return { ...bin, value, polygon, hint: { x: bin.cx, y: bin.cy, lines } };
  });
  const min = Math.min(...draw.map(({ value }) => value));
  const max = Math.max(...draw.map(({ value }) => value));
  const color = "var(--chart-1)";
  const legend = (
    <div className="stat-legend">
      <span>{format.format(min)}</span>
      <i className="stat-heat-gradient" style={{ width: 88, background: `linear-gradient(90deg, transparent, ${color})` }} />
      <span>{format.format(max)} {average ? "average" : "observations"}</span>
    </div>
  );
  return (
    <SvgPlot example={example} compact={compact} hints={draw.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map((n) => format.format(n))} y={yTicks.map(y)} yLabels={yTicks.map((n) => format.format(n))} />
          {draw.map(({ value, hint, polygon }, index) => {
            const normalized = max === min ? 1 : (value - min) / (max - min);
            return (
              <polygon key={index} className={loading ? "stat-load" : undefined} points={polygon} fill={color}
                fillOpacity={(average ? Math.ceil(normalized * 5) / 5 : normalized) * .77 + .18}
                stroke={active === hint ? "var(--foreground)" : "none"}
                opacity={active && active !== hint ? .55 : 1}
                {...markEvents(hint, show, !loading)}
              />
            );
          })}
        </>
      )}
    </SvgPlot>
  );
}

export function Density({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const [hidden, setHidden] = useState<string[]>([]);
  const contoursOnly = example.id === "density-contours";
  const points = useMemo(() => clusteredPoints(data, "density", example.id), [data, example.id]);
  const { x, y, xTicks, yTicks } = contextFor(points);
  const names = [...new Set(points.map(({ group }) => group))];
  const palette = seriesColors(names, Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`), data);
  const models = names.map((name, index) => {
    const group = points.filter((point) => point.group === name);
    const marks = group.map((p) => ({ ...p, px: x(p.x), py: y(p.y) }));
    const surfaces = contourDensity<typeof marks[number]>().x((p) => p.px - PLOT.left).y((p) => p.py - PLOT.top)
      .size([PLOT.right - PLOT.left, PLOT.bottom - PLOT.top]).bandwidth(contoursOnly ? 16 : 20).thresholds(contoursOnly ? 12 : 8)(marks);
    const hints = marks.filter((_, i) => i % 7 === 0).map(({ px, py, x, y }) => ({
      x: px, y: py, lines: [name, `X: ${format.format(x)}`, `Y: ${format.format(y)}`],
    }));
    return { name, color: palette[index], marks, surfaces, hints };
  });
  const shown = models.filter(({ name }) => !hidden.includes(name));
  const path = geoPath();
  const legend = names.length > 1 && <Legend entries={models.map(({ name, color }) => ({ name, color }))} active={shown.map(({ name }) => name)} onToggle={compact ? undefined : (name) => setHidden((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])} />;
  if (!points.length) return <NoData example={example} compact={compact} />;
  return (
    <SvgPlot example={example} compact={compact} hints={contoursOnly ? [] : shown.flatMap(({ hints }) => hints)} loading={loading} controls={button} legend={legend}>
      {(show, active, id) => (
        <>
          <defs><clipPath id={`${id}-contour`}><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} /></clipPath></defs>
          {!contoursOnly && <Grid x={xTicks.map(x)} xLabels={xTicks.map((n) => format.format(n))} y={yTicks.map(y)} yLabels={yTicks.map((n) => format.format(n))} />}
          <g clipPath={`url(#${id}-contour)`}>
            {shown.map(({ name, color, marks, surfaces, hints }) => (
              <g key={name}>
                <g transform={`translate(${PLOT.left} ${PLOT.top})`}>
                  {surfaces.map((surface, index) => <path key={index} className={loading ? "stat-load" : undefined} d={path(surface) ?? undefined} fill={contoursOnly ? "none" : color} fillOpacity={contoursOnly ? 0 : .095 + index * .008} stroke={color} strokeOpacity={contoursOnly ? .8 : .37} strokeWidth={contoursOnly ? 1.4 : 1} />)}
                </g>
                {!contoursOnly && marks.filter((_, index) => !compact || index % 3 === 0).map(({ px, py }, index) => <circle key={index} className={loading ? "stat-load" : undefined} cx={px} cy={py} r={1.8} fill={color} opacity=".42" />)}
                {!contoursOnly && hints.map((hint, index) => <circle key={index} cx={hint.x} cy={hint.y} r={active === hint ? 4 : 6} fill={active === hint ? color : "transparent"} {...markEvents(hint, show, !loading)} />)}
              </g>
            ))}
          </g>
        </>
      )}
    </SvgPlot>
  );
}
