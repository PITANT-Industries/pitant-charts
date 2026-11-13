import { useMemo, useState } from "react";
import { contourDensity } from "d3-contour";
import { geoPath } from "d3-geo";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { useChartTheme } from "../theme";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linear, markEvents, normal,
  percent, seriesColors, ticks, useVariantLoading, xyData, type DemoProps, type Point,
} from "./primitives";

function generateScatter(id: string, count: number): Point[] {
  const random = createRandom(18342);
  return Array.from({ length: count }, (_, index) => {
    const x = id === "scatter-jitter" ? index % 8 + 1 + (random() - .5) * .46 : index + 1;
    const group = id === "scatter-solid" || id === "scatter-jitter" || id === "scatter-outline" ? "Activity" : index % 2 ? "Organic" : "Direct";
    const y = Math.max(4, 42 + Math.sin(x / 8) * 9 + (index % 2 ? 14 : 0) + normal(random) * 12);
    return { x, y, group };
  });
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
  const points = xyData(data) ?? generateScatter(id, id === "scatter-solid" ? 60 : id === "scatter-jitter" ? 85 : 34);
  if (!points.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(points.map((point) => point.group))];
  const palette = seriesColors(names, Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`), data);
  const xd = domain(points.map(({ x }) => x), .05);
  const yd = domain(points.map(({ y }) => y), .13);
  const x = linear(xd, [PLOT.left, PLOT.right]);
  const y = linear(yd, [PLOT.bottom, PLOT.top]);
  const xTicks = id === "scatter-jitter" && !data ? [1, 2, 3, 4, 5, 6, 7, 8] : ticks(xd, 6);
  const yTicks = ticks(yd, 5);
  const sizes = id === "scatter-rings" ? [3.3, 8.5] : id === "scatter-solid" ? [3.5, 0] : [2.8, 5.6];
  const horizontal = id === "scatter-jitter" ? "Month" : "Observation";
  const vertical = id === "scatter-outline" ? "Conversion" : id === "scatter-solid" ? "Latency" : id === "scatter-jitter" ? "Pull requests" : "Signups";
  const hints = points.map((point) => ({
    x: x(point.x), y: y(point.y),
    lines: [point.label ?? point.group, `${horizontal}: ${format.format(point.x)}`, `${vertical}: ${id === "scatter-outline" ? percent.format(point.y / 100) : format.format(point.y)}`],
  }));
  const legend = names.length > 1 && <Legend entries={names.map((name, i) => ({ name, color: palette[i] }))} />;
  return (
    <SvgPlot example={example} compact={compact} hints={hints} legend={legend}>
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map((n) => format.format(n))} y={yTicks.map(y)} yLabels={yTicks.map((n) => id === "scatter-outline" ? percent.format(n / 100) : format.format(n))} xTitle={horizontal} yTitle={vertical} />
          {points.map((point, index) => {
            const hint = hints[index];
            const focused = active === hint;
            const color = palette[names.indexOf(point.group)];
            return (
              <g key={index} opacity={active && !focused ? id === "scatter-rings" ? .2 : .4 : .9}>
                {sizes[1] > 0 && <circle cx={hint.x} cy={hint.y} r={sizes[1] + (focused ? 2 : 0)} fill="none" stroke={id === "scatter-outline" ? "var(--muted-foreground)" : color} strokeWidth={id === "scatter-outline" ? .9 : 1.4} />}
                <circle cx={hint.x} cy={hint.y} r={sizes[0] + (focused ? 1 : 0)} fill={color} />
                <circle cx={hint.x} cy={hint.y} r={Math.max(8, sizes[1] + 2)} fill="transparent" {...markEvents(hint, show)} />
              </g>
            );
          })}
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
