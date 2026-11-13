import type { CustomSeriesOption, DefaultLabelFormatterCallbackParams, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import type { useChartTheme } from "../theme";
import { initialLargeCount, type CartesianData } from "./data";
import { lineDate, lineMoney, lineTooltip, type BandBounds } from "./line-format";
import { escapeTooltipHtml } from "../evil-tooltip";
import { splitProfitLossSegments, withAlpha } from "./upstream";

export type ChartTheme = ReturnType<typeof useChartTheme>;

export const transparent = "rgba(0,0,0,0)";
export const up = "#16a984";
export const down = "#db5875";
export const valueFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export const tint = withAlpha;

export function gradient(first: string, last: string, horizontal = false) {
  return {
    type: "linear" as const,
    x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1,
    colorStops: [{ offset: 0, color: first }, { offset: 1, color: last }],
  };
}

export const hatch = {
  symbol: "rect", rotation: -Math.PI / 4,
  dashArrayX: [1, 0], dashArrayY: [1, 4],
} as const;
export const dots = {
  symbol: "circle", dashArrayX: [2, 4], dashArrayY: [2, 4],
} as const;

export function pattern(color: string, mode: "hatch" | "dots" = "hatch") {
  const geometry = mode === "hatch" ? hatch : dots;
  return { ...geometry, dashArrayX: [...geometry.dashArrayX], dashArrayY: [...geometry.dashArrayY], color };
}

export function colorFor(item: ChartSeries, index: number, theme: ChartTheme) {
  return item.color ?? theme.colors[index % theme.colors.length];
}

export function categoryAxis(categories: string[], theme: ChartTheme, boundaryGap = false) {
  return {
    type: "category" as const,
    data: categories,
    boundaryGap,
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true, margin: 10 },
  };
}

export function numericAxis(theme: ChartTheme, splitLine = true) {
  return {
    type: "value" as const,
    splitNumber: 4,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true },
    splitLine: { show: splitLine, lineStyle: { color: theme.grid, type: "dashed" as const } },
  };
}

export function baseOption(data: CartesianData, theme: ChartTheme, compact: boolean, boundaryGap = false): EChartsOption {
  return {
    color: theme.colors,
    textStyle: { fontFamily: theme.fontFamily, color: theme.text },
    grid: { top: 10, right: 15, bottom: 25, left: compact ? 29 : 48 },
    xAxis: categoryAxis(data.categories, theme, boundaryGap),
    yAxis: numericAxis(theme),
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: theme.muted, type: "dashed", opacity: 0.65 } },
      confine: true, backgroundColor: theme.surface, borderColor: theme.grid,
      textStyle: { color: theme.text, fontSize: 12 },
      valueFormatter: value => typeof value === "number" ? valueFormat.format(value) : String(value ?? ""),
    },
    animationDuration: compact ? 300 : 600,
    animationDurationUpdate: 360,
  };
}

export function seriesLegend(series: ChartSeries[], theme: ChartTheme): EChartsOption["legend"] {
  return { data: series.map(item => item.name), textStyle: { color: theme.muted, fontSize: 10 }, itemWidth: 12, itemHeight: 8, bottom: 0 };
}

export interface Controls {
  range: number;
  finish: number;
  selection: [number, number] | null;
  fill: string;
  trend: string;
  count: number;
  activeLegend?: number;
  activeMarker?: number;
  deadlineFill?: "pattern" | "gradient" | "solid";
  brushOffset?: number;
  brushLength?: number;
  chartWidth?: number;
}

export const initialControls: Controls = { range: 30, finish: 100, selection: null, fill: "Gradient", trend: "Dashed", count: initialLargeCount };

function lineFor(item: ChartSeries, index: number, theme: ChartTheme, extra: Partial<LineSeriesOption> = {}): LineSeriesOption {
  const color = colorFor(item, index, theme);
  return {
    type: "line", name: item.name, data: [...item.values], smooth: 0.22, showSymbol: false,
    itemStyle: { color }, lineStyle: { width: 2.3, color },
    emphasis: { focus: "series", scale: 1.4 },
    ...extra,
  };
}

