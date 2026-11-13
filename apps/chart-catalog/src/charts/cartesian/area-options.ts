import type { CustomSeriesOption, DefaultLabelFormatterCallbackParams, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { escapeTooltipHtml } from "../evil-tooltip";
import type { CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, down, gradient, numericAxis, tint, transparent, trendValues, valueFormat, type ChartTheme, type Controls } from "./options";

type Paint = ReturnType<typeof gradient> | string;
type Point = [x: number, y: number];
type Plot = { x: number; y: number; width: number; height: number };
type Mark = NonNullable<ReturnType<NonNullable<CustomSeriesOption["renderItem"]>>>;

const dayTitle = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const shortNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dashedBorder = [4, 4];
const fullGrid = { top: 18, right: 17, bottom: 25, left: 17 };

function dateAt(data: CartesianData, index: number) {
  const value = data.rows?.[index]?.date ?? data.categories[index];
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
}

function backdrop(name: string, draw: (box: Plot, coordinate: (x: number, y: number) => Point) => Mark | undefined, layer = 0): CustomSeriesOption {
  return {
    name, type: "custom", data: [0], silent: true, z: layer, animation: false,
    tooltip: { show: false }, encode: { x: -1, y: -1 },
    renderItem: (params, api) => {
      const plot = params.coordSys as unknown as Plot;
      if (plot.width <= 0 || plot.height <= 0) return;
      const shape = draw(plot, (x, y) => api.coord([x, y]) as Point);
      return shape && { type: "group", clipPath: { type: "rect", shape: plot }, children: [shape] };
    },
  };
}

function rect(x: number, y: number, width: number, height: number, fill: Paint): Mark {
  return { type: "rect", shape: { x, y, width, height }, style: { fill } };
}

function rule(x1: number, y1: number, x2: number, y2: number, stroke: Paint, lineDash?: number[]): Mark {
  return { type: "line", shape: { x1, y1, x2, y2 }, style: { stroke, lineWidth: 1, lineDash } };
}

function stripeGroup(plot: Plot, stroke: Paint, step = 7) {
  return Array.from({ length: Math.ceil((plot.width + plot.height) / step) }, (_, index) => {
    const start = plot.x - plot.height + index * step;
    return rule(start, plot.y + plot.height, start + plot.height, plot.y, stroke);
  });
}

function contiguousRuns(values: ChartSeries["values"], coordinate: (x: number, y: number) => Point) {
  const runs: Point[][] = [];
  let current: Point[] = [];
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value === null || !Number.isFinite(value)) {
      if (current.length > 1) runs.push(current);
      current = [];
    } else current.push(coordinate(index, value));
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

function smoothAreaPath(points: Point[], baseline: number) {
  const [firstX, firstY] = points[0];
  let path = `M${firstX},${firstY}`;
  for (let index = 1; index < points.length; index++) {
    const [leftX, leftY] = points[index - 1];
    const [rightX, rightY] = points[index];
    const bend = (rightX - leftX) * 0.22;
    path += `C${leftX + bend},${leftY},${rightX - bend},${rightY},${rightX},${rightY}`;
  }
  return `${path}L${points.at(-1)![0]},${baseline}L${firstX},${baseline}Z`;
}

function dottedArea(plot: Plot, color: string): Mark {
  const spacing = 8;
  const radius = 1.1;
  const columns = Math.ceil(plot.width / spacing);
  const rows = Math.ceil(plot.height / spacing);
  const pathData = Array.from({ length: columns * rows }, (_, index) => {
    const x = plot.x + index % columns * spacing;
    const y = plot.y + Math.floor(index / columns) * spacing;
    return `M${x - radius},${y}a${radius},${radius} 0 1 0 ${radius * 2},0a${radius},${radius} 0 1 0 ${-radius * 2},0`;
  }).join("");
  return { type: "path", shape: { pathData }, style: { fill: tint(color, .63) } };
}

function areaTexture(series: ChartSeries, color: string, mode: "hatch" | "dots" | "faded") {
  return backdrop(`${series.name} texture`, (plot, coord) => {
    const baseline = Math.min(plot.y + plot.height, Math.max(plot.y, coord(0, 0)[1]));
    const runs = contiguousRuns(series.values, coord);
    if (!runs.length) return;
    const children = mode === "dots" ? [dottedArea(plot, color)] : mode === "faded" ? Array.from({ length: Math.ceil((plot.width + plot.height) / 7) }, (_, index) => {
      const start = plot.x - plot.height + index * 7;
      const alphaAt = (offset: number) => {
        const x = start + offset * plot.height - plot.x;
        return Math.max(0, Math.min(1, x / (plot.width * 0.2), (plot.width - x) / (plot.width * 0.2))) * offset * 0.65;
      };
      const stroke = { ...gradient(transparent, transparent), colorStops: [0, .25, .5, .75, 1].map(offset => ({ offset: 1 - offset, color: tint(color, alphaAt(offset)) })).reverse() };
      return rule(start, plot.y + plot.height, start + plot.height, plot.y, stroke);
    }) : stripeGroup(plot, tint(color, 0.55));
    return { type: "group", clipPath: { type: "path", shape: { pathData: runs.map(points => smoothAreaPath(points, baseline)).join("") } }, children };
  }, 1);
}

function areaBackground(theme: ChartTheme) {
  return backdrop("Patterned background", (plot) => ({
    type: "group",
    children: Array.from({ length: Math.ceil((plot.width + plot.height) / 7) }, (_, index) => {
      const start = plot.x - plot.height + index * 7;
      const width = plot.width;
      const alphaAt = (x: number) => Math.max(0, Math.min(1, x / (width * .3), (width - x) / (width * .3))) * .22;
      const stroke = { ...gradient(transparent, transparent, true), colorStops: [0, .25, .5, .75, 1].map(offset => ({ offset, color: tint(theme.muted, alphaAt(start + offset * plot.height - plot.x)) })) };
      return rule(start, plot.y + plot.height, start + plot.height, plot.y, stroke);
    }),
  }));
}

function targetBand(theme: ChartTheme) {
  return backdrop("Target band 180–240", (plot, coord) => {
    const [, upper] = coord(0, 240);
    const [, lower] = coord(0, 180);
    const center = plot.x + plot.width / 2;
    const right = plot.x + plot.width;
    return { type: "group", children: [
      rect(plot.x, upper, plot.width, lower - upper, tint(theme.muted, .12)),
      rule(plot.x, upper, right, upper, theme.muted, dashedBorder),
      rule(plot.x, lower, right, lower, theme.muted, dashedBorder),
      ...([[upper, 1], [lower, -1]] as const).map(([y, direction]): Mark => ({ type: "polygon", shape: { points: [[center - 3, y], [center + 3, y], [center, y + direction * 6]] }, style: { fill: theme.colors[0] } })),
    ] };
  });
}

function launchRange(data: CartesianData, theme: ChartTheme) {
  const marked = data.rows?.map((row, index) => row.highlight === true ? index : -1).filter(index => index >= 0) ?? [];
  const start = marked.length ? marked[0] : data.categories.findIndex((_, index) => dateAt(data, index)?.toISOString().slice(0, 10) === "2026-10-12");
  const end = marked.length ? marked.at(-1)! : data.categories.findIndex((_, index) => dateAt(data, index)?.toISOString().slice(0, 10) === "2026-10-18");
  if (start < 0 || end <= start) return null;
  return backdrop("Launch week", (plot, coord) => {
    const [left] = coord(start, 0);
    const [right] = coord(end, 0);
    const bottom = plot.y + plot.height;
    return { type: "group", children: [rect(left, plot.y, right - left, plot.height, tint(theme.muted, .1)),
      rule(left, plot.y, right, plot.y, tint(theme.muted, .65)), rule(left, bottom, right, bottom, tint(theme.muted, .65))] };
  });
}

function dateHighlights(data: CartesianData, theme: ChartTheme) {
  const weekends = data.categories.map((_, index) => {
    const weekday = dateAt(data, index)?.getUTCDay();
    return weekday === 0 || weekday === 6;
  });
  const deadline = data.categories.findIndex((_, index) => data.rows?.[index]?.deadline === true || dateAt(data, index)?.toISOString().slice(0, 10) === "2026-10-15");
  return backdrop("Calendar highlights", (plot, coord) => {
    const highlights: Mark[] = [];
    const last = data.categories.length - 1;
    const spacing = plot.width / Math.max(1, last);
    if (spacing >= 6) for (let index = 0; index <= last; index++) {
      if (!weekends[index] || weekends[index - 1]) continue;
      const [start] = coord(index, 0);
      const [end] = coord(index + Number(Boolean(weekends[index + 1])), 0);
      const left = Math.max(plot.x, start - spacing / 2);
      const right = Math.min(plot.x + plot.width, end + spacing / 2);
      const shape = { x: left, y: plot.y, width: right - left, height: plot.height };
      highlights.push({ type: "group", clipPath: { type: "rect", shape }, children: stripeGroup(shape, tint(theme.muted, .52)) });
    }
    if (deadline >= 0) {
      const [x] = coord(deadline, 0);
      highlights.push(rect(x, plot.y, plot.x + plot.width - x, plot.height, gradient(tint(down, .29), tint(down, 0), true)),
        rule(x, plot.y, x, plot.y + plot.height, down));
    }
    return { type: "group", children: highlights };
  });
}

function tooltip(data: CartesianData, id: string, theme: ChartTheme) {
  return (params: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) => {
    const items = Array.isArray(params) ? params : [params];
    const point = items[0]?.dataIndex;
    if (typeof point !== "number") return "";
    const date = dateAt(data, point);
    const title = date ? dayTitle.format(date) : data.categories[point] ?? "";
    const rows = data.series.flatMap((series, index) => {
      const value = series.values[point];
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      const percent = id === "area-dual-axis" && index > 0 ? "%" : "";
      const color = escapeTooltipHtml(colorFor(series, index, theme));
      return [`<div class="cl-tooltip-row"><span><i class="cartesian-swatch" style="background:${color}"></i> ${escapeTooltipHtml(id === "area-small-multiples" ? "Signups" : series.name)}</span><strong>${valueFormat.format(value)}${percent}</strong></div>`];
    });
    return rows.length ? `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(title)}</div><div class="cl-tooltip-rows">${rows.join("")}</div></div>` : "";
  };
}

function fadedStroke(color: string) {
  return { ...gradient(tint(color, 0), tint(color, 0), true), colorStops: [0, .15, .85, 1].map((offset, index) => ({ offset, color: index === 0 || index === 3 ? tint(color, 0) : color })) };
}

function areaFill(id: string, color: string, theme: ChartTheme, index: number): Paint {
  if (id === "area-pattern" || id === "area-pattern-fade" || id === "area-mixed" && index === 1) return transparent;
  if (id === "area-gradient-fill") return { ...gradient(transparent, transparent), colorStops: [
    { offset: 0, color: tint(color, .7) }, { offset: .55, color: tint(theme.colors[1], .46) }, { offset: 1, color: tint(theme.colors[2], .04) },
  ] };
  if (id === "area-fade-bottom") return { ...gradient(tint(color, .5), tint(color, 0)), colorStops: [
    { offset: 0, color: tint(color, .5) }, { offset: .4, color: tint(color, .5) }, { offset: 1, color: tint(color, 0) },
  ] };
  return gradient(tint(color, id === "area-fill" ? .6 : .35), tint(color, id === "area-fill" ? .05 : 0));
}

function valueLabels(data: CartesianData, line: LineSeriesOption, theme: ChartTheme, seriesIndex: number): LineSeriesOption {
  const item = data.series[seriesIndex];
  const last = data.categories.length - 1;
  const count = Math.min(5, last + 1);
  const positions = new Set(Array.from({ length: count }, (_, index) => Math.round(index * last / Math.max(1, count - 1))));
  return { ...line, id: `area-label-${seriesIndex}`, name: `${item.name} labels`, silent: true, z: 7,
    areaStyle: undefined, data: item.values.map((value, index) => positions.has(index) ? value : null),
    showSymbol: true, symbolSize: 1, tooltip: { show: false }, lineStyle: { opacity: 0 },
    labelLayout: { hideOverlap: true }, label: {
      show: true, color: colorFor(item, seriesIndex, theme), textBorderColor: theme.surface, textBorderWidth: 2, fontSize: 10,
      align: "center",
      position: seriesIndex === 0 ? "top" : "bottom", formatter: ({ value }) => typeof value === "number" ? valueFormat.format(value) : "",
    },
  };
}

export function buildArea(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls, loading = false): EChartsOption {
  const { id } = example;
  const option = baseOption(data, theme, compact);
  const multiples = id === "area-small-multiples";
  const dual = id === "area-dual-axis" && data.series.length > 1;
  const target = id === "area-reference-band";
  const steps = id === "area-steps";
  const showAxis = dual || target || steps;
  const series: (LineSeriesOption | CustomSeriesOption)[] = [];
  const extra: (LineSeriesOption | CustomSeriesOption)[] = [];
  const axis = categoryAxis(data.categories, theme);
  const count = data.categories.length;
  const ticks = id === "area-value-labels" && count === 24 ? [0, 11, 22] : id === "area-forecast" && count === 12 ? [0, 3, 6, 9, 11]
    : id === "area-trend" && count === 10 ? [0, 3, 6, 9] : id === "area-date-highlights" && count === 22 ? [0, 7, 14, 21]
    : count === 31 ? [0, 10, 20, 30] : count === 30 ? [0, 7, 15, 22, 29] : [0, 3, 6, 9, 11];
  const tickInterval = compact || ![10, 12, 22, 24, 30, 31].includes(count) ? "auto" as const : (index: number) => ticks.includes(index);
  option.xAxis = { ...axis, axisLabel: { ...axis.axisLabel, show: !multiples, showMinLabel: true, showMaxLabel: id !== "area-value-labels", interval: tickInterval },
    axisPointer: { label: { show: !multiples, backgroundColor: theme.surface, color: theme.text, borderColor: theme.grid, borderWidth: 1 } } };
  const yAxis = numericAxis(theme, id !== "area-background");
  const left = { ...yAxis, interval: target ? 50 : undefined, min: target ? (range: { min: number }) => Math.min(0, range.min) : undefined,
    max: target ? (range: { max: number }) => Math.max(350, Math.ceil(range.max / 50) * 50) : undefined,
    axisLabel: { ...yAxis.axisLabel, show: showAxis, formatter: dual ? (value: number) => shortNumber.format(value).toLowerCase() : undefined } };
  option.yAxis = dual ? [left, { ...numericAxis(theme, false), position: "right", axisLabel: { ...yAxis.axisLabel, formatter: "{value}%" } }] : left;
  option.grid = multiples ? { top: 7, bottom: 5, left: 5, right: 5 } : showAxis ? { ...fullGrid, left: compact ? 28 : 42, right: dual ? 40 : 17 } : fullGrid;
  option.tooltip = loading ? { show: false } : { ...option.tooltip, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none;", formatter: tooltip(data, id, theme) };

  data.series.forEach((item, index) => {
    const color = loading ? theme.muted : colorFor(item, index, theme);
    const line: LineSeriesOption = { id: `area-${index}`, name: item.name, type: "line", data: [...item.values],
      yAxisIndex: dual ? Math.min(index, 1) : 0, smooth: steps ? false : .22, smoothMonotone: "x", step: steps ? "end" : false,
      showSymbol: false, symbol: "circle", symbolSize: 7, itemStyle: { color, borderColor: theme.surface, borderWidth: 1.5 },
      lineStyle: { color: loading ? tint(color, .32) : id === "area-pattern-fade" ? fadedStroke(color) : color, width: id === "area-fill" ? 0 : 2 },
      areaStyle: { color: loading ? gradient(tint(color, .21), tint(color, .04)) : areaFill(id, color, theme, index), opacity: 1 }, z: 3 + index };
    if (id === "area-forecast") {
      const firstForecast = data.rows?.findIndex(row => row.forecast === true) ?? -1;
      const split = firstForecast >= 0 ? Math.max(0, firstForecast - 1) : Math.max(0, item.values.length - 4);
      series.push({ ...line, showSymbol: true, symbol: "emptyCircle", lineStyle: { color, width: 0 } });
      extra.push({ ...line, id: `actual-${index}`, areaStyle: undefined, silent: true, data: item.values.map((value, point) => point <= split ? value : null), tooltip: { show: false } },
        { ...line, id: `forecast-${index}`, areaStyle: undefined, silent: true, data: item.values.map((value, point) => point >= split ? value : null), tooltip: { show: false }, lineStyle: { color, width: 2, type: [6, 4] } });
    } else series.push(line);
    if (id === "area-pattern" || id === "area-pattern-fade" || id === "area-mixed" && index === 1) extra.push(areaTexture(item, color, id === "area-mixed" ? "dots" : id === "area-pattern-fade" ? "faded" : "hatch"));
    if (id === "area-value-labels" && !compact) extra.push(valueLabels(data, line, theme, index));
    if (id === "area-trend") extra.push({ ...line, id: `trend-${index}`, name: `${item.name} trend`, type: "line", data: trendValues(item.values), smooth: false, silent: true,
      areaStyle: undefined, lineStyle: { color: fadedStroke(theme.colors[2]), width: 2.4 }, tooltip: { show: false }, z: 6 });
    if (id === "area-selection" && controls.selection) {
      const [start, end] = controls.selection;
      extra.push({ ...line, id: `selection-${index}`, data: item.values.map((value, point) => point >= start && point <= end ? value : null),
        silent: true, areaStyle: undefined, lineStyle: { color, width: 3.6 }, tooltip: { show: false }, z: 7 });
    }
  });
  if (id === "area-background") extra.push(areaBackground(theme));
  if (target) extra.push(targetBand(theme));
  if (id === "area-reference-range") {
    const launch = launchRange(data, theme);
    if (launch) extra.push(launch);
  }
  if (id === "area-date-highlights") extra.push(dateHighlights(data, theme));
  if (id === "area-selection" && controls.selection) {
    const [start, end] = controls.selection;
    extra.push(backdrop("Selected range", (plot, coord) => {
      const [leftX] = coord(start, 0), [rightX] = coord(end, 0);
      const bottom = plot.y + plot.height;
      const color = theme.colors[0];
      return { type: "group", children: [rect(leftX, plot.y, rightX - leftX, plot.height, tint(color, .14)),
        rule(leftX, plot.y, leftX, bottom, color, dashedBorder), rule(rightX, plot.y, rightX, bottom, color, dashedBorder)] };
    }, 6));
  }
  option.series = [...series, ...extra];
  return option;
}
