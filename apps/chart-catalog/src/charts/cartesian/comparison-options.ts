import type { DefaultLabelFormatterCallbackParams, EChartsOption } from "echarts";
import type { ChartExample } from "../../types";
import { escapeTooltipHtml } from "../evil-tooltip";
import type { CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, down, numericAxis, tint, transparent, up, valueFormat, type ChartTheme } from "./options";
import { accumulateWaterfall } from "./upstream";

const dollars = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const abbreviated = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const compact = (value: number) => abbreviated.format(value).toLowerCase();
const signed = (value: number, formatter: (value: number) => string = valueFormat.format) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatter(Math.abs(value))}`;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
type Row = [label: string, value: string];

function tooltip(title: string, rows: Row[]) {
  return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(title)}</div><div class="cl-tooltip-rows">${rows.map(([label, value]) =>
    `<div class="cl-tooltip-row"><span>${escapeTooltipHtml(label)}</span><strong>${escapeTooltipHtml(value)}</strong></div>`).join("")}</div></div>`;
}

function customTooltip(option: EChartsOption, loading: boolean, read: (event: DefaultLabelFormatterCallbackParams) => string, trigger: "item" | "axis" = "item") {
  option.tooltip = { ...option.tooltip, show: !loading, trigger, backgroundColor: "transparent", padding: 0, borderWidth: 0,
    extraCssText: "box-shadow:none", formatter: event => read(Array.isArray(event) ? event[0] : event) };
}

function fixedAxis(theme: ChartTheme, format: (value: number) => string, min?: number, max?: number, interval?: number) {
  const axis = numericAxis(theme);
  return { ...axis, min, max, interval, axisLabel: { ...axis.axisLabel, formatter: format, showMinLabel: true, showMaxLabel: true } };
}

const millions = (value: number) => `$${valueFormat.format(value)}M`;
const seconds = (value: number) => `${value.toFixed(2)}s`;
const percent = (value: number) => `${valueFormat.format(value)}%`;

export function buildWaterfall(example: ChartExample, data: CartesianData, theme: ChartTheme, small: boolean, loading: boolean): EChartsOption {
  const cash = example.id === "waterfall-cash-flow";
  const format = cash ? valueFormat.format : millions;
  const option = baseOption(data, theme, small, true);
  const item = data.series[0];
  if (!item) return option;
  const bars = accumulateWaterfall(item.values, index => data.rows?.[index]?.total === true || data.rows?.[index]?.subtotal === true);
  const axisMax = Math.max(...bars.map(([, , to]) => to), 1);
  const axisStep = cash ? 10_000 : example.id === "waterfall-subtotals" ? 200 : 1;
  const axisLimit = Math.ceil(axisMax / axisStep) * axisStep;
  option.yAxis = fixedAxis(theme, cash ? compact : millions, 0, axisLimit, axisStep);
  option.grid = { top: 17, right: 14, bottom: 28, left: small ? 33 : 46 };
  customTooltip(option, loading, ({ dataIndex }) => {
    const bar = bars[dataIndex];
    if (!bar) return "";
    const [index, , total, amount, isTotal] = bar;
    const label = cash ? "Net flow" : isTotal ? "Total" : amount < 0 ? "Decrease" : "Increase";
    const entries: Row[] = [[label, isTotal ? format(amount) : signed(amount, format)]];
    if (!isTotal) entries.push(["Running total", format(total)]);
    return tooltip(data.categories[index], entries);
  });
  option.series = [{
    type: "custom", name: item.name, data: bars, dimensions: ["Period", "From", "To", "Change", "Total"], encode: { x: 0, y: [1, 2] },
    animationDelay: index => index * 35,
    renderItem: (params, api) => {
      const [index, from, to, amount, total] = [0, 1, 2, 3, 4].map(dimension => Number(api.value(dimension)));
      const [center, y0] = api.coord([index, from]), [, y1] = api.coord([index, to]);
      const [, baseline] = api.coord([index, 0]);
      const step = (params.coordSys as unknown as { width: number }).width / Math.max(1, data.categories.length);
      const width = Math.min(step * .68, small ? 30 : 67);
      const y = loading ? baseline - (baseline - y1) * (.72 + index % 3 * .07) : Math.min(y0, y1);
      const height = loading ? baseline - y : Math.abs(y0 - y1);
      const color = loading ? tint(theme.muted, .24) : total ? theme.colors[0] : amount >= 0 ? up : down;
      const next = bars[params.dataIndex + 1];
      const endX = next ? api.coord([next[0], to])[0] : 0;
      return { type: "group", children: [
        { type: "rect", shape: { x: center - width / 2, y, width, height: Math.max(2, height), r: 3 }, style: { fill: color },
          emphasis: { style: { opacity: .78 } } },
        ...(!cash && !loading && next ? [{ type: "line" as const,
          shape: { x1: center + width / 2, y1, x2: endX - width / 2, y2: y1 }, style: { stroke: theme.muted, lineDash: [3, 3], opacity: .52 } }] : []),
        ...(!cash && !small && !loading ? [{ type: "text" as const, style: { x: center, y: y - 6,
          text: total ? format(amount) : signed(amount, format), align: "center" as const,
          verticalAlign: "bottom" as const, fill: theme.text, fontSize: 10 } }] : []),
      ] };
    },
  }];
  return option;
}