export function signedStroke(item: ChartSeries, activeLegend?: number): CustomSeriesOption {
  const segments = splitProfitLossSegments(item.values);
  return {
    type: "custom", name: `${item.name} stroke`, silent: true, z: 7, clip: true,
    data: segments.map((_, index) => [index]), tooltip: { show: false },
    encode: { x: -1, y: -1 },
    renderItem: (_params, api) => {
      const segment = segments[Number(api.value(0))];
      if (!segment) return;
      const selected = activeLegend === undefined || activeLegend === (segment.positive ? 0 : 1);
      const color = segment.positive ? up : down;
      // ECharts rounds fractional ordinal indices, so interpolate the pixel coordinate instead.
      const points = segment.points.map(([index, value]) => {
        const start = Math.floor(index);
        const a = api.coord([start, value]), b = api.coord([Math.ceil(index), value]);
        return [a[0] + (index - start) * (b[0] - a[0]), a[1]];
      });
      return { type: "polyline", shape: { points }, style: { stroke: selected ? color : tint(color, 0.18), fill: transparent, lineWidth: 2.7, lineJoin: "round" } };
    },
  };
}

export function strokeFade(color: string) {
  return {
    ...gradient(tint(color, 0.09), tint(color, 0.09), true),
    colorStops: [
      { offset: 0, color: tint(color, 0.09) }, { offset: 0.22, color },
      { offset: 0.78, color }, { offset: 1, color: tint(color, 0.09) },
    ],
  };
}

function markRange(start: number, end: number, color: string | ReturnType<typeof gradient>, decal?: ReturnType<typeof pattern>) {
  return [
    { xAxis: start, itemStyle: { color, decal } },
    { xAxis: end },
  ] satisfies NonNullable<NonNullable<LineSeriesOption["markArea"]>["data"]>[number];
}

function releaseEvents(data: CartesianData, values: readonly (number | null)[], active: number | undefined): NonNullable<NonNullable<LineSeriesOption["markPoint"]>["data"]> {
  return data.categories.flatMap((_, position) => {
    const events = data.rows?.[position]?.events;
    const value = values[position];
    if (!Array.isArray(events) || events.length === 0 || typeof value !== "number") return [];
    const names = events.filter((event): event is string => typeof event === "string");
    if (!names.length) return [];
    const cluster = names.length > 1;
    const expanded = cluster && active === position;
    return (expanded ? names : [names.join(", ")]).map((name, index) => ({
      name,
      coord: [position, value],
      value: name,
      symbol: "circle",
      symbolOffset: [expanded ? (index - (names.length - 1) / 2) * 21 : 0, expanded && index % 2 === 0 ? -25 : -13],
      symbolSize: 19,
      label: { show: true, color: "#fff", formatter: cluster && !expanded ? String(names.length) : name.split(" ")[0], fontSize: 9 },
    }));
  });
}

export function trendValues(values: readonly (number | null)[]) {
  const points = values.flatMap((value, index) => typeof value === "number" ? [[index, value]] : []);
  if (points.length < 2) return values.map(value => value);
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const rise = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const run = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  return values.map((_, index) => Math.round((meanY + (index - meanX) * rise / run) * 10) / 10);
}

function movingStats(values: readonly (number | null)[], period: number) {
  return values.map((value, index) => {
    if (value === null || index < period - 1) return null;
    const sample = values.slice(index - period + 1, index + 1).filter((item): item is number => item !== null);
    if (sample.length !== period) return null;
    const average = sample.reduce((sum, item) => sum + item, 0) / sample.length;
    const deviation = Math.sqrt(sample.reduce((sum, item) => sum + (item - average) ** 2, 0) / sample.length);
    return { average, deviation };
  });
}

