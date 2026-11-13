import type { CustomSeriesOption, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import type { useChartTheme } from "../theme";
import type { CartesianData } from "./data";
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
    textStyle: { fontFamily: "Inter, system-ui, sans-serif", color: theme.text },
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
}

export const initialControls: Controls = { range: 30, finish: 100, selection: null, fill: "Gradient", trend: "Dashed", count: 10_000 };

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

function strokeFade(color: string) {
  return {
    ...gradient(tint(color, 0.09), tint(color, 0.09), true),
    colorStops: [
      { offset: 0, color: tint(color, 0.09) }, { offset: 0.22, color },
      { offset: 0.78, color }, { offset: 1, color: tint(color, 0.09) },
    ],
  };
}

function markRange(start: number, end: number, color: string, decal?: ReturnType<typeof pattern>) {
  return [
    { xAxis: start, itemStyle: { color, decal } },
    { xAxis: end },
  ] satisfies NonNullable<NonNullable<LineSeriesOption["markArea"]>["data"]>[number];
}

function releaseEvents(values: readonly (number | null)[], active: number | undefined): NonNullable<NonNullable<LineSeriesOption["markPoint"]>["data"]> {
  const releases = [
    [3, "Release", "v1.0"], [8, "Patch", "v1.1"], [13, "Release", "v1.2"],
    [13, "Hotfix", "v1.2.1"], [23, "Launch", "v2.0"],
  ] as const;
  return releases.flatMap(([position, name, value], marker) => {
    if (position >= values.length || marker === 3 && active !== position) return [];
    const paired = position === 13;
    const expanded = paired && active === position;
    const label = paired && !expanded ? "2" : undefined;
    return [{
      name: label ? "Release and hotfix" : name,
      coord: [position, values[position] ?? 0],
      value,
      symbol: paired ? "circle" : "pin",
      symbolOffset: expanded ? [marker === 3 ? 12 : -12, -9] : paired ? [0, -9] : undefined,
      symbolSize: paired ? 17 : 21,
      label: label ? { show: true, color: "#fff", formatter: label, fontSize: 9 } : { show: false },
    }];
  });
}

