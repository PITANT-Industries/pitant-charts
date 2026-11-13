import type { CustomSeriesOption, DefaultLabelFormatterCallbackParams, EChartsOption, LineSeriesOption } from "echarts";
import type { ChartExample, ChartSeries } from "../../types";
import { dates, type CartesianData } from "./data";
import { baseOption, categoryAxis, colorFor, numericAxis, tint, transparent, valueFormat, type ChartTheme } from "./options";
import { escapeTooltipHtml } from "../evil-tooltip";

function makeLine(item: ChartSeries, index: number, theme: ChartTheme, extra: Partial<LineSeriesOption> = {}): LineSeriesOption {
  const color = colorFor(item, index, theme);
  return { type: "line", name: item.name, data: [...item.values], showSymbol: false, smooth: 0.23,
    itemStyle: { color }, lineStyle: { color, width: 2.3 }, emphasis: { focus: "series" }, ...extra };
}

const abbreviated = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

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
  option.tooltip = { ...option.tooltip, show: !loading, backgroundColor: "transparent", borderWidth: 0, padding: 0, extraCssText: "box-shadow:none",
    formatter: (event: DefaultLabelFormatterCallbackParams | DefaultLabelFormatterCallbackParams[]) => {
      const index = (Array.isArray(event) ? event[0] : event)?.dataIndex;
      if (typeof index !== "number" || index < 0 || index >= data.categories.length) return "";
      const lines = rows.map(row => {
        const color = typeof CSS !== "undefined" && CSS.supports("color", row.color) ? row.color : "currentColor";
        return `<div class="cl-tooltip-row"><span><i style="display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background-color:${escapeTooltipHtml(color)}"></i>${escapeTooltipHtml(row.name)}</span><strong>${escapeTooltipHtml(row.value(index))}</strong></div>`;
      }).join("");
      return `<div class="cl-tooltip"><div class="cl-tooltip-heading">${escapeTooltipHtml(data.categories[index])}</div><div class="cl-tooltip-rows">${lines}</div></div>`;
    },
  };
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