export function buildLollipop(example: ChartExample, data: CartesianData, theme: ChartTheme, small: boolean, loading: boolean): EChartsOption {
  const horizontal = example.id === "lollipop-horizontal";
  const change = example.id === "lollipop-change";
  const option = baseOption(data, theme, small, true);
  const pointFormat = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;
  const format = horizontal ? percent : change ? pointFormat : valueFormat.format;
  const axis = horizontal ? fixedAxis(theme, percent, 0, 100, 20)
    : change ? fixedAxis(theme, pointFormat, -3, 3, 1) : fixedAxis(theme, compact, 0);
  option.yAxis = axis;
  if (horizontal) {
    option.xAxis = axis;
    option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true };
    option.grid = { left: small ? 76 : 98, right: 28, top: 9, bottom: 26 };
  }
  const item = data.series[0];
  if (!item) return option;
  const values = data.categories.flatMap((_, index) => finite(item.values[index]) ? [[index, item.values[index]!]] : []);
  const color = colorFor(item, 0, theme);
  customTooltip(option, loading, ({ dataIndex }) => {
    const row = values[dataIndex];
    return row ? tooltip(data.categories[row[0]], [[item.name, format(row[1])]]) : "";
  });
  option.series = [{
    type: "custom", name: item.name,
    data: values.map(([index, value]) => horizontal ? [value, index] : [index, value]),
    encode: { x: 0, y: 1, tooltip: horizontal ? 0 : 1 },
    animationDelay: index => index * 35,
    renderItem: (_params, api) => {
      const index = Number(api.value(horizontal ? 1 : 0)), value = Number(api.value(horizontal ? 0 : 1));
      const drawn = loading ? value * (.74 + index % 3 * .1) : value;
      const [x, y] = api.coord(horizontal ? [drawn, index] : [index, drawn]);
      const [x0, y0] = api.coord(horizontal ? [0, index] : [index, 0]);
      const paint = loading ? tint(theme.muted, .28) : change ? value < 0 ? down : up : color;
      return { type: "group", children: [
        { type: "line", shape: { x1: x0, y1: y0, x2: x, y2: y }, style: { stroke: tint(paint, .62), lineWidth: 2.4 } },
        { type: "circle", shape: { cx: x, cy: y, r: small ? 4.2 : 5.4 }, style: { fill: paint, stroke: theme.surface, lineWidth: 1.3 } },
        ...(!loading && horizontal ? [{ type: "text" as const, style: { x: x + 10, y, text: format(value), fill: theme.text, fontSize: 10, verticalAlign: "middle" as const } }] : []),
      ] };
    },
  }];
  return option;
}