function trendValues(values: readonly (number | null)[]) {
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
    if (!sample.length) return null;
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

function buildBand(item: ChartSeries, index: number, theme: ChartTheme, id: string, fill: string, controlsAxis = 0): (LineSeriesOption | CustomSeriesOption)[] {
  const color = colorFor(item, index, theme);
  const stats = id.includes("bollinger") ? movingStats(item.values, 10) : null;
  const center = stats ? stats.map(value => value?.average ?? null) : item.values;
  const widths = center.map((value, position) => value === null ? null
    : stats ? (stats[position]?.deviation ?? 0) * 2
      : Math.max(4, Math.abs(value) * (0.14 + Math.sin(position * 0.19) * 0.035)));
  const lower = center.map((value, position) => value === null ? null : value - (widths[position] ?? 0));
  const width = widths.map(value => value === null ? null : value * 2);
  const upper = center.map((value, position) => value === null ? null : value + (widths[position] ?? 0));
  const style = id === "line-band-fade"
    ? { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [
      { offset: 0, color: tint(color, 0) }, { offset: 0.2, color: tint(color, 0.29) },
      { offset: 0.8, color: tint(color, 0.29) }, { offset: 1, color: tint(color, 0) },
    ] }
    : fill === "Solid" || fill === "Hatched" ? tint(color, 0.21)
      : gradient(tint(color, 0.38), tint(color, 0.09));
  const invisible = { show: false };
  return [
    { ...lineFor({ name: "Band lower", values: lower }, index, theme), yAxisIndex: controlsAxis, stack: `band-${index}`, stackStrategy: "all", silent: true, lineStyle: { opacity: 0 }, tooltip: invisible, z: 1 },
    { ...lineFor({ name: "Band width", values: width }, index, theme), yAxisIndex: controlsAxis, stack: `band-${index}`, stackStrategy: "all", silent: true, lineStyle: { opacity: 0 }, tooltip: invisible, z: 1,
      areaStyle: { opacity: 1, color: style } },
    { ...lineFor({ name: "Upper estimate", values: upper }, index, theme), yAxisIndex: controlsAxis, z: 2,
      lineStyle: { color, width: 1, opacity: /edges|fade/.test(id) ? 0.75 : 0, type: "dotted" } },
    { ...lineFor({ name: "Lower estimate", values: lower }, index, theme), yAxisIndex: controlsAxis, z: 2,
      lineStyle: { color, width: 1, opacity: 0 } },
    ...(fill === "Hatched" ? [clippedTexture(tint(color, 0.48), upper, lower, controlsAxis, "hatch")] : []),
  ];
}

export function buildLine(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls): EChartsOption {
  const { id, family } = example;
  const option = baseOption(data, theme, compact);
  const area = family === "area";
  const live = family === "live-line";
  const xAxis = categoryAxis(data.categories, theme);
  const fixed = id === "line-fixed-scale";
  const twoAxes = id.includes("dual-axis") && data.series.length > 1;
  const rightAxis = id === "live-line-right-axis";
  const points = id === "line-points";
  const bars = id === "line-weekends" || id === "area-date-highlights";
  const interval = id === "area-reference-range";
  const deadline = id === "line-deadline" || id === "line-deadline-fills" || id === "area-date-highlights";
  const group = id === "line-date-highlights-brush";
  const loss = id === "line-profit-loss" || id === "line-profit-loss-legend";
  const dashed = id === "line-dashed" || id === "area-forecast";
  const rangeBand = id === "area-reference-band" || id === "live-line-reference-band" || id === "live-line-pattern-band";
  const background = id === "area-background" || id === "live-line-background" || id === "live-line-dots";
  const timeAxis = { ...xAxis, axisLabel: { ...xAxis.axisLabel, formatter: (value: string) => value },
    splitLine: id === "line-grid" || id === "live-line-dots" ? { show: true, lineStyle: { color: theme.grid, type: "dotted" as const } } : undefined };
  const yAxis = { ...numericAxis(theme, !background), min: fixed ? 0 : live ? "dataMin" as const : undefined,
    max: fixed ? 100 : live ? "dataMax" as const : undefined, position: rightAxis ? "right" as const : undefined };
  option.xAxis = timeAxis;
  option.yAxis = twoAxes ? [
    { ...yAxis, axisLabel: { ...yAxis.axisLabel, formatter: id === "line-dual-axis" ? "${value}" : "{value}" } },
    { ...numericAxis(theme, false), position: "right", axisLabel: { ...yAxis.axisLabel, formatter: "{value}%" } },
  ] : yAxis;
  if (twoAxes || rightAxis) option.grid = { top: 12, bottom: 25, left: compact ? 32 : 52, right: compact ? 32 : 46 };
  if (id === "line-crosshair-point") {
    option.tooltip = { ...option.tooltip, axisPointer: { type: "none" } };
  }
  const markAreas: NonNullable<NonNullable<LineSeriesOption["markArea"]>["data"]> = [];
  const markLines: NonNullable<NonNullable<LineSeriesOption["markLine"]>["data"]> = [];
  const lastIndex = Math.max(0, data.categories.length - 1);
  const due = Math.floor(lastIndex * 0.64);
  if (bars || group) {
    for (let index = 5; index < lastIndex; index += 7) {
      markAreas.push(markRange(index - 0.4, Math.min(index + 1.4, lastIndex), tint(theme.muted, 0.06), pattern(tint(theme.muted, 0.13))));
    }
  }
  if (deadline) {
    markLines.push({ xAxis: due, name: "Deadline", lineStyle: { color: down, type: "solid" }, label: { formatter: "Deadline" } });
    markAreas.push(markRange(due, lastIndex, id === "line-deadline-fills" ? tint(down, 0.18) : tint(down, 0.075), pattern(tint(down, 0.17))));
  }
  if (group) markLines.push({ xAxis: Math.floor(lastIndex / 3), name: "Launch", lineStyle: { color: theme.colors[1], type: "solid" }, label: { formatter: "Launch" } });
  if (interval) {
    const start = Math.floor(lastIndex * 0.29), end = Math.floor(lastIndex * 0.59);
    markAreas.push(markRange(start, end, tint(theme.colors[0], 0.16)));
    for (const value of [start, end]) markLines.push({ xAxis: value, lineStyle: { color: theme.colors[0], type: "solid" }, label: { show: false } });
  }
  if (background) markAreas.push(markRange(0, lastIndex, transparent, pattern(tint(theme.muted, 0.17), id === "live-line-dots" ? "dots" : "hatch")));
  if (rangeBand) {
    const low = live ? 141 : 180;
    const high = live ? 144 : 240;
    markAreas.push([{ yAxis: low, itemStyle: { color: tint(theme.colors[1], 0.15), decal: id === "live-line-pattern-band" ? pattern(tint(theme.colors[1], 0.55)) : undefined } }, { yAxis: high }]);
    for (const value of [low, high]) markLines.push({ yAxis: value, lineStyle: { color: theme.colors[1], type: "dashed" }, label: { show: false } });
  }
  if (id === "line-threshold") markLines.push({ yAxis: 82, name: "Target", lineStyle: { color: down, type: "solid" }, label: { formatter: "Target" } });
  if (loss) markLines.push({ yAxis: 0, lineStyle: { color: theme.muted, type: "solid" }, label: { show: false } });
  if (controls.selection) {
    const [start, end] = controls.selection;
    markAreas.push(markRange(start, end, tint(theme.colors[0], 0.17)));
    for (const value of [start, end]) markLines.push({ xAxis: value, lineStyle: { color: theme.colors[0], type: "solid" }, label: { show: false } });
  }
  const series: (LineSeriesOption | CustomSeriesOption)[] = [];
  const hasBand = id.startsWith("line-band") || id === "line-bollinger";
  const addBand = (item: ChartSeries, index: number) => {
    if (hasBand && (index === 0 || id === "line-band-ranges")) series.push(...buildBand(item, index, theme, id, controls.fill));
  };
  data.series.forEach((item, index) => {
    addBand(item, index);
    if (id === "line-band-range") return;
    const baseColor = colorFor(item, index, theme);
    const last = item.values.at(-1), prior = item.values.at(-2);
    const color = id === "live-line-momentum" && typeof last === "number" && typeof prior === "number"
      ? last > prior ? up : last < prior ? down : theme.colors[0] : baseColor;
    const solidFill = id === "area-fill";
    const fillArea = area || live && !rightAxis;
    const patterned = (id === "area-pattern" || id === "area-pattern-fade" || id === "area-mixed" && index === 1);
    const fill = id === "area-gradient-fill"
      ? { ...gradient(tint(theme.colors[0], 0.58), tint(theme.colors[2], 0.04)), colorStops: [
        { offset: 0, color: tint(theme.colors[0], 0.7) },
        { offset: 0.47, color: tint(theme.colors[1], 0.42) },
        { offset: 1, color: tint(theme.colors[2], 0.05) },
      ] }
      : solidFill ? tint(color, 0.53) : gradient(tint(color, live ? 0.3 : 0.35), tint(color, 0.02));
    const lineStyle = id === "line-glow" ? { color, width: 3, shadowBlur: 17, shadowColor: tint(color, 0.8) }
      : { color, width: solidFill || loss ? 0 : id === "line-threshold" && index === 0 ? 3 : 2.3 };
    const endMarker = live && typeof last === "number" ? [{ name: "Latest", coord: [lastIndex, last], value: last, itemStyle: { color, borderWidth: 3, borderColor: tint(color, 0.26) } }] : [];
    const eventMarkers = id === "line-markers" ? releaseEvents(item.values, controls.activeMarker) : [];
    const regular = lineFor(item, index, theme, {
      data: [...item.values], lineStyle, itemStyle: { color, borderColor: color, borderWidth: points ? 1.4 : 0 },
      smooth: id === "line-straight" || loss || id === "line-large-data" || id === "area-steps" ? false : 0.22,
      showSymbol: points, symbol: points ? "emptyCircle" : "circle", symbolSize: points ? 7 : 6,
      yAxisIndex: twoAxes ? Math.min(index, 1) : 0,
      step: id === "area-steps" ? "end" : false,
      areaStyle: fillArea ? { color: fill, opacity: 1 } : undefined,
      markArea: index === 0 && markAreas.length ? { silent: true, data: markAreas } : undefined,
      markLine: index === 0 && markLines.length ? { symbol: ["none", "none"], silent: true, label: { color: theme.muted, fontSize: 9 }, data: markLines } : undefined,
      markPoint: endMarker.length ? { symbol: "circle", symbolSize: 8, label: { show: false }, data: endMarker } : eventMarkers.length
        ? { symbol: "pin", symbolSize: 24, label: { show: false }, tooltip: { formatter: "{b}: {c}" }, data: eventMarkers } : undefined,
      sampling: id === "line-large-data" ? "lttb" : undefined,
      z: 3 + index,
    });
    if (dashed) {
      const split = Math.max(1, item.values.length - (area ? 3 : 5));
      series.push({ ...regular, data: item.values.map((value, position) => position <= split ? value : null) });
      series.push({ ...regular, name: area ? "Forecast" : "Provisional", data: item.values.map((value, position) => position >= split ? value : null),
        lineStyle: { ...lineStyle, type: "dashed" }, markArea: undefined, markLine: undefined });
    } else {
      series.push(regular);
    }
    if (patterned) series.push(clippedTexture(tint(color, 0.45), item.values, null, twoAxes ? Math.min(index, 1) : 0, id === "area-mixed" ? "dots" : "hatch", id === "area-pattern-fade"));
    if (loss) series.push(signedStroke(item, controls.activeLegend));
    if (id === "area-value-labels") series.push({
      ...lineFor(item, index, theme), type: "line", showSymbol: true, symbol: "circle", symbolSize: 1,
      data: item.values.map((value, position) => position % Math.max(1, Math.ceil(item.values.length / 5)) === 0 ? value : null),
      lineStyle: { opacity: 0 }, label: { show: true, position: "top", color: theme.text, fontSize: 9 },
      tooltip: { show: false }, silent: true,
    });
    if (id === "line-bollinger" && index === 0) {
      series.push(lineFor({ name: "Moving average", values: movingStats(item.values, 10).map(value => value?.average ?? null) }, index + 1, theme, { smooth: false, lineStyle: { type: "dashed" } }));
      option.yAxis = { ...yAxis, scale: true };
    }
  });
  if (id === "line-legend" && !compact) {
    option.legend = seriesLegend(data.series, theme);
    option.grid = { top: 12, bottom: 48, left: 48, right: 19 };
  }
  if (id === "line-trend" || id === "area-trend") data.series.forEach((item, index) => {
    const color = theme.colors[(index + 2) % theme.colors.length];
    series.push(lineFor({ name: `${item.name} trend`, values: trendValues(item.values) }, index, theme, {
      smooth: false, lineStyle: { color: id === "area-trend" || controls.trend === "Gradient" ? strokeFade(color) : color,
        width: 2, type: id === "line-trend" && controls.trend === "Dashed" ? "dashed" : "solid" }, z: 6,
    }));
  });
  if (id === "line-projection" || id === "line-projection-manual") {
    const future = ["Week +1", "Week +2", "Week +3", "Week +4", "Week +5"];
    option.xAxis = categoryAxis([...data.categories, ...future], theme);
    const last = data.series[0]?.values.at(-1) ?? 0;
    const projection = (name: string, values: number[], index: number) =>
      lineFor({ name, values: [...Array.from({ length: lastIndex }, () => null), last, ...values] }, index, theme,
        { lineStyle: { type: "dashed", width: 2 }, showSymbol: true, symbol: "emptyCircle", symbolSize: 5, smooth: false });
    series.push(projection(id === "line-projection-manual" ? "Plan" : "Trend", future.map((_, i) => last + (i + 1) * (id === "line-projection-manual" ? [3, 5, 4, 5, 6][i] : 3)), 2));
    if (id === "line-projection") series.push(projection("Target", future.map((_, i) => last + (i + 1) * 6), 1));
  }
  if (["line-brush", "line-linked-brush", "line-date-highlights-brush", "line-zoom"].includes(id) && !compact) {
    option.grid = { top: 12, bottom: 64, left: 48, right: 19 };
    option.dataZoom = [
      { type: "slider", start: id === "line-zoom" ? 0 : 25, end: 100, height: 23, bottom: 6,
        borderColor: theme.grid, fillerColor: tint(theme.colors[0], 0.14), backgroundColor: theme.surface, textStyle: { color: theme.muted } },
      { type: "inside", start: id === "line-zoom" ? 0 : 25, end: 100, zoomOnMouseWheel: id === "line-zoom" ? "ctrl" : true, moveOnMouseMove: true },
    ];
  }
  if (["line-segment", "area-selection"].includes(id) && !compact) {
    option.brush = { xAxisIndex: 0, brushType: "lineX", brushMode: "single", toolbox: [], brushStyle: { color: tint(theme.colors[0], 0.2), borderColor: theme.colors[0], borderWidth: 1 } };
  }
  option.series = series;
  return option;
}