function clippedTexture(
  color: string,
  upper: readonly (number | null)[],
  lower: readonly (number | null)[] | null,
  axis: number,
  mode: "hatch" | "dots",
  fade = false,
): CustomSeriesOption {
  return {
    type: "custom", data: [0], xAxisIndex: 0, yAxisIndex: axis, silent: true, z: 2,
    tooltip: { show: false }, animation: false,
    renderItem: (params, api) => {
      const box = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      if (!box.width || !box.height) return;
      const top = upper.flatMap((value, position) => value === null ? [] : [api.coord([position, value])]);
      if (top.length < 2) return;
      const bottom = lower
        ? lower.flatMap((value, position) => value === null ? [] : [api.coord([position, value])]).reverse()
        : [[top.at(-1)![0], box.y + box.height], [top[0][0], box.y + box.height]];
      const opacityAt = (x: number) => fade ? Math.min(1, (x - box.x) / (box.width * 0.24), (box.x + box.width - x) / (box.width * 0.24)) : 1;
      const marks = mode === "hatch"
        ? Array.from({ length: Math.ceil((box.width + box.height) / 8) }, (_, i) => {
          const x = box.x - box.height + i * 8;
          return {
            type: "line" as const, shape: { x1: x, y1: box.y + box.height, x2: x + box.height, y2: box.y },
            style: { stroke: color, lineWidth: 1, opacity: Math.max(0, opacityAt(x + box.height / 2)) },
          };
        })
        : Array.from({ length: Math.ceil(box.width / 9) * Math.ceil(box.height / 9) }, (_, i) => {
          const columns = Math.ceil(box.width / 9);
          const x = box.x + i % columns * 9;
          const y = box.y + Math.floor(i / columns) * 9;
          return { type: "circle" as const, shape: { cx: x, cy: y, r: 1.15 }, style: { fill: color } };
        });
      return { type: "group", clipPath: { type: "polygon", shape: { points: [...top, ...bottom] } }, children: marks };
    },
  };
}

function bandBounds(data: CartesianData, item: ChartSeries, id: string): BandBounds {
  const stats = id.includes("bollinger") ? movingStats(item.values, 10) : null;
  const center = stats ? stats.map(value => value?.average ?? null) : item.values;
  const bounds = center.map((value, index) => {
    if (value === null) return { low: null, high: null };
    const row = data.rows?.[index];
    const configured = id === "line-band-ranges" ? row?.[item.name] : row;
    if (!stats && configured && typeof configured === "object" && "low" in configured && "high" in configured &&
        typeof configured.low === "number" && typeof configured.high === "number" && configured.low <= configured.high) {
      return { low: configured.low, high: configured.high };
    }
    const spread = stats ? (stats[index]?.deviation ?? 0) * 2 : Math.max(4, Math.abs(value) * (0.14 + Math.sin(index * 0.19) * 0.035));
    return { low: value - spread, high: value + spread };
  });
  return { lower: bounds.map(({ low }) => low), upper: bounds.map(({ high }) => high) };
}

function buildBand(item: ChartSeries, index: number, theme: ChartTheme, id: string, fill: string, bounds: BandBounds): (LineSeriesOption | CustomSeriesOption)[] {
  const color = colorFor(item, index, theme);
  const { lower, upper } = bounds;
  const width = upper.map((value, position) => value === null ? null : value - (lower[position] ?? 0));
  const fade = id === "line-band-fade";
  const topOnly = id === "line-band-edges";
  const rangeOnly = id === "line-band-range";
  const noEdges = id === "line-band-ranges";
  const floating = id === "line-bollinger";
  const style = fade
    ? { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [
      { offset: 0, color: tint(color, 0) }, { offset: 0.2, color: tint(color, 0.29) },
      { offset: 0.8, color: tint(color, 0.29) }, { offset: 1, color: tint(color, 0) },
    ] }
    : fill === "Solid" || fill === "Pattern" ? tint(color, 0.21)
      : gradient(tint(color, 0.38), tint(color, 0.09));
  const invisible = { show: false };
  const bandName = noEdges ? `${item.name} ` : "";
  const edgeColor = fade ? strokeFade(color) : floating ? theme.colors[2] : color;
  const visibleStyle = { color: edgeColor, width: topOnly || floating ? 1.5 : 1, opacity: noEdges ? 0 : rangeOnly ? 0.95 : 0.72 };
  const upperName = rangeOnly ? "High" : floating ? "Upper band" : `${bandName}Upper estimate`;
  const lowerName = rangeOnly ? "Low" : floating ? "Lower band" : `${bandName}Lower estimate`;
  return [
    ...(!floating ? [
      { ...lineFor({ name: "Band lower", values: lower }, index, theme), stack: `band-${index}`, stackStrategy: "all" as const, silent: true, lineStyle: { opacity: 0 }, tooltip: invisible, z: 1 },
      { ...lineFor({ name: "Band width", values: width }, index, theme), stack: `band-${index}`, stackStrategy: "all" as const, silent: true, lineStyle: { opacity: 0 }, tooltip: invisible, z: 1,
        areaStyle: { opacity: 1, color: style } },
    ] : []),
    { ...lineFor({ name: upperName, values: upper }, index, theme), z: 2,
      lineStyle: { ...visibleStyle, type: topOnly ? [1, 3] : fade ? [4, 4] : "solid" } },
    { ...lineFor({ name: lowerName, values: lower }, index, theme), z: 2,
      lineStyle: { ...visibleStyle, opacity: topOnly ? 0 : visibleStyle.opacity, type: fade ? [4, 4] : "solid" } },
    ...(fill === "Pattern" ? [clippedTexture(tint(color, 0.48), upper, lower, 0, "hatch")] : []),
  ];
}

