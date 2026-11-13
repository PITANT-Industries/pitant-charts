import type { BarSeriesOption, CandlestickSeriesOption, CustomSeriesOption, DefaultLabelFormatterCallbackParams, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { dates, candleRows, type CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, down, gradient, numericAxis, seriesLegend, signedStroke, strokeFade, tint, transparent, trendValues, up, valueFormat, type ChartTheme, type Controls } from "./options";
import { escapeTooltipHtml } from "../evil-tooltip";
import { accumulateWaterfall } from "./upstream";

function makeBar(item: ChartSeries, index: number, theme: ChartTheme, extra: Partial<BarSeriesOption> = {}): BarSeriesOption {
  const color = colorFor(item, index, theme);
  return {
    type: "bar", name: item.name, data: [...item.values], barMaxWidth: 29,
    itemStyle: { color, borderRadius: [4, 4, 0, 0] }, emphasis: { focus: "series" },
    animationDelay: index => index * 14,
    ...extra,
  };
}

function makeLine(item: ChartSeries, index: number, theme: ChartTheme, extra: Partial<LineSeriesOption> = {}): LineSeriesOption {
  const color = colorFor(item, index, theme);
  return { type: "line", name: item.name, data: [...item.values], showSymbol: false, smooth: 0.23,
    itemStyle: { color }, lineStyle: { color, width: 2.3 }, emphasis: { focus: "series" }, ...extra };
}

function labelFor(theme: ChartTheme) {
  return { fontSize: 10, color: theme.muted, show: true };
}

export function buildBar(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const option = baseOption(data, theme, compact, true);
  const { id } = example;
  const horizontal = id === "bar-sources";
  const stacked = id === "bar-stacked";
  const signed = id === "bar-profit-loss";
  const squares = id === "bar-squares" || id === "bar-squares-legend";
  if (horizontal) {
    option.grid = { top: 6, right: 18, bottom: 25, left: compact ? 85 : 116 };
    option.xAxis = numericAxis(theme);
    option.yAxis = { ...categoryAxis(data.categories, theme), inverse: true };
  }
  if (id === "bar-squares-legend" && !compact) {
    option.legend = seriesLegend(data.series, theme);
    option.grid = { top: 8, right: 16, bottom: 51, left: 48 };
  }
  if (squares) {
    const high = Math.max(0, ...data.series.flatMap(item => item.values.map(value => value ?? 0)));
    option.series = data.series.map((item, index) => {
      const color = colorFor(item, index, theme);
      return {
        type: "pictorialBar" as const, name: item.name, data: [...item.values],
        symbol: "roundRect", symbolRepeat: "fixed", symbolClip: true, symbolBoundingData: Math.ceil(high / 10) * 10,
        symbolMargin: 2, symbolSize: compact ? [10, 9] : [16, 11],
        barGap: "18%", itemStyle: { color: gradient(color, tint(color, 0.38)) }, emphasis: { focus: "series" as const },
      };
    });
    return option;
  }
  if (id === "bar-depth") {
    option.series = data.series.map((item, seriesIndex): CustomSeriesOption => ({
      type: "custom", name: item.name, data: item.values.map((value, index) => [index, value ?? 0]), encode: { x: 0, y: 1, tooltip: 1 },
      renderItem: (params, api) => {
        const index = Number(api.value(0)), value = Number(api.value(1));
        const [center, top] = api.coord([index, value]), [, baseline] = api.coord([index, 0]);
        const bandwidth = Math.min(27, ((params.coordSys as { width?: number } | undefined)?.width ?? 400) / Math.max(data.categories.length, 1) * 0.56);
        const left = center - bandwidth / 2, right = left + bandwidth, depth = compact ? 5 : 7;
        const color = colorFor(item, seriesIndex, theme);
        const last = index === item.values.length - 1;
        return { type: "group", children: [
          { type: "ellipse", shape: { cx: center + depth, cy: baseline + 2, rx: bandwidth * 0.7, ry: 4 }, style: { fill: tint(color, 0.2) } },
          { type: "rect", shape: { x: left, y: top, width: bandwidth, height: Math.max(1, baseline - top), r: [2, 2, 0, 0] },
            style: { fill: gradient(tint(color, last ? 0.94 : 0.72), tint(color, 0.36)), stroke: tint(color, 0.8), lineWidth: 0.8 } },
          { type: "polygon", shape: { points: [[left, top], [left + depth, top - depth], [right + depth, top - depth], [right, top]] }, style: { fill: tint(color, 0.95) } },
          { type: "polygon", shape: { points: [[right, top], [right + depth, top - depth], [right + depth, baseline - depth], [right, baseline]] }, style: { fill: tint(color, 0.46) } },
        ] };
      },
    }));
    return option;
  }
  option.series = data.series.map((item, index) => makeBar(item, index, theme, {
    stack: stacked ? "sum" : undefined,
    itemStyle: { color: colorFor(item, index, theme),
      borderRadius: stacked && index !== data.series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    data: signed ? item.values.map(value => ({ value: value ?? 0,
      itemStyle: { color: value !== null && value >= 0 ? up : down, borderRadius: value !== null && value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })) : [...item.values],
    label: id === "bar-values" ? { ...labelFor(theme), color: theme.surface, position: "inside", rotate: compact ? 90 : 0 } : undefined,
    labelLayout: id === "bar-values" ? { hideOverlap: true } : undefined,
    markLine: signed ? { symbol: ["none", "none"], label: { show: false }, data: [{ yAxis: 0 }], lineStyle: { color: theme.muted, type: "solid" } } : undefined,
  }));
  return option;
}

export function buildDiverging(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const option = baseOption(data, theme, compact, true);
  const neutralIndex = data.series.findIndex(item => item.name.toLowerCase() === "neutral");
  const half = neutralIndex >= 0 ? neutralIndex : Math.floor(data.series.length / 2);
  const style = [down, "#eaa19c", "#a4a6ba", "#6bbda8", up];
  const legend = example.id === "diverging-legend" && !compact;
  option.grid = { left: compact ? 82 : 153, right: 16, top: 12, bottom: legend ? 53 : 30 };
  option.xAxis = { ...numericAxis(theme), min: -100, max: 100, axisLabel: { ...numericAxis(theme).axisLabel, formatter: (value: string | number) => `${Math.abs(Number(value))}%` } };
  option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true, axisLabel: { ...categoryAxis([], theme).axisLabel, width: compact ? 71 : 130, overflow: "truncate" } };
  if (legend) option.legend = seriesLegend(data.series, theme);
  const segments = data.series.flatMap((item, index) => {
    const color = item.color ?? style[index % style.length];
    const piece = (multiplier: number) => makeBar({ ...item, values: item.values.map(value => value === null ? null : value * multiplier) }, index, theme, {
      stack: "responses", barMaxWidth: 28,
      itemStyle: { color, borderRadius: 0, borderWidth: 1, borderColor: theme.surface },
      label: compact ? undefined : { ...labelFor(theme), color: theme.surface, position: "inside", formatter: ({ value }) => `${valueFormat.format(Math.abs(Number(value)))}%` },
      labelLayout: { hideOverlap: true },
    });
    if (index === neutralIndex) return [piece(-0.5), piece(0.5)];
    return [piece(index < half ? -1 : 1)];
  });
  // The negative stack starts with the neutral segment, then moves outward.
  option.series = [...segments.slice(half), ...segments.slice(0, half).reverse()];
  return option;
}

function candles(data: CartesianData): CandlestickSeriesOption {
  return {
    type: "candlestick", name: "Close", data: candleRows(data), barMaxWidth: 14,
    itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
    emphasis: { focus: "self" },
  };
}

function mean(values: readonly (number | null)[], span: number) {
  return values.map((value, index) => {
    if (value === null) return null;
    const sample = values.slice(Math.max(0, index - span + 1), index + 1).filter((item): item is number => item !== null);
    return sample.reduce((sum, item) => sum + item, 0) / sample.length;
  });
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

type ChartReadout = { name: string; value: (index: number) => string; color: string };

function composedTooltip(data: CartesianData, rows: ChartReadout[]) {
  return (event: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) => {
    const index = (Array.isArray(event) ? event[0] : event)?.dataIndex;
    if (typeof index !== "number" || index < 0 || index >= data.categories.length) return "";
    const lines = rows.map(row => {
      const color = typeof CSS !== "undefined" && CSS.supports("color", row.color) ? row.color : "currentColor";
      return `<div class="cl-tooltip-row"><span><i style="display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background-color:${escapeTooltipHtml(color)}"></i>${escapeTooltipHtml(row.name)}</span><strong>${escapeTooltipHtml(row.value(index))}</strong></div>`;
    }).join("");
    return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(data.categories[index])}</div><div class="cl-tooltip-rows">${lines}</div></div>`;
  };
}

function stackedTraffic(data: CartesianData, theme: ChartTheme): CustomSeriesOption {
  return {
    type: "custom", name: "Traffic", data: data.categories.map((_, index) => [index, data.series.reduce((sum, series) => sum + Math.max(0, series.values[index] ?? 0), 0)]),
    encode: { x: 0, y: 1 }, z: 3,
    renderItem: (params, api) => {
      const index = Number(api.value(0));
      const [x] = api.coord([index, 0]);
      const { width } = params.coordSys as unknown as { width: number };
      const barWidth = Math.min(29, width / Math.max(1, data.categories.length) * .65);
      let prior = 0;
      const children = data.series.flatMap((series, seriesIndex) => {
        const value = Math.max(0, series.values[index] ?? 0);
        if (!value) return [];
        const [, bottom] = api.coord([index, prior]);
        prior += value;
        const [, top] = api.coord([index, prior]);
        const gap = bottom - top > 2 && prior > value ? 2 : 0;
        return [{ type: "rect" as const, shape: { x: x - barWidth / 2, y: top, width: barWidth, height: Math.max(0, bottom - top - gap), r: [3, 3, 0, 0] }, style: { fill: colorFor(series, seriesIndex, theme) } }];
      });
      return { type: "group", children };
    },
  };
}

function composedWeekends(data: CartesianData, theme: ChartTheme): CustomSeriesOption {
  const days = data.categories.flatMap((label, index) => {
    const day = new Date(`${label} 2026 UTC`).getUTCDay();
    return day === 0 || day === 6 || Number.isNaN(day) && (index % 7 === 5 || index % 7 === 6) ? [index] : [];
  });
  return {
    type: "custom", name: "Weekends", data: days, silent: true, z: 0, animation: false, tooltip: { show: false }, encode: { x: -1, y: -1 },
    renderItem: (params, api) => {
      const box = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      const width = box.width / Math.max(1, data.categories.length);
      const left = box.x + width * Number(api.value(0));
      return { type: "group", clipPath: { type: "rect", shape: { x: left, y: box.y, width, height: box.height } }, children: Array.from({ length: Math.ceil((box.height + width) / 6) }, (_, index) => {
        const x = left - box.height + index * 6;
        return { type: "line" as const, shape: { x1: x, y1: box.y + box.height, x2: x + box.height, y2: box.y }, style: { stroke: tint(theme.muted, .25), lineWidth: 1 } };
      }) };
    },
  };
}

export function buildComposed(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const { id } = example;
  const option = baseOption(data, theme, compact, true);
  const [first, second, third] = data.series;
  if (!first) return option;
  const orders = second ?? { name: "Units", values: [] };
  const color = colorFor(first, 0, theme);
  const rolling = { name: id === "composed-target" ? "Trend" : "Run rate", values: mean(first.values, id === "composed-target" ? 4 : 7) };
  const baseline = makeLine(rolling, 0, theme, { areaStyle: { color: gradient(tint(color, 0.28), tint(color, 0.02)) }, lineStyle: { opacity: 0 }, silent: true, z: 1 });
  const line = makeLine(first, 0, theme, { z: 5 });
  const units = makeBar(orders, 1, theme, { itemStyle: { color: tint(colorFor(orders, 1, theme), 0.57), borderRadius: [3, 3, 0, 0] } });
  const formatter = (value: number) => money.format(value * 1000);
  const readout = (series: ChartSeries, index: number, format = (value: number) => valueFormat.format(value)): ChartReadout => ({
    name: series.name, color: colorFor(series, index, theme), value: (i) => typeof series.values[i] === "number" ? format(series.values[i]!) : "—",
  });
  const guide = (item: ChartSeries) => makeLine(item, 2, theme, { z: 4, lineStyle: { color: colorFor(item, 2, theme), width: 2, type: "dashed" } });
  let rows: ChartReadout[];
  if (id === "composed-target") {
    option.series = [baseline, makeBar(first, 0, theme), ...(second ? [guide(second)] : [])];
    rows = [readout(rolling, 0, formatter), readout(first, 0, formatter), ...(second ? [readout(second, 2, formatter)] : [])];
  } else if (id === "composed-grouped") {
    option.series = [makeBar(first, 0, theme), ...(second ? [makeBar(second, 1, theme)] : []), ...(third ? [guide(third)] : [])];
    rows = data.series.slice(0, 3).map((series, index) => readout(series, index));
  } else if (id === "composed-stacked") {
    option.series = [stackedTraffic(data, theme)];
    rows = data.series.map((series, index) => readout(series, index));
  } else if (id === "composed-price-volume") {
    const ohlc = candleRows(data);
    const close = { name: "Close", values: ohlc.map(row => row[1]) };
    const average = { name: "5-day average", values: mean(close.values, 5) };
    const low = Math.min(...ohlc.map(row => row[2])), high = Math.max(...ohlc.map(row => row[3]));
    option.grid = [{ top: 10, right: 42, bottom: 27, left: compact ? 22 : 42 }];
    const axis = numericAxis(theme);
    option.yAxis = [{ ...axis, min: Number.isFinite(low) ? low - Math.max(3, (high - low) * .38) : 0, max: Number.isFinite(high) ? high + 4 : 1, scale: true, position: "right", axisLabel: { ...axis.axisLabel, formatter: (value: number) => money.format(value) } },
      { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 4 }];
    option.series = [{ ...units, yAxisIndex: 1, z: 1 }, candles(data), makeLine(average, 3, theme, { z: 5 })];
    rows = [readout(orders, 1), readout(close, 0), readout(average, 3)];
  } else if (id === "composed-signal") {
    const average = { name: "7-day average", values: mean(first.values, 7) };
    option.series = [{ type: "scatter", name: first.name, data: [...first.values], symbolSize: 6, itemStyle: { color: tint(color, 0.38) } }, makeLine(average, 0, theme, { z: 5 })];
    rows = [readout(first, 0), readout(average, 0)];
  } else if (id === "composed-profit-loss") {
    option.series = [{ ...line, smooth: false, lineStyle: { width: 0 } }, units, signedStroke(first)];
    const axis = numericAxis(theme);
    option.yAxis = [{ ...axis, axisLabel: { ...axis.axisLabel, formatter: (value: number) => money.format(value) } }, { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 4 }];
    units.yAxisIndex = 1;
    rows = [readout(orders, 1), readout(first, 0)];
  } else if (id === "composed-y-domains") {
    const values = first.values.filter((value): value is number => value !== null);
    const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 1;
    const spread = Math.max(1, max - min);
    option.yAxis = [{ ...numericAxis(theme), axisLabel: { show: false }, min: min - spread * 1.2, max: max + spread * .15 }, { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 3 }];
    units.yAxisIndex = 1;
    option.series = [units, line];
    rows = [readout(orders, 1), readout(first, 0)];
  } else if (id === "composed-trend") {
    option.series = [units, line, makeLine({ name: `${first.name} trend`, values: trendValues(first.values) }, 2, theme, { silent: true, tooltip: { show: false }, lineStyle: { color: strokeFade(color), width: 2 }, smooth: false }),
      makeLine({ name: `${orders.name} trend`, values: trendValues(orders.values) }, 3, theme,
        { silent: true, tooltip: { show: false }, lineStyle: { color: theme.colors[3], type: "dotted", width: 2 }, smooth: false })];
    rows = [readout(orders, 1), readout(first, 0)];
  } else if (id === "composed-date-highlights") {
    const last = data.categories.length - 1;
    line.markLine = { symbol: ["none", "none"], silent: true, data: [{ xAxis: Math.floor(last * 0.75), name: "Quarter close", label: { formatter: "Quarter close", position: "insideEndTop", color: theme.muted } }] };
    option.series = [composedWeekends(data, theme), units, line];
    rows = [readout(orders, 1), readout(first, 0, formatter)];
  } else if (id === "composed-band") {
    const expected = mean(first.values, 5);
    const low = expected.map((value, index) => typeof data.rows?.[index]?.low === "number" ? Number(data.rows[index].low) : value === null ? null : value - 10);
    const high = expected.map((value, index) => typeof data.rows?.[index]?.high === "number" ? Number(data.rows[index].high) : value === null ? null : value + 13);
    const distance = low.map((value, index) => value === null || high[index] === null ? null : Math.max(0, high[index]! - value));
    option.series = [
      units,
      makeLine({ name: "Band floor", values: low }, 0, theme, { stack: "forecast", stackStrategy: "all", lineStyle: { opacity: 0 }, tooltip: { show: false }, silent: true }),
      makeLine({ name: "Forecast interval", values: distance }, 0, theme, { stack: "forecast", stackStrategy: "all", lineStyle: { type: "dashed", width: 1, color: tint(color, .52) }, tooltip: { show: false }, silent: true,
        areaStyle: { color: gradient(tint(color, 0.4), tint(color, 0.04)), opacity: 1 } }),
      line,
    ];
    rows = [readout(orders, 1), readout(first, 0), { name: "Expected", color, value: (index) => low[index] === null || high[index] === null ? "—" : `${valueFormat.format(low[index]!)} – ${valueFormat.format(high[index]!)}` }];
  } else {
    option.series = [baseline, units, line];
    rows = [readout(rolling, 0, formatter), readout(orders, 1), readout(first, 0, formatter)];
  }
  option.tooltip = { ...option.tooltip, backgroundColor: "transparent", padding: 0, borderWidth: 0, extraCssText: "box-shadow:none", formatter: composedTooltip(data, rows) };
  return option;
}

export function buildLollipop(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const horizontal = example.id === "lollipop-horizontal";
  const signed = example.id === "lollipop-change";
  const option = baseOption(data, theme, compact, true);
  if (horizontal) {
    option.xAxis = { ...numericAxis(theme), max: 100 };
    option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true };
    option.grid = { left: compact ? 65 : 91, right: 24, top: 8, bottom: 26 };
  }
  const item = data.series[0];
  if (!item) return option;
  const color = colorFor(item, 0, theme);
  option.series = [{
    type: "custom", name: item.name,
    data: item.values.flatMap((value, index) => value === null ? [] : [horizontal ? [value, index] : [index, value]]),
    encode: { x: 0, y: 1, tooltip: horizontal ? 0 : 1 },
    renderItem: (_params, api) => {
      const cat = Number(api.value(horizontal ? 1 : 0)), value = Number(api.value(horizontal ? 0 : 1));
      const [x, y] = api.coord(horizontal ? [value, cat] : [cat, value]);
      const [x0, y0] = api.coord(horizontal ? [0, cat] : [cat, 0]);
      const paint = signed && value < 0 ? down : color;
      return { type: "group", children: [
        { type: "line", shape: { x1: x0, y1: y0, x2: x, y2: y }, style: { stroke: tint(paint, 0.58), lineWidth: 2.4 } },
        { type: "circle", shape: { cx: x, cy: y, r: 5.5 }, style: { fill: paint, stroke: theme.surface, lineWidth: 1.5 } },
        ...(horizontal ? [{ type: "text" as const, style: { x: x + 10, y, text: `${value}%`, fill: theme.text, fontSize: 10, verticalAlign: "middle" as const } }] : []),
      ] };
    },
  }];
  return option;
}

export function buildDumbbell(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, controls: Controls): EChartsOption {
  const vertical = example.id === "dumbbell-vertical";
  const option = baseOption(data, theme, compact, true);
  if (!vertical) {
    option.xAxis = numericAxis(theme);
    option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true };
    option.grid = { left: compact ? 53 : 78, right: 24, top: 9, bottom: 26 };
  }
  const [first, second] = data.series;
  if (!first || !second) return option;
  const annotate = example.id === "dumbbell-legend" && !compact;
  const values = data.categories.flatMap((_, index) => first.values[index] == null || second.values[index] == null
    ? [] : [[index, first.values[index]!, second.values[index]!]]);
  option.series = [{
    type: "custom", name: "Comparison", data: values,
    dimensions: ["Category", first.name, second.name],
    encode: { x: vertical ? 0 : [1, 2], y: vertical ? [1, 2] : 0, tooltip: [1, 2] },
    renderItem: (_params, api) => {
      const [category, from, to] = [0, 1, 2].map(dimension => Number(api.value(dimension)));
      const coord = (value: number) => api.coord(vertical ? [category, value] : [value, category]);
      const a = coord(from), b = coord(to);
      const dots = [a, b].map(([x, y], index) => {
        const color = colorFor(data.series[index], index, theme);
        return { type: "circle" as const, shape: { cx: x, cy: y, r: 6 }, style: { fill: controls.activeLegend !== undefined && controls.activeLegend !== index ? tint(color, 0.2) : color, stroke: theme.surface, lineWidth: 1.5 } };
      });
      const labels = annotate ? [a, b].map(([x, y], index) => ({
        type: "text" as const, style: { x, y: y - 13, text: String(index === 0 ? from : to), fill: theme.text, fontSize: 10, align: "center" as const },
      })) : [];
      return { type: "group", children: [
        { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: tint(theme.muted, 0.4), lineWidth: 4 } },
        ...dots, ...labels,
      ] };
    },
  }];
  return option;
}

export function buildRanking(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const bump = example.family === "bump";
  const ascending = example.id === "bump-ascending";
  const improveLower = example.id === "slope-response-time";
  const legend = ascending && !compact;
  const option = baseOption(data, theme, compact);
  const sorted = data.categories.map((_, column) => data.series.map((item, index) => ({ index, value: item.values[column] ?? (ascending ? Infinity : -Infinity) }))
    .sort((a, b) => ascending ? a.value - b.value : b.value - a.value).map(({ index }) => index));
  option.yAxis = { ...numericAxis(theme), inverse: bump, min: bump ? 1 : "dataMin", max: bump ? Math.max(2, data.series.length) : undefined,
    minInterval: bump ? 1 : undefined, axisLabel: { ...numericAxis(theme).axisLabel, show: bump || !compact } };
  option.grid = { top: 12, right: compact ? 20 : legend ? 19 : 80, bottom: legend ? 52 : 24, left: compact ? 26 : 46 };
  if (legend) option.legend = seriesLegend(data.series, theme);
  option.series = data.series.map((item, index) => {
    const improved = (item.values.at(-1) ?? 0) > (item.values[0] ?? 0);
    const color = bump ? colorFor(item, index, theme) : item.color ?? (improveLower ? improved ? tint(theme.muted, 0.45) : up : improved ? up : down);
    const values = bump ? sorted.map((column, i) => item.values[i] == null ? null : column.indexOf(index) + 1) : item.values;
    return makeLine({ ...item, color, values }, index, theme, {
      showSymbol: true, symbolSize: compact ? 5 : 8, smooth: bump ? 0.35 : false,
      endLabel: compact || legend ? undefined : { show: true, formatter: "{a}", color: theme.muted, fontSize: 10 },
      labelLayout: { moveOverlap: "shiftY" }, lineStyle: { color, width: 2.5 },
    });
  });
  return option;
}

export function buildWaterfall(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const cash = example.id === "waterfall-cash-flow";
  const option = baseOption(data, theme, compact, true);
  const item = data.series[0];
  if (!item) return option;
  const bars = accumulateWaterfall(item.values, index => data.rows?.[index]?.total === true || data.rows?.[index]?.subtotal === true);
  option.series = [{
    type: "custom", name: item.name, data: bars, dimensions: ["Period", "From", "To", "Change", "Total"], encode: { x: 0, y: [1, 2], tooltip: [3] },
    renderItem: (params, api) => {
      const [index, from, to, amount, total] = [0, 1, 2, 3, 4].map(dimension => Number(api.value(dimension)));
      const [center, y0] = api.coord([index, from]), [, y1] = api.coord([index, to]);
      const step = ((params.coordSys as { width?: number } | undefined)?.width ?? 400) / Math.max(1, data.categories.length);
      const width = Math.min(step * 0.62, compact ? 32 : 65);
      const y = Math.min(y0, y1);
      const children = [
        { type: "rect" as const, shape: { x: center - width / 2, y, width, height: Math.max(2, Math.abs(y0 - y1)), r: 3 },
          style: { fill: total ? theme.colors[0] : amount >= 0 ? up : down } },
        ...(!cash && index < bars.length - 1 ? [{ type: "line" as const,
          shape: { x1: center + width / 2, y1, x2: center + step - width / 2, y2: y1 }, style: { stroke: theme.grid, lineDash: [3, 3] } }] : []),
        ...(!cash && !compact ? [{ type: "text" as const, style: { x: center, y: y - 7, text: `${amount >= 0 && !total ? "+" : ""}${amount}`, align: "center" as const,
          verticalAlign: "bottom" as const, fill: theme.text, fontSize: 10 } }] : []),
      ];
      return { type: "group", children };
    },
  }];
  return option;
}

export function buildGantt(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, loading: boolean): EChartsOption {
  const milestones = example.id === "gantt-milestones";
  const roadmap = example.id === "gantt-roadmap";
  const option = baseOption(data, theme, compact);
  const firstDay = roadmap ? Date.UTC(2026, 6, 1) : milestones ? Date.UTC(2026, 8, 6) : example.id === "gantt-loading" ? Date.UTC(2026, 4, 31) : Date.UTC(2026, 2, 1);
  const records = data.categories.map((name, index) => {
    const row = data.rows?.[index] ?? {};
    const start = typeof row.start === "number" && Number.isFinite(row.start) ? row.start : index * 4;
    const end = typeof row.end === "number" && Number.isFinite(row.end) ? Math.max(start, row.end) : start + 5;
    const progress = typeof row.progress === "number" && Number.isFinite(row.progress) ? Math.min(1, Math.max(0, row.progress)) : 0;
    return { name, start, end, progress, owner: String(row.owner ?? "Unassigned"), team: String(row.team ?? row.owner ?? "Unassigned"),
      phase: typeof row.phase === "string" ? row.phase : undefined, milestone: row.milestone === true || start === end,
      dependsOn: typeof row.dependsOn === "number" ? row.dependsOn : undefined };
  });
  const max = Math.max(4, ...records.map(item => item.end + 2));
  const calendar = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const dateLabel = (day: number) => calendar.format(firstDay + day * 86_400_000);
  const teams = [...new Set(records.map(item => item.team))];
  const labelWidth = compact ? 77 : milestones ? 110 : 143;
  option.grid = { left: labelWidth, top: milestones ? 9 : 31, right: 19, bottom: 29 };
  option.xAxis = { ...numericAxis(theme), min: 0, max, position: milestones ? "bottom" : "top", minInterval: 1,
    axisLabel: { ...numericAxis(theme).axisLabel, formatter: (value: string | number) => dateLabel(Number(value)) } };
  option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true, axisLabel: { ...categoryAxis([], theme).axisLabel, show: !loading, width: labelWidth - 10, overflow: "truncate" } };
  option.tooltip = { ...option.tooltip, show: !loading, trigger: "item", backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none;", formatter: event => {
    const value = (Array.isArray(event) ? event[0] : event).dataIndex;
    const record = records[value];
    if (!record) return "";
    const earlier = record.dependsOn === undefined ? undefined : records[record.dependsOn];
    const pairs = roadmap ? [["Team", record.team], ["Owner", record.owner], ["Done", `${Math.round(record.progress * 100)}%`]] : [
      ...(!milestones && !record.milestone ? [["Progress", `${Math.round(record.progress * 100)}%`]] : []),
      ...(record.milestone ? [["Milestone", dateLabel(record.start)]] : [["Start", dateLabel(record.start)], ["End", dateLabel(record.end)], ["Duration", `${record.end - record.start} days`]]),
      ...(earlier ? [["After", earlier.name]] : []),
    ];
    return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(record.name)}</div><div class="cl-tooltip-rows">${pairs.map(([label, value]) => `<div class="cl-tooltip-row"><span>${label}</span><strong>${escapeTooltipHtml(value)}</strong></div>`).join("")}</div></div>`;
  } };
  option.series = [{
    type: "custom", name: "Tasks", data: records.map((record, index) => [index, record.start, record.end, record.progress]), encode: { x: [1, 2], y: 0 },
    animationDelay: index => index * 48,
    renderItem: (_params, api) => {
      const index = Number(api.value(0));
      const record = records[index];
      const [x0, y] = api.coord([record.start, index]), [x1] = api.coord([record.end, index]);
      const height = compact ? 12 : 17, width = Math.max(2, x1 - x0);
      const color = roadmap ? theme.colors[teams.indexOf(record.team) % theme.colors.length] : theme.colors[milestones ? 1 : 0];
      const earlier = record.dependsOn === undefined ? undefined : records[record.dependsOn];
      const origin = earlier && record.dependsOn !== undefined ? api.coord([earlier.end, record.dependsOn]) : null;
      if (loading) return { type: "group", children: [
        { type: "rect", shape: { x: 14, y: y - 4, width: labelWidth * (.34 + index % 3 * .11), height: 8, r: 3 }, style: { fill: tint(theme.muted, .23) } },
        { type: "rect", shape: { x: x0, y: y - height / 2, width: Math.max(8, width), height, r: 4 }, style: { fill: tint(theme.muted, .18) } },
      ] };
      const children = [
        ...(record.milestone ? [{ type: "polygon" as const, shape: { points: [[x1, y - 7], [x1 + 7, y], [x1, y + 7], [x1 - 7, y]] }, style: { fill: theme.surface, stroke: color, lineWidth: 1.6 } }]
          : [{ type: "rect" as const, shape: { x: x0, y: y - height / 2, width, height, r: 4 }, style: { fill: tint(color, milestones ? .85 : .26) } }]),
        ...(!milestones && !record.milestone && record.progress > 0 ? [{ type: "rect" as const, shape: { x: x0, y: y - height / 2, width: width * record.progress, height, r: 4 }, style: { fill: color } }] : []),
        ...(!compact && record.phase ? [{ type: "text" as const, style: { x: 8, y: y - 11, text: record.phase, fill: theme.muted, fontWeight: 650, fontSize: 9 } }] : []),
      ];
      if (origin) {
        const turn = Math.max(x0 + 8, origin[0] + 9);
        return { type: "group", children: [
          { type: "polyline", shape: { points: [origin, [turn, origin[1]], [turn, y], [x0, y]] }, style: { stroke: tint(theme.muted, 0.65), fill: transparent, lineWidth: 1 } },
          { type: "polygon", shape: { points: [[x0, y], [x0 + 5, y - 3], [x0 + 5, y + 3]] }, style: { fill: theme.muted } },
          ...children,
        ] };
      }
      return { type: "group", children };
    },
    markLine: loading || milestones ? undefined : { silent: true, symbol: ["none", "none"], label: { formatter: roadmap ? "Sep 3" : "Today", position: "start", color: theme.muted, fontSize: 9 }, lineStyle: { color: theme.colors[0], type: "dashed" }, data: [{ xAxis: roadmap ? 64 : Math.round(max * .60) }] },
  }];
  return option;
}

export function buildStream(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const normalized = example.id === "stream-expand";
  const option = baseOption(data, theme, compact);
  if (normalized) {
    const totals = data.categories.map((_, index) => data.series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0));
    option.yAxis = { ...numericAxis(theme), min: 0, max: 100, axisLabel: { ...numericAxis(theme).axisLabel, formatter: "{value}%" } };
    option.series = data.series.map((item, index) => makeLine({ ...item, values: item.values.map((value, i) => totals[i] > 0 && value !== null ? value / totals[i] * 100 : 0) }, index, theme, {
      stack: "share", areaStyle: { opacity: 0.68 }, lineStyle: { opacity: 0 },
    }));
  } else {
    const sums = data.categories.map((_, index) => data.series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0));
    const highest = Math.max(0, ...sums);
    const baseline = sums.map(value => (highest - value) / 2);
    let lower = baseline;
    option.grid = { top: 10, bottom: 26, left: 13, right: 14 };
    option.yAxis = { ...numericAxis(theme, false), show: false };
    option.series = [
      makeLine({ name: "Offset", values: baseline }, 0, theme, { stack: "stream", stackStrategy: "all", lineStyle: { opacity: 0 }, tooltip: { show: false }, silent: true }),
      ...data.series.map((item, index) => {
        const values = data.categories.map((_, position) => Math.max(0, item.values[position] ?? 0));
        const peak = values.indexOf(Math.max(0, ...values));
        const center = (lower[peak] ?? 0) + (values[peak] ?? 0) / 2;
        lower = lower.map((value, position) => value + values[position]);
        return makeLine({ ...item, values }, index, theme, {
          stack: "stream", stackStrategy: "all", areaStyle: { opacity: 0.73 }, lineStyle: { opacity: 0 },
          markPoint: compact || peak < 0 ? undefined : {
            symbol: "circle", symbolSize: 1, silent: true, itemStyle: { color: transparent },
            label: { show: true, formatter: "{b}", color: theme.text, fontSize: 10 },
            data: [{ name: item.name, coord: [peak, center] }],
          },
        });
      }),
    ];
  }
  return option;
}
