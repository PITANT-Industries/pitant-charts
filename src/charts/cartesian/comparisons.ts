import type { BarSeriesOption, CandlestickSeriesOption, CustomSeriesOption, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { dates, curve, type CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, down, gradient, numericAxis, pattern, seriesLegend, signedStroke, tint, transparent, up, valueFormat, type ChartTheme, type Controls } from "./options";
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

function candleRows(data: CartesianData): number[][] {
  return data.categories.map((_, index) => {
    const row = data.rows?.[index];
    if (row && ["open", "close", "low", "high"].every(key => typeof row[key] === "number")) {
      return [Number(row.open), Number(row.close), Number(row.low), Number(row.high)];
    }
    const close = data.series[0]?.values[index] ?? 0;
    const open = data.series[0]?.values[index - 1] ?? close;
    return [open, close, Math.min(open, close) - 1, Math.max(open, close) + 1];
  });
}

function candles(data: CartesianData, theme: ChartTheme, id: string): CandlestickSeriesOption {
  const positive = id === "candlestick-colors" ? theme.colors[1] : up;
  const negative = id === "candlestick-colors" ? theme.colors[4] : down;
  const crosshair = id === "candlestick-crosshair";
  return {
    type: "candlestick", name: "Price", data: candleRows(data).map(value => id === "candlestick-pattern" ? {
      value, itemStyle: { color: tint(positive, 0.25), color0: tint(negative, 0.25),
        borderColor: positive, borderColor0: negative,
        decal: pattern(tint(value[1] >= value[0] ? positive : negative, 0.75)) },
    } : value),
    barMaxWidth: id === "candlestick-colors" ? 18 : 14,
    itemStyle: {
      color: crosshair ? gradient(positive, tint(positive, 0.39)) : positive,
      color0: crosshair ? gradient(negative, tint(negative, 0.39)) : negative,
      borderColor: positive, borderColor0: negative,
    },
    emphasis: { focus: "self" },
  };
}

export function buildCandlestick(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const option = baseOption(data, theme, compact, true);
  const minimal = example.id === "candlestick-minimal";
  option.yAxis = { ...numericAxis(theme, !minimal), scale: true, show: !minimal };
  option.series = [candles(data, theme, example.id)];
  if (example.id === "candlestick-crosshair") option.tooltip = { ...option.tooltip, axisPointer: { type: "cross", crossStyle: { color: up } } };
  if (minimal) option.grid = { top: 10, right: 12, bottom: 22, left: 12 };
  return option;
}

function mean(values: readonly (number | null)[], span = 7) {
  return values.map((value, index) => {
    if (value === null) return null;
    const sample = values.slice(Math.max(0, index - span + 1), index + 1).filter((item): item is number => item !== null);
    return sample.reduce((sum, item) => sum + item, 0) / sample.length;
  });
}

export function buildComposed(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const { id } = example;
  const option = baseOption(data, theme, compact, true);
  const [first, second, third] = data.series;
  if (!first) return option;
  const orders = second ?? first;
  const target = third ?? first;
  const color = colorFor(first, 0, theme);
  const baseline = { ...makeLine({ name: "Rolling average", values: mean(first.values, 5) }, 0, theme),
    areaStyle: { color: gradient(tint(color, 0.28), tint(color, 0.02)) }, lineStyle: { opacity: 0 }, silent: true };
  const line = makeLine(first, 0, theme, { z: 4 });
  const units = makeBar(orders, 1, theme, { itemStyle: { color: tint(colorFor(orders, 1, theme), 0.57), borderRadius: [3, 3, 0, 0] } });
  const goal = makeLine({ name: "Goal", values: target.values.map((_, index) => 52 + index * 1.2) }, 2, theme, { lineStyle: { color: theme.colors[2], width: 2, type: "dashed" } });
  if (id === "composed-target") option.series = [baseline, makeBar(first, 0, theme), goal];
  else if (id === "composed-grouped" || id === "composed-stacked") {
    const stack = id.endsWith("stacked") ? "traffic" : undefined;
    option.series = [makeBar(first, 0, theme, { stack }), makeBar(orders, 1, theme, { stack }), goal];
  } else if (id === "composed-price-volume") {
    const values = curve(data.categories.length, 3, 125, 15, 0.25);
    const rows = data.rows ?? values.map((close, index) => {
      const open = index === 0 ? close - 3 : values[index - 1];
      return { open, close, low: Math.min(open, close) - 2, high: Math.max(open, close) + 2 };
    });
    const price = rows.map(row => typeof row.close === "number" ? row.close : null);
    option.grid = { top: 10, right: 38, bottom: 27, left: compact ? 22 : 42 };
    option.yAxis = [{ ...numericAxis(theme), scale: true, min: "dataMin", position: "right" },
      { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 4 }];
    option.series = [{ ...units, yAxisIndex: 1 }, candles({ ...data, rows }, theme, id),
      makeLine({ name: "5-day average", values: mean(price, 5) }, 3, theme)];
  } else if (id === "composed-signal") option.series = [
    { type: "scatter", name: first.name, data: [...first.values], symbolSize: 6, itemStyle: { color: tint(color, 0.38) } },
    makeLine({ name: "7-day average", values: mean(first.values) }, 0, theme),
  ];
  else if (id === "composed-profit-loss") {
    option.series = [{ ...line, smooth: false, lineStyle: { width: 0 } }, units, signedStroke(first)];
    option.yAxis = [numericAxis(theme), { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 4 }];
    units.yAxisIndex = 1;
  } else if (id === "composed-y-domains") {
    option.yAxis = [{ ...numericAxis(theme), min: 0 }, { ...numericAxis(theme, false), axisLabel: { show: false }, max: Math.max(1, ...orders.values.map(value => value ?? 0)) * 3 }];
    units.yAxisIndex = 1;
    option.series = [units, line];
  } else if (id === "composed-trend") {
    const start = first.values[0] ?? 0, end = first.values.at(-1) ?? start;
    const orderStart = orders.values[0] ?? 0, orderEnd = orders.values.at(-1) ?? orderStart;
    const segments = Math.max(first.values.length - 1, 1);
    option.series = [units, line, makeLine({ name: "Revenue trend", values: first.values.map((_, i) => start + (end - start) * i / segments) }, 2, theme),
      makeLine({ name: "Order trend", values: orders.values.map((_, i) => orderStart + (orderEnd - orderStart) * i / segments) }, 3, theme,
        { lineStyle: { color: theme.colors[3], type: "dotted", width: 2 } })];
  } else if (id === "composed-date-highlights") {
    const last = data.categories.length - 1;
    line.markArea = { silent: true, data: Array.from({ length: Math.max(0, Math.ceil((last - 5) / 7)) }, (_, index) => [
      { xAxis: 5 + index * 7, itemStyle: { color: tint(theme.muted, 0.11), decal: pattern(tint(theme.muted, 0.25)) } }, { xAxis: Math.min(last, 6 + index * 7) },
    ]) };
    line.markLine = { symbol: ["none", "none"], data: [{ xAxis: Math.floor(last * 0.75), name: "Quarter close", label: { formatter: "Quarter close" } }] };
    option.series = [units, line];
  } else if (id === "composed-band") {
    const low = first.values.map(value => value === null ? null : value * 0.83);
    const distance = first.values.map(value => value === null ? null : Math.abs(value) * 0.34);
    option.series = [
      units,
      makeLine({ name: "Band floor", values: low }, 0, theme, { stack: "forecast", stackStrategy: "all", lineStyle: { opacity: 0 }, tooltip: { show: false }, silent: true }),
      makeLine({ name: "Forecast interval", values: distance }, 0, theme, { stack: "forecast", stackStrategy: "all", lineStyle: { opacity: 0 }, tooltip: { show: false }, silent: true,
        areaStyle: { color: gradient(tint(color, 0.4), tint(color, 0.04)), opacity: 1 } }),
      { ...line, lineStyle: { type: "dashed", width: 2.4, color } },
    ];
  } else option.series = [baseline, units, line];
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

export function buildGantt(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean): EChartsOption {
  const milestones = example.id === "gantt-milestones";
  const roadmap = example.id === "gantt-roadmap";
  const option = baseOption(data, theme, compact);
  const records = data.categories.map((name, index) => {
    const row = data.rows?.[index] ?? {};
    const start = Number(row.start ?? index * 4);
    const end = Number(row.end ?? start + 5);
    return { name, start, end, progress: Math.min(1, Math.max(0, Number(row.progress ?? 0))), owner: String(row.owner ?? "Unassigned"),
      dependsOn: typeof row.dependsOn === "number" ? row.dependsOn : undefined };
  });
  const max = Math.max(4, ...records.map(item => item.end + 2));
  const timeline = dates(Math.ceil(max + 1));
  const owners = [...new Set(records.map(item => item.owner))];
  option.grid = { left: compact ? 79 : 112, top: milestones ? 9 : 27, right: 21, bottom: milestones ? 25 : 11 };
  option.xAxis = { ...numericAxis(theme), min: 0, max, position: milestones ? "bottom" : "top", minInterval: 1,
    axisLabel: { ...numericAxis(theme).axisLabel, formatter: (value: string | number) => timeline[Math.round(Number(value))] ?? String(value) } };
  option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true, axisLabel: { ...categoryAxis([], theme).axisLabel, width: compact ? 67 : 100, overflow: "truncate" } };
  option.tooltip = { ...option.tooltip, trigger: "item", formatter: event => {
    const value = (Array.isArray(event) ? event[0] : event).dataIndex;
    const record = records[value];
    if (!record) return "";
    const safe = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
    return `<strong>${safe(record.name)}</strong><br>${safe(record.owner)} · ${Math.round(record.progress * 100)}%<br>${timeline[record.start] ?? record.start} – ${timeline[record.end] ?? record.end}`;
  } };
  if (roadmap && !compact) option.dataZoom = [{ type: "inside", xAxisIndex: 0, zoomOnMouseWheel: "ctrl", moveOnMouseMove: true }];
  option.series = [{
    type: "custom", name: "Tasks", data: records.map((record, index) => [index, record.start, record.end, record.progress]), encode: { x: [1, 2], y: 0 },
    renderItem: (_params, api) => {
      const index = Number(api.value(0));
      const record = records[index];
      const [x0, y] = api.coord([record.start, index]), [x1] = api.coord([record.end, index]);
      const height = compact ? 12 : 17, width = Math.max(2, x1 - x0);
      const color = theme.colors[(roadmap ? owners.indexOf(record.owner) : index) % theme.colors.length];
      const earlier = record.dependsOn === undefined ? undefined : records[record.dependsOn];
      const origin = earlier && record.dependsOn !== undefined ? api.coord([earlier.end, record.dependsOn]) : null;
      const children = [
        { type: "rect" as const, shape: { x: x0, y: y - height / 2, width, height, r: 4 }, style: { fill: tint(color, milestones || roadmap ? 0.75 : 0.27) } },
        ...(!milestones && !roadmap && record.progress > 0 ? [{ type: "rect" as const, shape: { x: x0, y: y - height / 2, width: width * record.progress, height, r: 4 }, style: { fill: color } }] : []),
        ...(milestones && index % 2 === 0 ? [{ type: "polygon" as const, shape: { points: [[x1, y - 7], [x1 + 7, y], [x1, y + 7], [x1 - 7, y]] }, style: { fill: color, stroke: theme.surface, lineWidth: 1 } }] : []),
      ];
      if (!milestones && !roadmap && origin) {
        const turn = Math.max(x0 + 8, origin[0] + 9);
        return { type: "group", children: [
          { type: "polyline", shape: { points: [origin, [turn, origin[1]], [turn, y], [x0, y]] }, style: { stroke: tint(theme.muted, 0.65), fill: transparent, lineWidth: 1 } },
          { type: "polygon", shape: { points: [[x0, y], [x0 + 5, y - 3], [x0 + 5, y + 3]] }, style: { fill: theme.muted } },
          ...children,
        ] };
      }
      return { type: "group", children };
    },
    markLine: milestones || roadmap ? undefined : { silent: true, symbol: ["none", "none"], label: { formatter: "Today", color: theme.muted, fontSize: 9 }, lineStyle: { color: theme.colors[0], type: "dashed" }, data: [{ xAxis: max * 0.45 }] },
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
