import type { BarSeriesOption, CandlestickSeriesOption, CustomSeriesOption, DefaultLabelFormatterCallbackParams, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { dates, candleRows, type CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, down, gradient, numericAxis, signedStroke, strokeFade, tint, transparent, trendValues, up, valueFormat, type ChartTheme } from "./options";
import { escapeTooltipHtml } from "../evil-tooltip";
import { squareBars, stackedBars } from "./BarMarks";

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

export function buildBar(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, active?: number, loading = false): EChartsOption {
  const option = baseOption(data, theme, compact, true);
  const { id } = example;
  const horizontal = id === "bar-sources";
  const signed = id === "bar-profit-loss";
  const squares = id === "bar-squares" || id === "bar-squares-legend";
  const axis = numericAxis(theme, !horizontal);
  const valuesVisible = id === "bar-grouped" || signed;
  option.grid = { top: id === "bar-values" ? 23 : 9, right: 14, bottom: 27, left: valuesVisible ? (compact ? 28 : 43) : 14 };
  option.yAxis = { ...axis, axisLabel: { ...axis.axisLabel, show: valuesVisible, formatter: (value: number) => abbreviated.format(value).toLowerCase() } };
  if (horizontal) {
    option.grid = { top: 7, right: 19, bottom: 7, left: compact ? 54 : 72 };
    option.xAxis = { ...axis, axisLabel: { show: false } };
    option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true };
  }
  option.tooltip = { ...option.tooltip, show: !loading };
  if (squares || id === "bar-stacked") {
    const rows = data.series.map((item, index) => ({
      name: item.name, color: colorFor(item, index, theme), value: (category: number) => typeof item.values[category] === "number" ? valueFormat.format(item.values[category]!) : "—",
    }));
    option.tooltip = { ...option.tooltip, backgroundColor: "transparent", padding: 0, borderWidth: 0, extraCssText: "box-shadow:none", formatter: composedTooltip(data, rows) };
  }
  if (squares || id === "bar-stacked") {
    option.series = squares ? squareBars(data, theme, active) : [stackedBars(data, theme)];
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
  option.series = data.series.map((item, index) => {
    const paint = signed ? item.color ?? theme.colors[1] : colorFor(item, index, theme);
    const ghost = tint(theme.muted, .23);
    const real = item.values.map(value => signed && value !== null ? { value,
      itemStyle: { color: paint, borderRadius: value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } } : value);
    const highest = Math.max(1, ...item.values.map(value => value ?? 0));
    const samples = loading ? data.categories.map((_, i) => Math.round(highest * (.37 + (i * 7 % 6) * .087))) : real;
    return makeBar(item, index, theme, {
      id: `bar-${index}`, barMaxWidth: 110, barWidth: data.series.length === 1 ? "76%" : undefined, barGap: "12%", barCategoryGap: "22%",
      itemStyle: { color: loading ? ghost : paint, borderRadius: horizontal ? [0, 7, 7, 0] : [7, 7, 0, 0] },
      data: samples, emphasis: { focus: "self", disabled: loading },
      label: id === "bar-values" ? { ...labelFor(theme), color: theme.text, position: "top",
        formatter: ({ value }) => typeof value === "number" ? valueFormat.format(value) : "", fontSize: compact ? 7 : 10 } : undefined,
      labelLayout: id === "bar-values" ? { hideOverlap: true } : undefined,
      markLine: signed ? { symbol: ["none", "none"], label: { show: false }, data: [{ yAxis: 0 }], lineStyle: { color: theme.muted, type: "solid" } } : undefined,
    });
  });
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

const abbreviated = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
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

export function buildStream(example: ChartExample, data: CartesianData, theme: ChartTheme, compact: boolean, loading = false): EChartsOption {
  const normalized = example.id === "stream-expand";
  const option = baseOption(data, theme, compact);
  const values = data.series.map(item => data.categories.map((_, i) => Math.max(0, item.values[i] ?? 0)));
  const sums = data.categories.map((_, i) => values.reduce((sum, item) => sum + item[i], 0));
  const peak = Math.max(0, ...sums);
  const baseline = sums.map(value => (peak - value) / 2);
  const streamOrder = ["Pop", "Hip-hop", "Rock", "Electronic", "Jazz"];
  const order = example.id === "stream-default"
    ? data.series.map((item, index) => ({ item, index })).sort((a, b) => streamOrder.indexOf(a.item.name) - streamOrder.indexOf(b.item.name))
    : data.series.map((item, index) => ({ item, index }));
  const rows = order.map(({ item, index }) => ({
    name: item.name, color: colorFor(item, index, theme),
    value: (category: number) => {
      const value = item.values[category];
      if (typeof value !== "number") return "—";
      if (normalized) return valueFormat.format(value);
      return `${abbreviated.format(value).replace("K", "k")} ${example.id === "stream-loading" ? "requests" : "hours"}`;
    },
  }));
  option.tooltip = { ...option.tooltip, show: !loading, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none", formatter: composedTooltip(data, rows) };
  const axis = categoryAxis(data.categories, theme);
  option.xAxis = { ...axis, axisLabel: { ...axis.axisLabel, show: !loading,
    interval: normalized ? 1 : data.categories.length > 12 ? 3 : undefined,
    formatter: normalized ? undefined : (value: string) => /^Jan /.test(value) ? value : value.replace(/ \d{4}$/, "") } };
  const layers: LineSeriesOption[] = [];
  if (!normalized) {
    option.grid = { top: 10, bottom: 26, left: 13, right: 14 };
    option.yAxis = { ...numericAxis(theme, false), show: false };
    layers.push(makeLine({ name: "Offset", values: baseline }, 0, theme, { id: "stream-offset", stack: "stream", stackStrategy: "all",
      lineStyle: { opacity: 0 }, tooltip: { show: false }, silent: true }));
  } else {
    const axis = numericAxis(theme);
    option.yAxis = { ...axis, min: 0, max: 100, interval: 25, axisLabel: { ...axis.axisLabel, formatter: "{value}%" } };
  }
  let lower = normalized ? sums.map(() => 0) : baseline;
  data.series.forEach((item, index) => {
    const raw = values[index];
    const layer = normalized ? raw.map((value, i) => sums[i] ? value / sums[i] * 100 : 0)
      : loading ? raw.map((value, i) => value * (.44 + .16 * Math.cos(i / 2 + index))) : raw;
    const top = layer.indexOf(Math.max(0, ...layer));
    const middle = (lower[top] ?? 0) + (layer[top] ?? 0) / 2;
    lower = lower.map((value, i) => value + layer[i]);
    const color = loading ? tint(theme.muted, .16 + .045 * index) : colorFor(item, index, theme);
    layers.push(makeLine({ ...item, color, values: layer }, index, theme, {
      id: `stream-${index}`, stack: "stream", stackStrategy: "all", areaStyle: { color, opacity: loading ? 1 : .76 }, lineStyle: { opacity: 0 },
      emphasis: { disabled: loading, focus: "series" },
      markPoint: example.id !== "stream-default" || compact || top < 0 ? undefined : {
        symbol: "circle", symbolSize: 1, silent: true, itemStyle: { color: transparent },
        label: { show: true, formatter: "{b}", color: theme.text, fontSize: 10 },
        data: [{ name: item.name, coord: [top, middle] }],
      },
    }));
  });
  option.series = layers;
  return option;
}