export function buildDumbbell(example: ChartExample, data: CartesianData, theme: ChartTheme, small: boolean, active: number | undefined, loading: boolean): EChartsOption {
  const vertical = example.id === "dumbbell-vertical";
  const annotate = example.id === "dumbbell-legend" && !small;
  const time = example.id === "dumbbell-default";
  const format = time ? seconds : vertical ? dollars.format : valueFormat.format;
  const axis = time ? fixedAxis(theme, seconds, .5, 4, .5)
    : vertical ? fixedAxis(theme, dollars.format, 0)
    : fixedAxis(theme, valueFormat.format, 40);
  const option = baseOption(data, theme, small, true);
  option.yAxis = axis;
  if (!vertical) {
    option.xAxis = axis;
    option.yAxis = { ...categoryAxis(data.categories, theme, true), inverse: true };
    option.grid = { left: small ? 85 : 108, right: 20, top: 9, bottom: 28 };
  }
  const [first, second] = data.series;
  if (!first || !second) return option;
  const values = data.categories.flatMap((_, index) => finite(first.values[index]) && finite(second.values[index])
    ? [[index, first.values[index]!, second.values[index]!]] : []);
  customTooltip(option, loading, ({ dataIndex }) => {
    const row = values[dataIndex];
    if (!row) return "";
    const [index, from, to] = row, delta = to - from;
    const ratio = from ? ` (${signed(delta / Math.abs(from) * 100, value => `${valueFormat.format(Number(value.toFixed(1)))}%`)})` : "";
    return tooltip(data.categories[index], [[first.name, format(from)], [second.name, format(to)], ["Change", signed(delta, format) + ratio]]);
  });
  option.series = [{
    type: "custom", name: "Comparison", data: values,
    dimensions: ["Category", first.name, second.name],
    encode: { x: vertical ? 0 : [1, 2], y: vertical ? [1, 2] : 0, tooltip: [1, 2] },
    animationDelay: index => index * 32,
    renderItem: (_params, api) => {
      const [category, from, to] = [0, 1, 2].map(dimension => Number(api.value(dimension)));
      const coord = (value: number) => api.coord(vertical ? [category, value] : [value, category]);
      const a = coord(from), b = coord(loading ? from + (to - from) * .35 : to);
      const dots = [a, b].map(([x, y], index) => {
        const color = colorFor(data.series[index], index, theme);
        return { type: "circle" as const, shape: { cx: x, cy: y, r: small ? 4.5 : 6 },
          style: { fill: loading ? tint(theme.muted, .28) : color, opacity: active === undefined || active === index ? 1 : .24, stroke: theme.surface, lineWidth: 1.3 } };
      });
      const labels = annotate && !loading ? [a, b].map(([x, y], index) => ({
        type: "text" as const, style: { x, y: y - 14, text: format(index === 0 ? from : to), fill: theme.text, fontSize: 10,
          opacity: active === undefined || active === index ? 1 : .24, align: "center" as const },
      })) : [];
      return { type: "group", children: [
        { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: tint(theme.muted, .4), lineWidth: 4 } },
        ...dots, ...labels,
      ] };
    },
  }];
  return option;
}