function formattedTooltip(unit: string, fullData?: CartesianData) {
  return (params: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) => {
    const items = (Array.isArray(params) ? params : [params]).filter(item => typeof item.value === "number" && Number.isFinite(item.value));
    if (!items.length) return "";
    const date = items[0].name ?? "";
    const point = fullData?.categories.indexOf(date) ?? -1;
    const values = fullData && point >= 0 ? fullData.series.map(item => ({ name: item.name, value: item.values[point], marker: "" }))
      : items.map(item => ({ name: item.seriesName ?? "", value: item.value as number, marker: typeof item.marker === "string" ? item.marker : "" }));
    const rows = values.map(({ name, value, marker }) => `<div class="cl-tooltip-row"><span>${marker}${escapeTooltipHtml(name)}</span><strong>${typeof value === "number" ? valueFormat.format(value) + unit : "—"}</strong></div>`).join("");
    return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(date)}</div><div class="cl-tooltip-rows">${rows}</div></div>`;
  };
}

function dateStripes(lastIndex: number, spans: readonly [number, number][], color: string, fade = false): CustomSeriesOption {
  return {
    type: "custom", name: "Date highlights", data: spans, silent: true, z: 0, clip: true,
    animation: false, tooltip: { show: false }, encode: { x: -1, y: -1 },
    renderItem: (params, api) => {
      const box = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      const dayWidth = box.width / Math.max(1, lastIndex);
      const left = Math.max(box.x, box.x + Number(api.value(0)) * dayWidth);
      const right = Math.min(box.x + box.width, box.x + Number(api.value(1)) * dayWidth);
      if (right <= left) return;
      const bottom = box.y + box.height;
      const lines = Array.from({ length: Math.ceil((box.height + right - left) / 6) }, (_, index) => {
        const x = left - box.height + index * 6;
        const progress = (x + box.height / 2 - left) / (right - left);
        return { type: "line" as const, shape: { x1: x, y1: bottom, x2: x + box.height, y2: box.y },
          style: { stroke: color, lineWidth: 1, opacity: fade ? Math.max(0, Math.min(1, 1 - progress)) : 1 } };
      });
      return { type: "group", clipPath: { type: "rect", shape: { x: left, y: box.y, width: right - left, height: box.height } }, children: lines };
    },
  };
}

function glowBackdrop(item: ChartSeries, color: string, accent: string): CustomSeriesOption {
  return {
    type: "custom", name: "Backlight", data: [0], silent: true, z: 1, animation: false,
    tooltip: { show: false }, encode: { x: -1, y: -1 },
    renderItem: (params, api) => {
      const box = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      const points = item.values.flatMap((value, position) => value === null ? [] : [api.coord([position, value])]);
      if (points.length < 2) return;
      const shape = { points: [[box.x, box.y], [box.x + box.width, box.y], ...points.reverse()] };
      return { type: "group", children: ([[0.26, color], [0.75, accent]] as const).map(([x, tone]) => ({
        type: "polygon", shape,
        style: { fill: { type: "radial", x, y: 0.33, r: 0.65, colorStops: [
          { offset: 0, color: tint(tone, 0.32) }, { offset: 0.55, color: tint(tone, 0.1) }, { offset: 1, color: tint(tone, 0) },
        ] } },
      })) };
    },
  };
}

export function buildLine(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls, loading = false): EChartsOption {
  const { id } = example;
  const option = baseOption(data, theme, compact);
  const xAxis = categoryAxis(data.categories, theme);
  const fixed = id === "line-fixed-scale";
  const twoAxes = id.includes("dual-axis") && data.series.length > 1;
  const points = id === "line-points";
  const weekend = id === "line-weekends";

  const deadline = id === "line-deadline" || id === "line-deadline-fills";
  const group = id === "line-date-highlights-brush";
  const loss = id === "line-profit-loss" || id === "line-profit-loss-legend";
  const dashed = id === "line-dashed";

  const glow = id === "line-glow";
  const showY = ["line-dual-axis", "line-grid", "line-table", "line-fixed-scale", "line-export", "line-large-data"].includes(id);
  const decimals = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const lineValueTick = (value: number) => id === "line-dual-axis" || id === "line-export" ? `$${decimals.format(value)}`
    : fixed ? `${value}%` : decimals.format(value);
  const timeAxis = { ...xAxis, axisLabel: { ...xAxis.axisLabel, formatter: (value: string) => value },
    splitLine: id === "line-grid" ? { show: true, lineStyle: { color: theme.grid, type: "dotted" as const } } : undefined };
  const yDefaults = numericAxis(theme, !glow);
  const yAxis = {
    ...yDefaults,
    min: fixed ? 0 : undefined,
    max: fixed ? 100 : undefined,
    interval: fixed ? 20 : undefined,
    axisLabel: { ...yDefaults.axisLabel, show: showY, formatter: lineValueTick },
    splitLine: id === "line-grid" ? { show: true, lineStyle: { color: theme.grid, type: "dotted" as const } } : yDefaults.splitLine,
  };
  option.xAxis = timeAxis;
  option.yAxis = twoAxes ? [
    yAxis,
    { ...numericAxis(theme, false), position: "right", axisLabel: { ...yAxis.axisLabel, formatter: "{value}%" } },
  ] : yAxis;
  if (twoAxes) option.grid = { top: 12, bottom: 25, left: compact ? 32 : 52, right: compact ? 32 : 46 };
  if (id === "line-crosshair-point" || glow) {
    option.tooltip = { ...option.tooltip, axisPointer: { type: "none" } };
  }
  if (glow) {
    option.grid = { top: 5, bottom: 5, left: 5, right: 5 };
    option.xAxis = { ...timeAxis, axisLabel: { ...timeAxis.axisLabel, show: false } };
  }
  if (!showY && !glow && !["line-brush", "line-linked-brush", "line-date-highlights-brush", "line-zoom", "line-synced"].includes(id)) {
    option.grid = { top: 10, bottom: 26, left: 17, right: 18 };
  }
  const markAreas: NonNullable<NonNullable<LineSeriesOption["markArea"]>["data"]> = [];
  const markLines: NonNullable<NonNullable<LineSeriesOption["markLine"]>["data"]> = [];
  const lastIndex = Math.max(0, data.categories.length - 1);
  const datedDue = data.categories.findIndex(category => { const date = lineDate(category); return date?.getUTCMonth() === 9 && date.getUTCDate() === 15; });
  const due = datedDue < 0 ? Math.floor(lastIndex * 0.64) : datedDue;
  const brushOffset = controls.brushOffset ?? 0;
  if (deadline) {
    markLines.push({ xAxis: due, name: "Deadline", lineStyle: { color: down, type: "solid" }, label: { show: id !== "line-deadline-fills", formatter: `Due ${data.categories[due] ?? ""}`, position: "insideStartTop" } });
    if (controls.deadlineFill === "gradient" || controls.deadlineFill === "solid") {
      const fill = controls.deadlineFill === "gradient" ? gradient(tint(down, 0.32), tint(down, 0), true) : tint(down, 0.18);
      markAreas.push(markRange(due, lastIndex, fill));
    }
  }
  const launch = Math.round(((controls.brushLength ?? data.categories.length) - 1) * 0.69) - brushOffset;
  if (group && launch >= 0 && launch <= lastIndex) {
    markLines.push({ xAxis: launch, name: "Launch", lineStyle: { color: down, type: "solid" }, label: { formatter: "Launch" } });
    markAreas.push(markRange(launch, lastIndex, gradient(tint(down, 0.18), tint(down, 0), true), pattern(tint(down, 0.25))));
  }
  if (loss) markLines.push({ yAxis: 0, lineStyle: { color: theme.muted, type: "solid" }, label: { show: false } });
  if (controls.selection) {
    const [start, end] = controls.selection;
    markAreas.push(markRange(start, end, tint(theme.colors[0], 0.17)));
    for (const value of [start, end]) markLines.push({ xAxis: value, lineStyle: { color: theme.colors[0], type: "solid" }, label: { show: false } });
  }
  const series: (LineSeriesOption | CustomSeriesOption)[] = [];
  const hasBand = id.startsWith("line-band") || id === "line-bollinger";
  const detailedTooltip = ["line-dual-axis", "line-grid", "line-points", "line-dashed", "line-markers", "line-legend", "line-time-range", "line-table", "line-projection", "line-projection-manual", "line-profit-loss", "line-profit-loss-legend", "line-weekends", "line-deadline", "line-deadline-fills", "line-glow", "line-trend", "line-crosshair-point", "line-fixed-scale", "line-straight", "line-export", "line-loading", "chart-data-table"].includes(id);
  if (hasBand || detailedTooltip || id === "line-large-data" || id === "line-synced") {
    const label = data.series[0]?.name ?? "";
    const units = id === "line-band-range" ? " °C" : id === "line-large-data" || label === "p95 latency" ? " ms" : label === "Error rate" ? "%" : "";
    const bandPairs = hasBand && id !== "line-band-range" && id !== "line-band-bollinger" && id !== "line-bollinger"
      ? data.series.slice(0, id === "line-band-ranges" ? data.series.length : 1).map(item => bandBounds(data, item, id)) : [];
    const formatter = detailedTooltip || bandPairs.length || id === "line-bollinger" ? lineTooltip(id, data, bandPairs)
      : formattedTooltip(units, id === "line-large-data" ? data : undefined);
    option.tooltip = { ...option.tooltip, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none;", formatter };

    if (id === "line-large-data") {
      option.xAxis = { ...timeAxis, axisLabel: { ...timeAxis.axisLabel, interval: Math.max(0, Math.round(data.categories.length / 4) - 1), formatter: (value: string) => value.split(",")[0] } };
      option.animation = false;
    }
    if (id === "line-synced" && units) option.yAxis = { ...yAxis, axisLabel: { ...yAxis.axisLabel, formatter: `{value}${units}` } };
  }
  const addBand = (item: ChartSeries, index: number) => {
    if (hasBand && (index === 0 || id === "line-band-ranges")) {
      const fill = id === "line-band" || id === "line-band-ranges" ? "Solid" : controls.fill;
      series.push(...buildBand(item, index, theme, id, fill, bandBounds(data, item, id)));
    }
  };
  data.series.forEach((item, index) => {
    addBand(item, index);
    if (id === "line-band-range") return;
    const color = colorFor(item, index, theme);
    const legend = id === "line-legend" || id === "line-export";
    const dimmed = legend && controls.activeLegend !== undefined && controls.activeLegend !== index;
    const lineStyle = glow ? { color: gradient(theme.colors[1], color, true), width: 2.5, shadowBlur: 17, shadowColor: tint(color, 0.8) }
      : { color, opacity: dimmed ? 0.3 : 1, width: loss ? 0 : 2.5 };
    const eventMarkers = id === "line-markers" && index === 0 ? releaseEvents(data, item.values, controls.activeMarker) : [];

    const regular = lineFor(item, index, theme, {
      data: [...item.values], lineStyle: loading ? { ...lineStyle, color: tint(theme.muted, 0.5) } : lineStyle, itemStyle: { color, borderColor: color, borderWidth: points ? 1.4 : 0 },
      smooth: id === "line-straight" || loss || id === "line-large-data" ? false : 0.22,
      showSymbol: points, showAllSymbol: points, symbol: points ? "emptyCircle" : "circle", symbolSize: points ? 8 : 6,
      emphasis: { focus: points ? "self" : "series", scale: points ? 1.5 : 1.4, lineStyle: glow ? { width: 4, shadowBlur: 26 } : undefined },
      blur: points ? { itemStyle: { opacity: 0.24 }, lineStyle: { opacity: 0.9 } } : undefined,
      yAxisIndex: twoAxes ? Math.min(index, 1) : 0,
      markArea: index === 0 && markAreas.length ? { silent: true, data: markAreas } : undefined,
      markLine: index === 0 && markLines.length ? { symbol: ["none", "none"], silent: true, label: { color: theme.muted, fontSize: 9 }, data: markLines } : undefined,
      markPoint: eventMarkers.length ? { symbol: "pin", symbolSize: 24, label: { show: false }, tooltip: { formatter: "{b}: {c}" }, data: eventMarkers } : undefined,
      sampling: id === "line-large-data" ? "lttb" : undefined,
      z: 3 + index,
    });
    if (dashed) {
      const split = Math.max(0, item.values.length - 6);
      series.push({ ...regular, data: item.values.map((value, position) => position <= split ? value : null) });
      series.push({ ...regular, name: regular.name, data: item.values.map((value, position) => position >= split ? value : null),
        lineStyle: { ...lineStyle, type: [6, 4] }, markArea: undefined, markLine: undefined });
    } else if (id === "line-bollinger") {
      series.unshift(regular);
    } else {
      series.push(regular);
    }
    if (glow) series.push(glowBackdrop(item, color, theme.colors[2]));
    if (loss) series.push(signedStroke(item, controls.activeLegend));
    if (id === "line-bollinger" && index === 0) {
      series.push(lineFor({ name: "10-day average", values: movingStats(item.values, 10).map(value => value?.average ?? null) }, index + 1, theme, { smooth: false }));
      option.yAxis = { ...yAxis, scale: true };
    }
  });
  if (id === "line-trend") data.series.forEach((item, index) => {
    const color = theme.colors[(index + 2) % theme.colors.length];
    series.push(lineFor({ name: `${item.name} trend`, values: trendValues(item.values) }, index, theme, {
      smooth: false, lineStyle: { color: controls.trend === "Gradient" ? strokeFade(color) : color,
        width: 2, type: controls.trend === "Dashed" ? [6, 4] : "solid" }, z: 6, tooltip: { show: false }, silent: true,
    }));
  });
  if (id === "line-projection" || id === "line-projection-manual") {
    const primary = data.series[0];
    const final = primary?.values[lastIndex];
    const manual = id === "line-projection-manual";
    const future = (data.rows ?? []).flatMap(row => {
      const projected = manual ? row.forecast : row.goal;
      return typeof row.category === "string" && typeof projected === "number" ? [{ category: row.category, projected }] : [];
    });
    if (typeof final === "number" && future.length) {
      option.xAxis = categoryAxis([...data.categories, ...future.map(row => row.category)], theme);
      const initial = Array.from<null>({ length: lastIndex }).fill(null);
      const prediction = (name: string, values: number[], index: number) => {
        const color = theme.colors[index % theme.colors.length];
        return lineFor({ name, values: [...initial, final, ...values] }, index, theme, {
          lineStyle: { color, type: manual ? [6, 4] : [1, 4], width: 2, cap: "round" }, smooth: false,
        });
      };
      series.push(prediction(manual ? "Forecast" : "Goal", future.map(row => row.projected), 1));
      if (!manual) {
        const fit = trendValues(primary.values.slice(-10));
        const drift = ((fit.at(-1) ?? final) - (fit[0] ?? final)) / Math.max(1, fit.length - 1);
        series.push(prediction("Trend", future.map((_, index) => Math.round(final + drift * (index + 1))), 2));
        series.push({
          type: "line", name: "Forecast start", data: [...initial, final], lineStyle: { opacity: 0 },
          showSymbol: true, symbol: "emptyCircle", symbolSize: 10, itemStyle: { color: theme.colors[0] }, silent: true, tooltip: { show: false },
        });
      }
    }
  }
  if (id === "line-zoom" && !compact) {
    option.dataZoom = [{ type: "inside", start: 0, end: 100, zoomOnMouseWheel: false, moveOnMouseMove: true }];
  }
  if (["line-brush", "line-linked-brush", "line-date-highlights-brush"].includes(id)) {
    option.animationDuration = 180;
    option.animationDurationUpdate = 90;
  }
  if (weekend || group && ((controls.chartWidth ?? 0) - 64) / Math.max(1, data.categories.length) >= 6) {
    const spans: [number, number][] = [];
    data.categories.forEach((label, index) => {
      const weekday = lineDate(label)?.getUTCDay();
      if (weekday === 6) spans.push([index - 0.5, index + 1.5]);
      if (weekday === 0 && index === 0) spans.push([-0.5, 0.5]);
    });
    if (spans.length) series.push(dateStripes(lastIndex, spans, tint(theme.muted, 0.3)));
  }
  if ((id === "line-deadline" || id === "line-deadline-fills") && (!controls.deadlineFill || controls.deadlineFill === "pattern")) {
    series.push(dateStripes(lastIndex, [[due, lastIndex]], tint(down, 0.29), true));
  }
  if (loading) option.tooltip = { ...option.tooltip, show: false, triggerOn: "none" };
  else if (id === "line-loading") option.tooltip = { ...option.tooltip, show: true, triggerOn: "mousemove|click|mousewheel" };
  if (id === "line-time-range") option.animationDurationUpdate = 580;
  option.series = series;
  return option;
}