export function buildRanking(example: ChartExample, data: CartesianData, theme: ChartTheme, small: boolean, active: number | undefined, loading: boolean): EChartsOption {
  const bump = example.family === "bump";
  const ascending = example.id === "bump-ascending";
  const response = example.id === "slope-response-time";
  const endpoint = !small && !loading && !ascending;
  const option = baseOption(data, theme, small);
  const sorted = data.categories.map((_, column) => data.series.map((item, index) => ({ index, value: item.values[column] }))
    .filter(({ value }) => finite(value)).sort((a, b) => ascending ? a.value! - b.value! : b.value! - a.value!).map(({ index }) => index));
  const measure = ascending ? (value: number) => `${value.toFixed(1)}s` : response ? (value: number) => `${value.toFixed(1)}h` :
    example.id === "bump-default" ? percent : example.id === "bump-loading" ? (value: number) => `${valueFormat.format(value)} deals` : valueFormat.format;
  const axis = numericAxis(theme, bump);
  option.yAxis = { ...axis, inverse: bump, min: bump ? 1 : "dataMin", max: bump ? Math.max(2, data.series.length) : "dataMax",
    interval: bump ? 1 : undefined, axisLabel: { ...axis.axisLabel, show: bump, formatter: (value: number) => `#${value}` } };
  const padding = endpoint ? bump ? 74 : 98 : 17;
  option.grid = { top: 16, right: padding, bottom: 25, left: endpoint && !bump ? padding : small ? 27 : 37 };
  const ranking = (index: number, column: number) => (sorted[column]?.indexOf(index) ?? -1) + 1;
  customTooltip(option, loading, ({ seriesIndex, dataIndex }) => {
    if (seriesIndex === undefined) return "";
    const item = data.series[seriesIndex];
    if (!item) return "";
    const entries: Row[] = data.categories.flatMap((category, i) => finite(item.values[i])
      ? [[category, bump ? `#${ranking(seriesIndex, i)} · ${measure(item.values[i]!)}` : measure(item.values[i]!)] as Row] : []);
    if (!bump && finite(item.values[0]) && finite(item.values.at(-1))) {
      const from = item.values[0]!, delta = item.values.at(-1)! - from;
      const ratio = from ? ` (${signed(delta / Math.abs(from) * 100, value => `${valueFormat.format(Number(value.toFixed(1)))}%`)})` : "";
      entries.push(["Change", signed(delta, measure) + ratio]);
    }
    if (dataIndex === undefined) return "";
    return tooltip(item.name, entries);
  });
  option.series = data.series.map((item, index) => {
    const from = item.values[0], last = item.values.at(-1);
    const improved = finite(from) && finite(last) && (response ? last < from : last > from);
    const color = loading ? tint(theme.muted, .23) : bump ? colorFor(item, index, theme) : item.color ?? (improved ? up : response ? tint(theme.muted, .55) : down);
    const values = bump ? sorted.map((_, i) => finite(item.values[i]) ? ranking(index, i) : null) : [...item.values];
    const labels = (value: number, first: boolean) => bump ? item.name : first ? `${item.name}  ${measure(value)}` : `${measure(value)}  ${item.name}`;
    return {
      type: "line" as const, name: item.name, data: values, smooth: bump ? .3 : false, showSymbol: true, symbol: "circle", symbolSize: small ? 5 : 8,
      itemStyle: { color, borderColor: theme.surface, borderWidth: 1.2, opacity: active === undefined || active === index ? 1 : .19 },
      lineStyle: { color, width: 2.2, opacity: active === undefined || active === index ? 1 : .19 },
      label: endpoint && !bump ? { show: true, position: "left" as const, color: theme.muted, fontSize: 10,
        formatter: ({ dataIndex, value }: DefaultLabelFormatterCallbackParams) => dataIndex === 0 && finite(value) ? labels(value, true) : "" } : undefined,
      labelLayout: endpoint ? { moveOverlap: "shiftY" as const } : undefined,
      endLabel: endpoint && finite(last) ? { show: true, formatter: labels(last, false), color: theme.muted, fontSize: 10 } : undefined,
      emphasis: { focus: "series" as const, disabled: loading },
    };
  });
  return option;
}

const divergingFive = ["#d34e6b", "#e49188", "#a4a6ba", "#74bda6", "#29937c"];
const divergingFour = ["#d34e6b", "#e49188", "#74bda6", "#29937c"];

export function divergingColor(index: number, neutral: boolean, provided?: string) {
  const scale = neutral ? divergingFive : divergingFour;
  return provided ?? scale[index % scale.length];
}

export function buildDiverging(example: ChartExample, data: CartesianData, theme: ChartTheme, small: boolean, active: number | undefined, loading: boolean): EChartsOption {
  const option = baseOption(data, theme, small, true);
  const neutral = data.series.findIndex(item => item.name.toLowerCase() === "neutral");
  const midpoint = neutral >= 0 ? neutral : Math.floor(data.series.length / 2);
  const legend = example.id === "diverging-legend";
  const categories = data.categories;
  const totalAt = (index: number) => data.series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0);
  const percentAt = (index: number, item: number) => totalAt(index) ? Math.max(0, data.series[item].values[index] ?? 0) / totalAt(index) * 100 : 0;
  const format = (value: number) => `${value < 10 ? value.toFixed(1) : value.toFixed(0)}%`;
  const labelWidth = small ? 92 : legend ? 87 : 157;
  option.grid = { left: labelWidth, right: 16, top: 10, bottom: 31 };
  option.xAxis = fixedAxis(theme, value => `${Math.abs(value)}%`, legend ? -25 : -50, 100, 25);
  const ordinal = categoryAxis(categories, theme, true);
  option.yAxis = { ...ordinal, inverse: true, axisLabel: { ...ordinal.axisLabel, width: labelWidth - 8, overflow: "truncate" } };
  customTooltip(option, loading, ({ dataIndex }) => {
    const rows: Row[] = data.series.map((item, index) => [
      item.name, `${valueFormat.format(item.values[dataIndex] ?? 0)} ${legend ? "customers" : "answers"} · ${format(percentAt(dataIndex, index))}`,
    ]);
    const net = data.series.reduce((sum, _, index) => sum + (index === neutral ? 0 : index < midpoint ? -1 : 1) * percentAt(dataIndex, index), 0);
    rows.push(["Net", `${signed(Math.round(net))} pts`]);
    return tooltip(categories[dataIndex], rows);
  });
  const slices = categories.map((_, row) => {
    let negative = 0, positive = 0;
    const order = [...(neutral >= 0 ? [{ index: neutral, part: -.5 }, { index: neutral, part: .5 }] : []),
      ...data.series.map((_, index) => index).slice(0, midpoint).reverse().map(index => ({ index, part: -1 })),
      ...data.series.map((_, index) => index).slice(midpoint + (neutral >= 0 ? 1 : 0)).map(index => ({ index, part: 1 }))];
    return order.map(({ index, part }) => {
      const share = percentAt(row, index), from = part < 0 ? negative : positive, to = from + share * part;
      if (part < 0) negative = to;
      else positive = to;
      return { index, from, to, share, part };
    });
  });
  option.series = [{
    type: "custom", name: "Responses", data: categories.map((_, index) => [0, index]), encode: { x: 0, y: 1 },
    renderItem: (params, api) => {
      const row = Number(api.value(1));
      const bounds = params.coordSys as unknown as { x: number; y: number; width: number; height: number };
      const [zero, center] = api.coord([0, row]);
      const height = Math.min(30, bounds.height / Math.max(1, categories.length) * .52);
      return { type: "group", clipPath: { type: "rect", shape: bounds }, children: slices[row].flatMap(({ from, to, share, index, part }) => {
        const shrink = loading ? .6 : 1;
        const [left] = api.coord([Math.min(from, to) * shrink, row]), [right] = api.coord([Math.max(from, to) * shrink, row]);
        const width = Math.max(0, right - left - 1.2);
        if (!width) return [];
        const color = divergingColor(index, neutral >= 0, data.series[index].color);
        const opacity = active === undefined || active === index ? 1 : .24;
        const label = part === .5 ? zero : (left + right) / 2;
        return [
          { type: "rect" as const, shape: { x: left + .6, y: center - height / 2, width, height, r: 2 },
            style: { fill: loading ? tint(theme.muted, .19) : color, opacity } },
          ...(!small && !legend && !loading && (part === .5 ? share >= 9 : part !== -.5 && width > 25) ? [{
            type: "text" as const, silent: true, style: { x: label, y: center, text: format(share), fill: theme.surface,
              fontSize: 9, align: "center" as const, verticalAlign: "middle" as const, opacity },
          }] : []),
        ];
      }) };
    },
  }];
  return option;
}
